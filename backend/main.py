from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from routers import forecast, ai_adjust, geo_data
from models.schemas import ErrorResponse

load_dotenv()

app = FastAPI(
    title="AI Forecasting API",
    description="B2B Sales Forecasting with Prophet and AI Adjustment",
    version="1.0.0"
)

# The browser normally reaches this service through the Node backend, so CORS
# only matters when calling it directly (e.g. from Swagger UI or a dev tool).
# Override with a comma-separated ALLOWED_ORIGINS env var.
origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8080").split(",")
    if o.strip()
]

# CORSMiddleware also answers OPTIONS preflight requests, so no custom handler is needed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(forecast.router, prefix="/api", tags=["forecast"])
app.include_router(ai_adjust.router, prefix="/api", tags=["ai-adjustment"])
app.include_router(geo_data.router, prefix="/api", tags=["geo-data"])


@app.get("/")
async def root():
    return {"message": "AI Forecasting API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/cors-test")
async def cors_test():
    return {"message": "CORS test successful", "status": "ok"}

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc)
        ).dict()
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
