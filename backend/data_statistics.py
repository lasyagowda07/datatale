import math

import pandas as pd


def calculate_statistics(dataframe: pd.DataFrame, classifications: list):
    """
    Calculate statistics using user-confirmed column classifications.

    Numeric columns receive descriptive statistics.
    Categorical columns receive frequency distributions.
    Skipped columns are excluded.
    """

    # Store the results for all analyzed columns
    results = []

    # Ensure classifications match the dataset exactly
    expected_columns = list(dataframe.columns)
    classified_columns = [item["name"] for item in classifications]

    if (
        len(classified_columns) != len(expected_columns)
        or set(classified_columns) != set(expected_columns)
    ):
        raise ValueError(
            "Classifications must contain every dataset column exactly once."
        )

    # Process columns in the supplied classification order
    for classification in classifications:
        column_name = classification["name"]
        column_type = classification["type"]

        # Reject unsupported classification types
        if column_type not in ("numeric", "categorical", "skip"):
            raise ValueError(
                f"Invalid classification type for '{column_name}'."
            )

        # Skip identifiers and excluded columns
        if column_type == "skip":
            continue

        # Select the column
        series = dataframe[column_name]

        # Calculate numeric statistics
        if column_type == "numeric":
            # Convert numeric-looking values into numbers
            numeric_series = pd.to_numeric(series, errors="coerce")

            # Reject nonmissing values that cannot be converted
            invalid_values = series.notna() & numeric_series.isna()

            if invalid_values.any():
                raise ValueError(
                    f"Column '{column_name}' contains values "
                    "that cannot be analyzed as numbers."
                )

            # Remove missing values
            valid_values = numeric_series.dropna()

            # Handle entirely missing numeric columns
            if valid_values.empty:
                results.append(
                    {
                        "name": column_name,
                        "type": "numeric",
                        "count": 0,
                        "missing_values": int(series.isna().sum()),
                        "statistics": None,
                    }
                )
                continue

            # Calculate descriptive statistics
            statistics = {
                "mean": float(valid_values.mean()),
                "median": float(valid_values.median()),
                "min": float(valid_values.min()),
                "max": float(valid_values.max()),
                "std": (
                    float(valid_values.std())
                    if len(valid_values) > 1
                    else None
                ),
                "p25": float(valid_values.quantile(0.25)),
                "p75": float(valid_values.quantile(0.75)),
            }

            # Replace non-finite results with null
            statistics = {
                key: value if math.isfinite(value) else None
                for key, value in statistics.items()
            }

            results.append(
                {
                    "name": column_name,
                    "type": "numeric",
                    "count": int(len(valid_values)),
                    "missing_values": int(series.isna().sum()),
                    "statistics": statistics,
                }
            )

        # Calculate categorical statistics
        elif column_type == "categorical":
            # Remove missing values
            valid_values = series.dropna()

            # Count category occurrences
            counts = valid_values.value_counts()

            # Calculate percentages from nonmissing values
            total = len(valid_values)

            frequencies = []

            for value, count in counts.items():
                frequencies.append(
                    {
                        "value": str(value),
                        "count": int(count),
                        "percentage": round(
                            (count / total) * 100, 2
                        ),
                    }
                )

            results.append(
                {
                    "name": column_name,
                    "type": "categorical",
                    "count": int(total),
                    "missing_values": int(series.isna().sum()),
                    "unique_categories": int(valid_values.nunique()),
                    "mode": (
                        str(counts.index[0])
                        if not counts.empty
                        else None
                    ),
                    "frequencies": frequencies,
                }
            )

    return {
        "total_rows": int(len(dataframe)),
        "analyzed_columns": len(results),
        "results": results,
    }