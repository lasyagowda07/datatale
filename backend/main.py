from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize the FastAPI application
app = FastAPI(
    title="DataTale API",
    description="Backend API for AI-powered data storytelling",
    version="1.0.0"
)

# Allow requests from our Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "DataTale API"
    }