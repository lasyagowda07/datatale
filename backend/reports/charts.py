import math

from reportlab.graphics.shapes import (
    Drawing,
    Rect,
    String,
    Line,
    Circle,
    Wedge,
)
from reportlab.lib import colors


# --------------------------------------------------
# Chart colors
# --------------------------------------------------

BLUE = colors.HexColor("#2563EB")
PURPLE = colors.HexColor("#8B5CF6")
GREEN = colors.HexColor("#10B981")
AMBER = colors.HexColor("#F59E0B")
PINK = colors.HexColor("#EC4899")
CYAN = colors.HexColor("#06B6D4")

DARK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
GRID = colors.HexColor("#E2E8F0")
WHITE = colors.white

PALETTE = [
    BLUE,
    PURPLE,
    GREEN,
    AMBER,
    PINK,
    CYAN,
]


# --------------------------------------------------
# Formatting helpers
# --------------------------------------------------

def format_number(value):
    """Format numbers for chart labels."""

    if value is None:
        return "N/A"

    if not math.isfinite(float(value)):
        return "N/A"

    return f"{value:,.3f}".rstrip("0").rstrip(".")


def shorten_text(value, max_length=30):
    """Shorten long labels without changing their data."""

    text = str(value)

    if len(text) <= max_length:
        return text

    return text[: max_length - 3] + "..."


# --------------------------------------------------
# Categorical bar chart
# --------------------------------------------------

def create_bar_chart(frequencies):
    """
    Create a horizontal bar chart showing category counts.

    Display the 8 most frequent categories.
    """

    chart_width = 500
    row_height = 34

    # Keep the chart readable when categories are numerous
    displayed = frequencies[:8]

    chart_height = max(110, len(displayed) * row_height + 65)

    drawing = Drawing(chart_width, chart_height)

    if not displayed:
        return drawing

    max_count = max(item["count"] for item in displayed)

    if max_count <= 0:
        return drawing

    label_width = 205
    bar_start = 215
    bar_max_width = 230

    for index, item in enumerate(displayed):
        y = chart_height - 55 - index * row_height

        label = shorten_text(item["value"], 33)

        drawing.add(
            String(
                0,
                y + 5,
                label,
                fontName="Helvetica",
                fontSize=8,
                fillColor=DARK,
            )
        )

        # Background bar
        drawing.add(
            Rect(
                bar_start,
                y,
                bar_max_width,
                16,
                fillColor=GRID,
                strokeColor=None,
            )
        )

        # Actual count bar
        actual_width = (
            item["count"] / max_count
        ) * bar_max_width

        drawing.add(
            Rect(
                bar_start,
                y,
                actual_width,
                16,
                fillColor=BLUE,
                strokeColor=None,
            )
        )

        drawing.add(
            String(
                bar_start + bar_max_width + 8,
                y + 4,
                str(item["count"]),
                fontName="Helvetica-Bold",
                fontSize=9,
                fillColor=DARK,
            )
        )

    return drawing


# --------------------------------------------------
# Categorical donut chart
# --------------------------------------------------

def create_donut_chart(frequencies):
    """
    Create a donut chart showing category proportions.

    The six largest categories are displayed separately.
    Remaining categories are grouped as Other.
    """

    drawing = Drawing(500, 255)

    if not frequencies:
        return drawing

    total = sum(item["count"] for item in frequencies)

    if total <= 0:
        return drawing

    displayed = list(frequencies[:6])

    remaining_count = sum(
        item["count"]
        for item in frequencies[6:]
    )

    if remaining_count > 0:
        displayed.append(
            {
                "value": "Other",
                "count": remaining_count,
            }
        )

    center_x = 115
    center_y = 125
    outer_radius = 95
    inner_radius = 54

    current_angle = 90

    for index, item in enumerate(displayed):
        proportion = item["count"] / total

        sweep_angle = proportion * 360

        # Avoid zero-sized wedges
        if sweep_angle <= 0:
            continue

        color = PALETTE[index % len(PALETTE)]

        drawing.add(
            Wedge(
                center_x,
                center_y,
                outer_radius,
                current_angle,
                current_angle + sweep_angle,
                fillColor=color,
                strokeColor=WHITE,
                strokeWidth=1,
            )
        )

        current_angle += sweep_angle

    # Cover the center to create the donut effect
    drawing.add(
        Circle(
            center_x,
            center_y,
            inner_radius,
            fillColor=WHITE,
            strokeColor=WHITE,
        )
    )

    drawing.add(
        String(
            center_x,
            center_y + 5,
            str(total),
            textAnchor="middle",
            fontName="Helvetica-Bold",
            fontSize=19,
            fillColor=DARK,
        )
    )

    drawing.add(
        String(
            center_x,
            center_y - 14,
            "Valid values",
            textAnchor="middle",
            fontName="Helvetica",
            fontSize=9,
            fillColor=MUTED,
        )
    )

    # Add a legend
    legend_x = 240

    for index, item in enumerate(displayed):
        y = 215 - index * 29

        color = PALETTE[index % len(PALETTE)]

        drawing.add(
            Rect(
                legend_x,
                y,
                11,
                11,
                fillColor=color,
                strokeColor=None,
            )
        )

        percentage = (item["count"] / total) * 100

        label = shorten_text(item["value"], 27)

        drawing.add(
            String(
                legend_x + 19,
                y + 2,
                label,
                fontName="Helvetica",
                fontSize=8,
                fillColor=DARK,
            )
        )

        drawing.add(
            String(
                legend_x + 19,
                y - 11,
                f"{percentage:.1f}%",
                fontName="Helvetica",
                fontSize=8,
                fillColor=MUTED,
            )
        )

    return drawing


