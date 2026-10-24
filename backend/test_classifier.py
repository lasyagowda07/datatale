from pathlib import Path

import pandas as pd

from classifier import classify_columns


# Create a small sample dataset
dataframe = pd.DataFrame(
    {
        "LoanID": ["L001", "L002", "L003", "L004"],
        "PropertyZip": ["02108", "10001", "90210", "60601"],
        "MortgageAmount": [250000, 300000, 275000, 400000],
        "DPA_Flag": [0, 1, 0, 1],
        "State": ["MA", "NY", "CA", "IL"],
        "InterestRate": [6.5, 7.0, 6.75, 7.25],
    }
)

# Ask Claude to classify the columns
result = classify_columns(dataframe)

# Display the classifications
print("\nDataTale AI Column Classification\n")

for column in result.columns:
    review = "REVIEW" if column.confidence < 0.85 else "AUTO-APPROVED"

    print(
        f"{column.name:20} "
        f"{column.type:15} "
        f"{column.confidence:.0%} "
        f"{review}"
    )