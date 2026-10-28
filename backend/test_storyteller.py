from backend.storyteller import generate_insights


# Use statistics similar to our previously tested dataset
sample_statistics = {
    "total_rows": 70,
    "analyzed_columns": 2,
    "results": [
        {
            "name": "zip_cbsa_share",
            "type": "numeric",
            "count": 70,
            "missing_values": 0,
            "statistics": {
                "mean": 0.942857,
                "median": 1.0,
                "min": 0.003,
                "max": 1.0,
                "std": 0.22767,
                "p25": 1.0,
                "p75": 1.0,
            },
        },
        {
            "name": "cbsa_name",
            "type": "categorical",
            "count": 66,
            "missing_values": 4,
            "unique_categories": 10,
            "mode": "Tampa-St. Petersburg-Clearwater, FL",
            "frequencies": [
                {
                    "value": "Tampa-St. Petersburg-Clearwater, FL",
                    "count": 8,
                    "percentage": 12.12,
                },
                {
                    "value": "New York, NY-NJ-PA",
                    "count": 7,
                    "percentage": 10.61,
                },
            ],
        },
    ],
}


# Generate insights using Claude
result = generate_insights(sample_statistics)

# Print validated JSON
print(result.model_dump_json(indent=2))