import math

import numpy as np
import pandas as pd


# Maximum number of histogram bins
MAX_HISTOGRAM_BINS = 20

# Number of bins for smaller datasets
DEFAULT_HISTOGRAM_BINS = 10


def clean_number(value):
    """Convert numeric values into JSON-safe Python numbers."""

    if value is None:
        return None

    number = float(value)

    if not math.isfinite(number):
        return None

    return number


def calculate_histogram(valid_values: pd.Series):
    """
    Calculate histogram bins using actual numeric values.

    Each bin contains:
    - start: lower boundary
    - end: upper boundary
    - count: number of observations
    """

    # Convert Pandas values into a NumPy array
    values = valid_values.to_numpy(dtype=float)

    # Handle empty numeric columns
    if len(values) == 0:
        return []

    # Handle columns where every value is identical
    if np.min(values) == np.max(values):
        value = float(values[0])

        return [
            {
                "start": value,
                "end": value,
                "count": int(len(values)),
            }
        ]

    # Choose a reasonable number of bins
    bin_count = min(
        DEFAULT_HISTOGRAM_BINS,
        max(1, int(math.sqrt(len(values)))),
        MAX_HISTOGRAM_BINS,
    )

    # Calculate histogram frequencies
    counts, bin_edges = np.histogram(
        values,
        bins=bin_count,
    )

    # Build the histogram response
    histogram = []

    for index, count in enumerate(counts):
        histogram.append(
            {
                "start": clean_number(bin_edges[index]),
                "end": clean_number(bin_edges[index + 1]),
                "count": int(count),
            }
        )

    return histogram


def calculate_boxplot(valid_values: pd.Series):
    """
    Calculate box plot statistics using the 1.5 × IQR rule.

    Whiskers extend to actual observations within the fences.
    Values outside the fences are potential outliers.
    """

    # Handle empty numeric columns
    if valid_values.empty:
        return None

    # Calculate quartiles
    q1 = float(valid_values.quantile(0.25))
    median = float(valid_values.median())
    q3 = float(valid_values.quantile(0.75))

    # Calculate the interquartile range
    iqr = q3 - q1

    # Calculate outlier boundaries
    lower_fence = q1 - 1.5 * iqr
    upper_fence = q3 + 1.5 * iqr

    # Identify potential outliers
    outlier_mask = (
        (valid_values < lower_fence)
        | (valid_values > upper_fence)
    )

    outliers = valid_values[outlier_mask]

    # Keep only observations within the fences
    non_outliers = valid_values[~outlier_mask]

    # Find actual whisker endpoints
    lower_whisker = float(non_outliers.min())
    upper_whisker = float(non_outliers.max())

    # Return box plot statistics
    return {
        "min": clean_number(valid_values.min()),
        "q1": clean_number(q1),
        "median": clean_number(median),
        "q3": clean_number(q3),
        "max": clean_number(valid_values.max()),
        "iqr": clean_number(iqr),
        "lower_whisker": clean_number(lower_whisker),
        "upper_whisker": clean_number(upper_whisker),
        "outlier_count": int(len(outliers)),
        "outliers": [
            clean_number(value)
            for value in outliers.tolist()
        ],
    }


def calculate_statistics(dataframe: pd.DataFrame, classifications: list):
    """
    Calculate statistics using user-confirmed column classifications.

    Numeric columns receive:
    - Descriptive statistics
    - Histogram bins
    - Box plot statistics

    Categorical columns receive:
    - Frequency distributions

    Skipped columns are excluded.
    """

    # Store results for all analyzed columns
    results = []

    # Ensure classifications match the dataset exactly
    expected_columns = list(dataframe.columns)

    classified_columns = [
        item["name"]
        for item in classifications
    ]

    if (
        len(classified_columns) != len(expected_columns)
        or set(classified_columns) != set(expected_columns)
    ):
        raise ValueError(
            "Classifications must contain every dataset column exactly once."
        )

    # Process columns in classification order
    for classification in classifications:
        column_name = classification["name"]
        column_type = classification["type"]

        # Reject unsupported classification types
        if column_type not in ("numeric", "categorical", "skip"):
            raise ValueError(
                f"Invalid classification type for '{column_name}'."
            )

        # Skip excluded columns
        if column_type == "skip":
            continue

        # Select the dataset column
        series = dataframe[column_name]

        # Numeric statistics
        if column_type == "numeric":

            # Convert numeric-looking values into numbers
            numeric_series = pd.to_numeric(
                series,
                errors="coerce",
            )

            # Reject nonmissing values that cannot be converted
            invalid_values = (
                series.notna()
                & numeric_series.isna()
            )

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
                        "histogram": [],
                        "boxplot": None,
                    }
                )
                continue

            # Calculate descriptive statistics
            statistics = {
                "mean": clean_number(valid_values.mean()),
                "median": clean_number(valid_values.median()),
                "min": clean_number(valid_values.min()),
                "max": clean_number(valid_values.max()),
                "std": (
                    clean_number(valid_values.std())
                    if len(valid_values) > 1
                    else None
                ),
                "p25": clean_number(
                    valid_values.quantile(0.25)
                ),
                "p75": clean_number(
                    valid_values.quantile(0.75)
                ),
            }

            # Calculate histogram bins
            histogram = calculate_histogram(valid_values)

            # Calculate box plot statistics
            boxplot = calculate_boxplot(valid_values)

            # Add numeric results
            results.append(
                {
                    "name": column_name,
                    "type": "numeric",
                    "count": int(len(valid_values)),
                    "missing_values": int(series.isna().sum()),
                    "statistics": statistics,
                    "histogram": histogram,
                    "boxplot": boxplot,
                }
            )

        # Categorical statistics
        elif column_type == "categorical":

            # Remove missing values
            valid_values = series.dropna()

            # Count category occurrences
            counts = valid_values.value_counts()

            # Calculate percentages
            total = len(valid_values)

            frequencies = []

            for value, count in counts.items():
                frequencies.append(
                    {
                        "value": str(value),
                        "count": int(count),
                        "percentage": round(
                            (count / total) * 100,
                            2,
                        ),
                    }
                )

            # Add categorical results
            results.append(
                {
                    "name": column_name,
                    "type": "categorical",
                    "count": int(total),
                    "missing_values": int(series.isna().sum()),
                    "unique_categories": int(
                        valid_values.nunique()
                    ),
                    "mode": (
                        str(counts.index[0])
                        if not counts.empty
                        else None
                    ),
                    "frequencies": frequencies,
                }
            )

    # Return the complete statistics response
    return {
        "total_rows": int(len(dataframe)),
        "analyzed_columns": len(results),
        "results": results,
    }