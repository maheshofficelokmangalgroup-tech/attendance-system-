"""Backend entry point — run with: uvicorn main:app --reload"""
# CI/CD trigger: verifying GitHub Actions -> AWS deploy pipeline
from app.main import app  # noqa: F401 — re-export for uvicorn

if __name__ == "__main__":
    import uvicorn
    from app.core.config import settings

    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.DEBUG,
    )
