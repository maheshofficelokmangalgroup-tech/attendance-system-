"""
Storage Service Abstraction.
Abstract base class + LocalFileSystem implementation.
Swap to S3 / Azure Blob later by adding a class implementation here.
"""
import os
import shutil
from abc import ABC, abstractmethod
from typing import BinaryIO
from app.core.config import settings


class BaseStorageService(ABC):
    @abstractmethod
    def save_file(self, file_obj: BinaryIO, relative_path: str) -> str:
        """Saves file object to storage and returns relative URL path."""
        pass

    @abstractmethod
    def delete_file(self, relative_path: str) -> bool:
        """Deletes file from storage."""
        pass


class LocalStorageService(BaseStorageService):
    def __init__(self, base_dir: str = settings.UPLOAD_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    def save_file(self, file_obj: BinaryIO, relative_path: str) -> str:
        """
        Saves file under uploads/<relative_path>
        Example: relative_path = "attendance/emp_1_checkin_x.jpg"
        Returns URL path string: "/uploads/attendance/emp_1_checkin_x.jpg"
        """
        full_path = os.path.join(self.base_dir, relative_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)

        # Normalize forward slashes for URLs
        clean_rel = relative_path.replace("\\", "/")
        return f"/uploads/{clean_rel}"

    def delete_file(self, relative_path: str) -> bool:
        clean_rel = relative_path.lstrip("/").replace("uploads/", "")
        full_path = os.path.join(self.base_dir, clean_rel)
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
        return False


class CloudinaryStorageService(BaseStorageService):
    def __init__(self):
        import cloudinary

        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

    def save_file(self, file_obj: BinaryIO, relative_path: str) -> str:
        """
        Uploads to Cloudinary under public_id "<relative_path without ext>"
        (e.g. "attendance/emp_1_checkin_x"). Returns the Cloudinary secure_url.
        """
        import cloudinary.uploader
        import cloudinary.exceptions
        from fastapi import HTTPException, status as http_status

        clean_rel = relative_path.replace("\\", "/")
        ext = os.path.splitext(clean_rel)[1].lower()

        # "auto" lets Cloudinary inspect the content and pick image vs raw —
        # but for a PDF this is inconsistent: some get classified as "image"
        # (served under /image/upload/, which Cloudinary's PDF/ZIP security
        # policy blocks with 401 on this account) and others as "raw" (served
        # under /raw/upload/, unaffected by that policy) — same file type,
        # different outcome depending on content. Deciding by extension
        # ourselves removes that ambiguity: real images always go through
        # "image" (gets thumbnails/transforms), everything else — PDFs
        # included — always goes through "raw" (plain byte storage, no
        # image-pipeline security policy to trip over).
        image_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
        resource_type = "image" if ext in image_exts else "raw"
        # "image" uploads get their format auto-appended by Cloudinary, so the
        # extension must be stripped from public_id to avoid a double
        # extension — "raw" uploads get no such auto-append, so the extension
        # has to stay in public_id or the returned URL ends with no
        # extension at all, breaking any "is this a PDF" check downstream.
        public_id = os.path.splitext(clean_rel)[0] if resource_type == "image" else clean_rel

        try:
            result = cloudinary.uploader.upload(
                file_obj,
                public_id=public_id,
                overwrite=True,
                resource_type=resource_type,
            )
        except cloudinary.exceptions.Error as e:
            raise HTTPException(
                status_code=http_status.HTTP_502_BAD_GATEWAY,
                detail=f"File upload to storage provider failed: {e}",
            )
        return result["secure_url"]

    def delete_file(self, relative_path: str) -> bool:
        import cloudinary.uploader

        clean_rel = relative_path.lstrip("/").replace("uploads/", "")
        ext = os.path.splitext(clean_rel)[1].lower()
        image_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
        resource_type = "image" if ext in image_exts else "raw"
        public_id = os.path.splitext(clean_rel)[0] if resource_type == "image" else clean_rel
        result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        return result.get("result") == "ok"


def get_storage_service() -> BaseStorageService:
    """Factory function for storage service dependency injection."""
    if settings.STORAGE_BACKEND.lower() == "cloudinary":
        return CloudinaryStorageService()
    return LocalStorageService()