# --------------------------------------------------
# Numeric histogram
# --------------------------------------------------

def create_histogram(histogram):
    """Create a histogram from Pandas-calculated bins."""

    drawing = Drawing(500, 260)

    if not histogram:
        return drawing

    plot_x = 55
    plot_y = 45

    plot_width = 420
    plot_height = 180

    max_count = max(
        item["count"]
        for item in histogram
    )

    if max_count <= 0:
        return drawing

    # Horizontal gridlines
    for index in range(5):
        fraction = index / 4

        y = plot_y + fraction * plot_height

        drawing.add(
            Line(
                plot_x,
                y,
                plot_x + plot_width,
                y,
                strokeColor=GRID,
                strokeWidth=0.7,
            )
        )

        drawing.add(
            String(
                plot_x - 9,
                y - 3,
                str(round(max_count * fraction)),
                textAnchor="end",
                fontName="Helvetica",
                fontSize=8,
                fillColor=MUTED,
            )
        )

    bin_count = len(histogram)

    bar_width = plot_width / bin_count

    for index, item in enumerate(histogram):
        count = item["count"]

        height = (
            count / max_count
        ) * plot_height

        x = plot_x + index * bar_width

        drawing.add(
            Rect(
                x + 1,
                plot_y,
                max(1, bar_width - 2),
                height,
                fillColor=BLUE,
                strokeColor=WHITE,
                strokeWidth=0.5,
            )
        )

    # Minimum and maximum labels
    drawing.add(
        String(
            plot_x,
            25,
            format_number(histogram[0]["start"]),
            fontName="Helvetica",
            fontSize=8,
            fillColor=MUTED,
        )
    )

    drawing.add(
        String(
            plot_x + plot_width,
            25,
            format_number(histogram[-1]["end"]),
            textAnchor="end",
            fontName="Helvetica",
            fontSize=8,
            fillColor=MUTED,
        )
    )

    drawing.add(
        String(
            plot_x + plot_width / 2,
            7,
            "Value range",
            textAnchor="middle",
            fontName="Helvetica",
            fontSize=9,
            fillColor=MUTED,
        )
    )

    return drawing


# --------------------------------------------------
# Numeric box plot
# --------------------------------------------------

def create_box_plot(boxplot):
    """Create a horizontal box plot using calculated quartiles."""

    drawing = Drawing(500, 180)

    if not boxplot:
        return drawing

    minimum = boxplot["min"]
    maximum = boxplot["max"]

    if minimum is None or maximum is None:
        return drawing

    q1 = boxplot["q1"]
    median = boxplot["median"]
    q3 = boxplot["q3"]

    lower_whisker = boxplot["lower_whisker"]
    upper_whisker = boxplot["upper_whisker"]

    if any(
        value is None
        for value in (
            q1,
            median,
            q3,
            lower_whisker,
            upper_whisker,
        )
    ):
        return drawing

    plot_left = 45
    plot_right = 455

    center_y = 105

    # Add padding around the data range
    data_range = maximum - minimum

    padding = (
        data_range * 0.08
        if data_range > 0
        else max(abs(minimum) * 0.08, 0.5)
    )

    axis_min = minimum - padding
    axis_max = maximum + padding

    def scale(value):
        return (
            plot_left
            + (value - axis_min)
            / (axis_max - axis_min)
            * (plot_right - plot_left)
        )

    # Whisker line
    drawing.add(
        Line(
            scale(lower_whisker),
            center_y,
            scale(upper_whisker),
            center_y,
            strokeColor=DARK,
            strokeWidth=2,
        )
    )

    # Whisker caps
    for value in (lower_whisker, upper_whisker):
        x = scale(value)

        drawing.add(
            Line(
                x,
                center_y - 17,
                x,
                center_y + 17,
                strokeColor=DARK,
                strokeWidth=2,
            )
        )

    # Interquartile box
    box_left = scale(q1)
    box_right = scale(q3)

    drawing.add(
        Rect(
            box_left,
            center_y - 22,
            max(box_right - box_left, 1),
            44,
            fillColor=colors.HexColor("#DBEAFE"),
            strokeColor=BLUE,
            strokeWidth=2,
        )
    )

    # Median line
    median_x = scale(median)

    drawing.add(
        Line(
            median_x,
            center_y - 24,
            median_x,
            center_y + 24,
            strokeColor=PURPLE,
            strokeWidth=2.5,
        )
    )

    # Display outlier points
    for value in boxplot.get("outliers", []):
        drawing.add(
            Circle(
                scale(value),
                center_y,
                3.5,
                fillColor=AMBER,
                strokeColor=None,
            )
        )

    # Axis
    drawing.add(
        Line(
            plot_left,
            50,
            plot_right,
            50,
            strokeColor=GRID,
            strokeWidth=1,
        )
    )

    for index in range(5):
        value = axis_min + (
            (axis_max - axis_min) * index / 4
        )

        x = scale(value)

        drawing.add(
            Line(
                x,
                46,
                x,
                54,
                strokeColor=MUTED,
                strokeWidth=0.7,
            )
        )

        drawing.add(
            String(
                x,
                31,
                format_number(value),
                textAnchor="middle",
                fontName="Helvetica",
                fontSize=8,
                fillColor=MUTED,
            )
        )

    drawing.add(
        String(
            250,
            155,
            f"Outliers: {boxplot.get('outlier_count', 0)}",
            textAnchor="middle",
            fontName="Helvetica",
            fontSize=9,
            fillColor=MUTED,
        )
    )

    return drawing