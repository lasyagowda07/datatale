import json
from io import BytesIO
from typing import Literal

import pandas as pd

from anthropic import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
)

from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from pydantic import BaseModel, ValidationError

from backend.classifier import classify_columns
from backend.data_statistics import calculate_statistics
from backend.storyteller import generate_insights
from backend.insight_models import InsightResponse
from backend.reports.generator import generate_report


# --------------------------------------------------
# Configuration
# --------------------------------------------------

MAX_FILE_SIZE = 10 * 1024 * 1024
PREVIEW_ROWS = 5
CONFIDENCE_THRESHOLD = 0.85


# --------------------------------------------------
# Request models
# --------------------------------------------------

class StatisticsClassification(BaseModel):
    name: str
    type: Literal["numeric", "categorical", "skip"]


class StatisticsRequest(BaseModel):
    classifications: list[StatisticsClassification]


# --------------------------------------------------
# FastAPI initialization
# --------------------------------------------------

app = FastAPI(
    title="DataTale API",
    description="Backend API for AI-powered data storytelling",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "DataTale API",
    }


# --------------------------------------------------
# CSV helpers
# --------------------------------------------------

def get_column_type(dtype):
    if pd.api.types.is_bool_dtype(dtype):
        return "boolean"

    if pd.api.types.is_numeric_dtype(dtype):
        return "numeric"

    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "datetime"

    return "text"


def clean_value(value):
    if pd.isna(value):
        return None

    if hasattr(value, "item"):
        return value.item()

    return value


async def read_csv_file(file: UploadFile):
    """Validate and parse an uploaded CSV."""

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid CSV file.",
        )

    contents = await file.read(MAX_FILE_SIZE + 1)

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File size must not exceed 10 MB.",
        )

    try:
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

    if dataframe.empty:
        raise HTTPException(
            status_code=400,
            detail="The CSV file does not contain usable data.",
        )

    return dataframe


# --------------------------------------------------
# Classification helpers
# --------------------------------------------------

def parse_classifications(classifications: str):
    """Validate user-confirmed column classifications."""

    try:
        submitted_data = json.loads(classifications)

        request = StatisticsRequest(
            classifications=submitted_data
        )

        return [
            column.model_dump()
            for column in request.classifications
        ]

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


def parse_report_insights(insights_json: str | None):
    """
    Validate existing AI insights submitted by the frontend.

    This function does not call Claude.
    """

    if not insights_json:
        return None

    try:
        submitted_data = json.loads(insights_json)

        validated_insights = InsightResponse.model_validate(
            submitted_data
        )

        return validated_insights.model_dump()

    except (json.JSONDecodeError, ValidationError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Invalid AI insights supplied for the report.",
        )


def calculate_confirmed_statistics(dataframe, classifications):
    """Calculate statistics and convert validation errors to HTTP 400."""

    try:
        return calculate_statistics(
            dataframe,
            classifications,
        )

    except (ValueError, TypeError, KeyError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


# --------------------------------------------------
# Dataset analysis
# --------------------------------------------------

@app.post("/api/analyze")
async def analyze_csv(file: UploadFile = File(...)):
    dataframe = await read_csv_file(file)

    total_rows = int(dataframe.shape[0])
    total_columns = int(dataframe.shape[1])

    duplicate_rows = int(dataframe.duplicated().sum())

    column_profiles = []

    for column_index, column_name in enumerate(dataframe.columns):
        column_data = dataframe.iloc[:, column_index]

        column_profiles.append(
            {
                "name": str(column_name),
                "data_type": get_column_type(column_data.dtype),
                "missing_values": int(column_data.isna().sum()),
                "unique_values": int(
                    column_data.nunique(dropna=True)
                ),
            }
        )

    preview_rows = []

    for row in dataframe.head(PREVIEW_ROWS).itertuples(
        index=False,
        name=None,
    ):
        preview_rows.append(
            [clean_value(value) for value in row]
        )

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


# --------------------------------------------------
# AI classification
# --------------------------------------------------

@app.post("/api/classify")
async def classify_csv(file: UploadFile = File(...)):
    dataframe = await read_csv_file(file)

    try:
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

    except (ValueError, TypeError, ValidationError) as error:
        print("Classification validation error:", repr(error))

        raise HTTPException(
            status_code=502,
            detail="Claude returned classifications that could not be validated.",
        )

    classifications = []

    for column in result.columns:
        classifications.append(
            {
                "name": column.name,
                "type": column.type,
                "confidence": column.confidence,
                "needs_review": (
                    column.confidence < CONFIDENCE_THRESHOLD
                ),
            }
        )

    return {
        "filename": file.filename,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "columns": classifications,
        "message": "AI column classification completed successfully.",
    }


# --------------------------------------------------
# Statistics
# --------------------------------------------------

@app.post("/api/statistics")
async def calculate_dataset_statistics(
    file: UploadFile = File(...),
    classifications: str = Form(...),
):
    dataframe = await read_csv_file(file)

    confirmed_classifications = parse_classifications(
        classifications
    )

    return calculate_confirmed_statistics(
        dataframe,
        confirmed_classifications,
    )


# --------------------------------------------------
# AI insights
# --------------------------------------------------

@app.post("/api/insights")
async def generate_dataset_insights(
    file: UploadFile = File(...),
    classifications: str = Form(...),
):
    """
    CSV -> Pandas statistics -> Claude -> Pydantic validation.
    """

    dataframe = await read_csv_file(file)

    confirmed_classifications = parse_classifications(
        classifications
    )

    statistics = calculate_confirmed_statistics(
        dataframe,
        confirmed_classifications,
    )

    if not statistics.get("results"):
        raise HTTPException(
            status_code=400,
            detail="At least one column must be analyzed to generate insights.",
        )

    try:
        insights = generate_insights(statistics)

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

    except (
        json.JSONDecodeError,
        ValidationError,
        ValueError,
        TypeError,
        KeyError,
    ) as error:
        print(
            f"Insight validation failed: "
            f"{type(error).__name__}: {error}"
        )

        raise HTTPException(
            status_code=502,
            detail="Claude returned insights that could not be validated.",
        )

    return {
        "filename": file.filename,
        "statistics": statistics,
        "storytelling": insights.model_dump(),
        "message": "AI insights generated successfully.",
    }


# --------------------------------------------------
# PDF report
# --------------------------------------------------

@app.post("/api/report")
async def download_dataset_report(
    file: UploadFile = File(...),
    classifications: str = Form(...),
    insights: str | None = Form(None),
):
    """
    Generate a PDF containing:
    - Dataset overview
    - Data quality
    - Column profiles
    - Confirmed classifications
    - Numeric and categorical statistics
    - Data visualizations
    - Existing AI insights, when provided

    No Claude request is made here.
    """

    # Read the original CSV
    dataframe = await read_csv_file(file)

    # Validate user-confirmed classifications
    confirmed_classifications = parse_classifications(
        classifications
    )

    # Recalculate deterministic statistics
    statistics = calculate_confirmed_statistics(
        dataframe,
        confirmed_classifications,
    )

    # Validate existing insights without calling Claude
    validated_insights = parse_report_insights(insights)

    # Generate the PDF in memory
    pdf_bytes = generate_report(
        dataframe=dataframe,
        filename=file.filename,
        classifications=confirmed_classifications,
        statistics=statistics,
        insights=validated_insights,
    )

    # Return the PDF as a downloadable file
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                'attachment; filename="DataTale_Report.pdf"'
            ),
            "Cache-Control": "no-store",
        },
    )