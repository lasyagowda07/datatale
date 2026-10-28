from insight_models import InsightResponse


# Simulate a structured response from Claude
sample_response = {
    "dataset_summary": (
        "This dataset contains 70 ZIP-to-CBSA allocation records."
    ),
    "insights": [
        {
            "title": "High ZIP-CBSA allocation shares",
            "finding": (
                "The median ZIP-CBSA share is 1.0."
            ),
            "evidence": [
                {
                    "column": "zip_cbsa_share",
                    "metric": "median",
                    "value": "1.0",
                }
            ],
            "interpretation": (
                "Many records may represent full allocation shares."
            ),
            "caveat": (
                "The dataset may contain multiple records per ZIP."
            ),
            "severity": "interesting",
        }
    ],
    "overall_caveats": [
        "The dataset contains 70 records and may not represent all ZIP codes."
    ],
}


# Validate the response using Pydantic
result = InsightResponse.model_validate(sample_response)

# Display the validated response
print(result.model_dump_json(indent=2))