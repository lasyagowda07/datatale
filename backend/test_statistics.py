import json

import pandas as pd

from data_statistics import calculate_statistics


# Create a small dataset with different column types
dataframe = pd.DataFrame(
    {
        "LoanID": ["L001", "L002", "L003", "L004", "L005"],
        "MortgageAmount": [250000, 300000, 275000, 400000, None],
        "State": ["NY", "CA", "NY", "MA", "NY"],
        "DPA_Flag": [0, 1, 0, 1, 1],
        "InterestRate": [6.5, 7.0, 6.75, 7.25, 6.8],
    }
)

# Simulate classifications approved by the user
classifications = [
    {"name": "LoanID", "type": "skip"},
    {"name": "MortgageAmount", "type": "numeric"},
    {"name": "State", "type": "categorical"},
    {"name": "DPA_Flag", "type": "categorical"},
    {"name": "InterestRate", "type": "numeric"},
]

# Run the statistics engine
result = calculate_statistics(dataframe, classifications)

# Print formatted JSON
print(json.dumps(result, indent=2))