"""Rate Limiting Middleware for Auth Endpoints."""
import time
from collections import defaultdict
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

# In-memory storage: IP -> List of timestamps
_request_history: defaultdict = defaultdict(list)
RATE_LIMIT_WINDOW_SECONDS = 60
MAX_LOGIN_REQUESTS_PER_WINDOW = 10

SENSITIVE_PATHS = {"/api/v1/auth/login", "/api/v1/auth/forgot-password"}


class AuthRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in SENSITIVE_PATHS and request.method == "POST":
            client_ip = request.client.host if request.client else "unknown"
            now = time.time()

            # Clean old timestamps
            history = [t for t in _request_history[client_ip] if now - t < RATE_LIMIT_WINDOW_SECONDS]
            _request_history[client_ip] = history

            if len(history) >= MAX_LOGIN_REQUESTS_PER_WINDOW:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many authentication attempts. Please wait 60 seconds and try again.",
                )

            _request_history[client_ip].append(now)

        return await call_next(request)
