"""Pagination helper utilities."""
import math
from typing import List, TypeVar
from app.schemas.common import PaginatedResponse

T = TypeVar("T")


def build_paginated_response(
    items: List[T],
    total: int,
    page: int,
    page_size: int,
) -> PaginatedResponse[T]:
    return PaginatedResponse(
        data=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )
