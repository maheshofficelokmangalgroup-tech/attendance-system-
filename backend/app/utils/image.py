"""Image upload validation and file naming utilities."""
import os
import uuid
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def validate_image_upload(file: UploadFile) -> str:
    """
    Validates uploaded image file:
    - Content-Type check (JPEG, PNG, WEBP)
    - Extension check
    - Max size check (default <= 10MB)

    Returns file extension (e.g. '.jpg')
    """
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    if file.content_type and file.content_type.lower() not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid content-type '{file.content_type}'. Allowed: JPEG, PNG, WEBP",
        )

    return ext


def generate_unique_filename(employee_id: int, action: str, ext: str) -> str:
    """
    Generates a secure, randomized filename:
    Format: emp_{employee_id}_{action}_{uuid4}{ext}
    Example: emp_42_checkin_a1b2c3d4.jpg
    """
    unique_id = uuid.uuid4().hex[:12]
    clean_ext = ext if ext.startswith(".") else f".{ext}"
    return f"emp_{employee_id}_{action}_{unique_id}{clean_ext}"
