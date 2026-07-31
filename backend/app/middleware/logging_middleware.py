"""
Audit log middleware hook.
Automatically records IP address and User-Agent on mutating operations (POST, PUT, DELETE, PATCH).
"""
import time
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request

logger = structlog.get_logger()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000

        logger.info(
            "HTTP Request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(process_time, 2),
            client_ip=request.client.host if request.client else None,
        )

        response.headers["X-Process-Time-Ms"] = str(round(process_time, 2))
        return response
