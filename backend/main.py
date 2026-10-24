from io import BytesIO

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Maximum supported upload size: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024

# Initialize FastAPI
app = FastAPI(
    title="DataTale API",
    description="Backend API for AI-powered data storytelling",
    version="1.0.0",
)

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    # Confirm the backend is running
    return {
        "status": "healthy",
        "service": "DataTale API",
    }


@app.post("/api/analyze")
async def analyze_csv(file: UploadFile = File(...)):
    # Validate the filename
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid CSV file.",
        )

    # Read at most 10 MB plus one byte
    contents = await file.read(MAX_FILE_SIZE + 1)

    # Reject empty files
    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    # Reject oversized files
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size must not exceed 10 MB.",
        )

    try:
        # Convert CSV bytes into a Pandas DataFrame
        dataframe = pd.read_csv(BytesIO(contents))

    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Unable to read the CSV file. Check its format.",
        )

    # Reject datasets without rows or columns
    if dataframe.empty:
        raise HTTPException(
            status_code=400,
            detail="The CSV file does not contain usable data.",
        )

    # Return basic dataset information
    return {
        "filename": file.filename,
        "rows": int(dataframe.shape[0]),
        "columns": int(dataframe.shape[1]),
        "column_names": dataframe.columns.tolist(),
        "message": "CSV uploaded and parsed successfully.",
    }