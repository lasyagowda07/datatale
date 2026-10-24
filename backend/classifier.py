import json
import os
from pathlib import Path
from typing import Literal

import pandas as pd
from anthropic import Anthropic
from dotenv import load_dotenv
from pydantic import BaseModel, Field


# Load environment variables from backend/.env
load_dotenv(Path(__file__).resolve().parent / ".env")


# Define the expected structure of Claude's response
class ColumnClassification(BaseModel):
    name: str
    type: Literal["numeric", "categorical", "skip"]
    confidence: float = Field(ge=0, le=1)


class ClassificationResponse(BaseModel):
    columns: list[ColumnClassification]


def classify_columns(dataframe: pd.DataFrame) -> ClassificationResponse:
    """Classify dataset columns using Claude."""

    # Collect metadata for each column
    column_metadata = []

    for column in dataframe.columns:
        series = dataframe[column]

        # Get up to five unique, nonmissing sample values
        sample_values = (
            series.dropna()
            .astype(str)
            .drop_duplicates()
            .head(5)
            .tolist()
        )

        column_metadata.append(
            {
                "name": column,
                "pandas_type": str(series.dtype),
                "unique_values": int(series.nunique(dropna=True)),
                "missing_values": int(series.isna().sum()),
                "sample_values": sample_values,
            }
        )

    # Tell Claude how to classify the dataset
    system_prompt = """
You are a data analyst specializing in semantic column classification.

Classify every dataset column into exactly one of these types:

1. numeric:
   A meaningful numerical measurement where arithmetic statistics
   such as mean, median, min, max, and standard deviation are appropriate.

2. categorical:
   A variable representing categories, groups, labels, or binary flags.
   Suitable for frequency counts and percentages.

3. skip:
   Identifiers, postal codes, record IDs, or columns unsuitable for
   basic descriptive statistical analysis.

Important rules:
- Do not classify identifiers as numeric measurements.
- ZIP codes and postal codes should be classified as skip.
- Binary flags such as 0/1 should generally be categorical.
- Dates should be classified as skip for now.
- Consider column names, data types, sample values, and dataset context.
- Return exactly one classification for every input column.
- Preserve original column names exactly.
- Confidence must be between 0 and 1.
- If unsure, use a lower confidence score.
- Return only valid JSON with no Markdown formatting.

Expected JSON format:
{
  "columns": [
    {
      "name": "ColumnName",
      "type": "numeric",
      "confidence": 0.95
    }
  ]
}
"""

    # Initialize the Claude API client
    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Send column metadata to Claude
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=2048,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "row_count": len(dataframe),
                        "columns": column_metadata,
                    }
                ),
            }
        ],
    )

    # Extract the text returned by Claude
    # Extract Claude's response

    response_text = response.content[0].text.strip()

    # Remove Markdown code fences if Claude includes them

    if response_text.startswith("```"):

        response_text = response_text.split("\n", 1)[1]

    if response_text.endswith("```"):

        response_text = response_text[:-3]

    # Remove any remaining whitespace

    response_text = response_text.strip()

    # Validate the cleaned JSON using Pydantic

    classification = ClassificationResponse.model_validate_json(

        response_text

    )

    # Verify that every dataset column was classified exactly once
    expected_columns = list(dataframe.columns)
    returned_columns = [
        column.name for column in classification.columns
    ]

    if (
        len(returned_columns) != len(expected_columns)
        or set(returned_columns) != set(expected_columns)
    ):
        raise ValueError(
            "Claude did not return exactly one classification for every column."
        )

    # Return the validated classifications
    return classification