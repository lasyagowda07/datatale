import math

from backend.insight_models import InsightResponse


def values_match(expected, actual: str) -> bool:
    """Compare Claude's evidence against a calculated value."""

    # Compare numeric values with a small rounding tolerance
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        try:
            actual_number = float(actual)

            return math.isclose(
                float(expected),
                actual_number,
                rel_tol=1e-5,
                abs_tol=1e-6,
            )
        except (ValueError, TypeError):
            return False

    # Compare text values exactly
    return str(expected) == actual


def get_expected_value(column: dict, metric: str):
    """Find the real statistic referenced by Claude."""

    # Shared statistics
    if metric in {"count", "missing_values"}:
        return column.get(metric)

    # Numeric statistics
    if column["type"] == "numeric":
        numeric_stats = column.get("statistics") or {}

        return numeric_stats.get(metric)

    # Categorical statistics
    if column["type"] == "categorical":

        if metric in {"unique_categories", "mode"}:
            return column.get(metric)

        # Support metrics like count (NY)
        if metric.startswith("count (") and metric.endswith(")"):
            category_name = metric[7:-1]

            for item in column.get("frequencies", []):
                if item["value"] == category_name:
                    return item["count"]

        # Support metrics like percentage (NY)
        if metric.startswith("percentage (") and metric.endswith(")"):
            category_name = metric[12:-1]

            for item in column.get("frequencies", []):
                if item["value"] == category_name:
                    return item["percentage"]

    return None


def validate_evidence(
    insights: InsightResponse,
    statistics: dict,
) -> None:
    """Reject insights containing unsupported statistical evidence."""

    # Index statistics by column name
    columns = {
        column["name"]: column
        for column in statistics.get("results", [])
    }

    for insight in insights.insights:
        for evidence in insight.evidence:

            # Check that the column exists
            if evidence.column not in columns:
                raise ValueError(
                    f"Unknown evidence column: {evidence.column}"
                )

            # Look up the referenced statistic
            expected = get_expected_value(
                columns[evidence.column],
                evidence.metric,
            )

            # Reject missing or unsupported metrics
            if expected is None:
                raise ValueError(
                    f"Unknown evidence metric: "
                    f"{evidence.column}.{evidence.metric}"
                )

            # Compare Claude's value with Pandas
            if not values_match(expected, evidence.value):
                raise ValueError(
                    f"Incorrect evidence for "
                    f"{evidence.column}.{evidence.metric}: "
                    f"expected {expected}, got {evidence.value}"
                )