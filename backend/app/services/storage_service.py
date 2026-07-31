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


def get_storage_service() -> BaseStorageService:
    """Factory function for storage service dependency injection."""
    return LocalStorageService()
