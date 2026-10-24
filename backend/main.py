import json
from io import BytesIO
from typing import Literal

import pandas as pd
from anthropic import APIConnectionError, APIStatusError, APITimeoutError
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError

from backend.classifier import classify_columns
from backend.data_statistics import calculate_statistics


# Maximum supported upload size: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024

# Number of rows to show in the dataset preview
PREVIEW_ROWS = 5

# Claude confidence threshold
CONFIDENCE_THRESHOLD = 0.85


# Define the structure of a user-confirmed classification
class StatisticsClassification(BaseModel):
    name: str
    type: Literal["numeric", "categorical", "skip"]


# Define the structure of the statistics request
class StatisticsRequest(BaseModel):
    classifications: list[StatisticsClassification]


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


# Convert Pandas data types into readable labels
def get_column_type(dtype):
    if pd.api.types.is_bool_dtype(dtype):
        return "boolean"

    if pd.api.types.is_numeric_dtype(dtype):
        return "numeric"

    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "datetime"

    return "text"


# Convert values into JSON-safe Python objects
def clean_value(value):
    # Represent missing values as JSON null
    if pd.isna(value):
        return None

    # Convert Pandas and NumPy scalar types
    if hasattr(value, "item"):
        return value.item()

    return value


# Validate and parse uploaded CSV files
async def read_csv_file(file: UploadFile):
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
        # Parse the uploaded CSV in memory
        dataframe = pd.read_csv(BytesIO(contents))

    except (
        pd.errors.ParserError,
        pd.errors.EmptyDataError,
        UnicodeError,
        ValueError,
    ):
        raise HTTPException(
            status_code=400,
            detail="Unable to read the CSV file. Check its format.",
        )

    # Reject datasets without usable rows or columns
    if dataframe.empty:
        raise HTTPException(
            status_code=400,
            detail="The CSV file does not contain usable data.",
        )

    return dataframe


@app.post("/api/analyze")
async def analyze_csv(file: UploadFile = File(...)):
    # Parse the uploaded CSV
    dataframe = await read_csv_file(file)

    # Calculate dataset dimensions
    total_rows = int(dataframe.shape[0])
    total_columns = int(dataframe.shape[1])

    # Count duplicate rows
    duplicate_rows = int(dataframe.duplicated().sum())

    # Build a profile for each column
    column_profiles = []

    for column_index, column_name in enumerate(dataframe.columns):
        # Select the column by position
        column_data = dataframe.iloc[:, column_index]

        # Calculate missing and unique values
        missing_count = int(column_data.isna().sum())
        unique_count = int(column_data.nunique(dropna=True))

        column_profiles.append(
            {
                "name": str(column_name),
                "data_type": get_column_type(column_data.dtype),
                "missing_values": missing_count,
                "unique_values": unique_count,
            }
        )

    # Extract the first five rows for preview
    preview_rows = []

    for row in dataframe.head(PREVIEW_ROWS).itertuples(
        index=False,
        name=None,
    ):
        preview_rows.append(
            [clean_value(value) for value in row]
        )

    # Return the dataset profile
    return {
        "filename": file.filename,
        "rows": total_rows,
        "columns": total_columns,
        "column_names": dataframe.columns.tolist(),
        "duplicate_rows": duplicate_rows,
        "column_profiles": column_profiles,
        "preview": {
            "columns": dataframe.columns.tolist(),
            "rows": preview_rows,
        },
        "message": "CSV uploaded and profiled successfully.",
    }


@app.post("/api/classify")
async def classify_csv(file: UploadFile = File(...)):
    # Validate and parse the CSV
    dataframe = await read_csv_file(file)

    try:
        # Ask Claude to classify the columns
        result = classify_columns(dataframe)

    except (APIConnectionError, APITimeoutError):
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to Claude. Please try again.",
        )

    except APIStatusError:
        raise HTTPException(
            status_code=502,
            detail="Claude API request failed. Please try again.",
        )

    except (ValueError, TypeError, ValidationError):
        raise HTTPException(
            status_code=502,
            detail="Claude returned an invalid classification response.",
        )

    # Add review status based on confidence
    classifications = []

    for column in result.columns:
        needs_review = column.confidence < CONFIDENCE_THRESHOLD

        classifications.append(
            {
                "name": column.name,
                "type": column.type,
                "confidence": column.confidence,
                "needs_review": needs_review,
            }
        )

    # Return AI classifications
    return {
        "filename": file.filename,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "columns": classifications,
        "message": "AI column classification completed successfully.",
    }


@app.post("/api/statistics")
async def calculate_dataset_statistics(
    file: UploadFile = File(...),
    classifications: str = Form(...),
):
    # Validate and parse the uploaded CSV
    dataframe = await read_csv_file(file)

    try:
        # Convert the JSON form field into a Python object
        submitted_data = json.loads(classifications)

        # Validate the submitted classifications using Pydantic
        request = StatisticsRequest(
            classifications=submitted_data
        )

        # Convert validated classifications into dictionaries
        confirmed_classifications = [
            column.model_dump()
            for column in request.classifications
        ]

        # Calculate statistics using the confirmed classifications
        result = calculate_statistics(
            dataframe,
            confirmed_classifications,
        )

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Classifications must contain valid JSON.",
        )

    except ValidationError:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid classifications. Each column must have "
                "a name and a type: numeric, categorical, or skip."
            ),
        )

    except (ValueError, TypeError, KeyError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    # Return the calculated statistics
    return result