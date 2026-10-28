from datetime import datetime, timezone
from io import BytesIO
from xml.sax.saxutils import escape

import pandas as pd

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4

from reportlab.lib.styles import (
    getSampleStyleSheet,
    ParagraphStyle,
)

from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    PageBreak,
)

from backend.reports.charts import (
    create_bar_chart,
    create_donut_chart,
    create_histogram,
    create_box_plot,
)


# --------------------------------------------------
# Colors
# --------------------------------------------------

PRIMARY = colors.HexColor("#2563EB")
DARK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
LIGHT = colors.HexColor("#F1F5F9")
BORDER = colors.HexColor("#E2E8F0")

PURPLE = colors.HexColor("#7C3AED")
AMBER = colors.HexColor("#D97706")


# --------------------------------------------------
# Typography
# --------------------------------------------------

def create_styles():
    styles = getSampleStyleSheet()

    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            fontName="Helvetica-Bold",
            fontSize=25,
            leading=32,
            textColor=DARK,
            alignment=TA_CENTER,
            spaceAfter=14,
        )
    )

    styles.add(
        ParagraphStyle(
            name="ReportSubtitle",
            fontName="Helvetica",
            fontSize=11,
            leading=17,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceAfter=12,
        )
    )

    styles.add(
        ParagraphStyle(
            name="SectionHeading",
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=21,
            textColor=DARK,
            alignment=TA_LEFT,
            spaceBefore=18,
            spaceAfter=12,
            keepWithNext=True,
        )
    )

    styles.add(
        ParagraphStyle(
            name="ColumnHeading",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=16,
            textColor=DARK,
            spaceBefore=14,
            spaceAfter=8,
            keepWithNext=True,
        )
    )

    styles.add(
        ParagraphStyle(
            name="ReportBody",
            fontName="Helvetica",
            fontSize=10,
            leading=16,
            textColor=DARK,
            spaceAfter=8,
        )
    )

    styles.add(
        ParagraphStyle(
            name="ReportSmall",
            fontName="Helvetica",
            fontSize=9,
            leading=14,
            textColor=MUTED,
            spaceAfter=8,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TableHeaderText",
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=13,
            textColor=colors.white,
        )
    )

    styles.add(
        ParagraphStyle(
            name="TableCellText",
            fontName="Helvetica",
            fontSize=9,
            leading=13,
            textColor=DARK,
            wordWrap="CJK",
        )
    )

    styles.add(
        ParagraphStyle(
            name="InsightHeading",
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=18,
            textColor=PURPLE,
            spaceBefore=14,
            spaceAfter=9,
            keepWithNext=True,
        )
    )

    styles.add(
        ParagraphStyle(
            name="InsightLabel",
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=14,
            textColor=MUTED,
            spaceBefore=9,
            spaceAfter=5,
            keepWithNext=True,
        )
    )

    return styles


# --------------------------------------------------
# Formatting helpers
# --------------------------------------------------

def format_number(value):
    if value is None:
        return "N/A"

    if isinstance(value, (int, float)):
        return f"{value:,.4f}".rstrip("0").rstrip(".")

    return str(value)


def safe_text(value):
    return escape(str(value))


# --------------------------------------------------
# Tables
# --------------------------------------------------

def create_table(headers, rows, column_widths, styles):
    header_cells = [
        Paragraph(
            safe_text(header),
            styles["TableHeaderText"],
        )
        for header in headers
    ]

    body_rows = []

    for row in rows:
        body_rows.append(
            [
                Paragraph(
                    safe_text(value),
                    styles["TableCellText"],
                )
                for value in row
            ]
        )

    table = Table(
        [header_cells] + body_rows,
        colWidths=column_widths,
        repeatRows=1,
        hAlign="LEFT",
    )

    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, LIGHT],
                ),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                (
                    "LINEBELOW",
                    (0, 0),
                    (-1, 0),
                    0.5,
                    PRIMARY,
                ),
                (
                    "LINEBELOW",
                    (0, 1),
                    (-1, -1),
                    0.3,
                    BORDER,
                ),
            ]
        )
    )

    return table


# --------------------------------------------------
# Page footer
# --------------------------------------------------

def add_page_footer(canvas, document):
    canvas.saveState()

    width, _ = A4

    canvas.setStrokeColor(BORDER)
    canvas.line(45, 48, width - 45, 48)

    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)

    canvas.drawString(
        45,
        34,
        "DataTale | AI Data Storytelling Studio",
    )

    canvas.drawRightString(
        width - 45,
        34,
        f"Page {document.page}",
    )

    canvas.restoreState()


# --------------------------------------------------
# Dataset overview and data quality
# --------------------------------------------------

def add_dataset_overview(story, dataframe, styles):
    total_rows = int(len(dataframe))
    total_columns = int(len(dataframe.columns))

    duplicate_rows = int(dataframe.duplicated().sum())
    total_missing = int(dataframe.isna().sum().sum())

    story.append(
        Paragraph(
            "1. Dataset Overview",
            styles["SectionHeading"],
        )
    )

    overview_rows = [
        ["Total Rows", f"{total_rows:,}"],
        ["Total Columns", f"{total_columns:,}"],
        ["Missing Values", f"{total_missing:,}"],
        ["Duplicate Rows", f"{duplicate_rows:,}"],
    ]

    story.append(
        create_table(
            headers=["Metric", "Value"],
            rows=overview_rows,
            column_widths=[250, 255],
            styles=styles,
        )
    )

    story.append(Spacer(1, 12))

    story.append(
        Paragraph(
            "2. Data Quality",
            styles["SectionHeading"],
        )
    )

    total_cells = total_rows * total_columns

    missing_percentage = (
        (total_missing / total_cells) * 100
        if total_cells > 0
        else 0
    )

    story.append(
        Paragraph(
            (
                f"The dataset contains <b>{total_missing:,}</b> "
                f"missing values across {total_cells:,} cells "
                f"({missing_percentage:.2f}%). "
                f"There are <b>{duplicate_rows:,}</b> duplicate rows."
            ),
            styles["ReportBody"],
        )
    )

    story.append(Spacer(1, 10))


# --------------------------------------------------
# Column profiles
# --------------------------------------------------

def add_column_profiles(story, dataframe, styles):
    story.append(
        Paragraph(
            "3. Column Profiles",
            styles["SectionHeading"],
        )
    )

    profile_rows = []

    for column_name in dataframe.columns:
        column = dataframe[column_name]

        profile_rows.append(
            [
                str(column_name),
                str(column.dtype),
                str(int(column.isna().sum())),
                str(int(column.nunique(dropna=True))),
            ]
        )

    story.append(
        create_table(
            headers=[
                "Column",
                "Data Type",
                "Missing",
                "Unique",
            ],
            rows=profile_rows,
            column_widths=[180, 110, 95, 120],
            styles=styles,
        )
    )

    story.append(Spacer(1, 12))


# --------------------------------------------------
# Confirmed classifications
# --------------------------------------------------

def add_classifications(story, classifications, styles):
    story.append(
        Paragraph(
            "4. Column Classifications",
            styles["SectionHeading"],
        )
    )

    story.append(
        Paragraph(
            (
                "The following classifications were confirmed "
                "before statistical analysis."
            ),
            styles["ReportBody"],
        )
    )

    classification_rows = []

    for classification in classifications:
        column_type = classification["type"]

        classification_rows.append(
            [
                classification["name"],
                column_type.capitalize(),
                (
                    "Excluded"
                    if column_type == "skip"
                    else "Analyzed"
                ),
            ]
        )

    story.append(
        create_table(
            headers=[
                "Column",
                "Classification",
                "Status",
            ],
            rows=classification_rows,
            column_widths=[205, 150, 150],
            styles=styles,
        )
    )

    story.append(Spacer(1, 12))


# --------------------------------------------------
# Numeric statistics
# --------------------------------------------------

def add_numeric_statistics(story, statistics, styles):
    numeric_columns = [
        result
        for result in statistics["results"]
        if result["type"] == "numeric"
    ]

    story.append(
        Paragraph(
            "5. Numeric Statistical Analysis",
            styles["SectionHeading"],
        )
    )

    if not numeric_columns:
        story.append(
            Paragraph(
                "No numeric columns were selected for analysis.",
                styles["ReportBody"],
            )
        )
        return

    for column in numeric_columns:
        story.append(
            Paragraph(
                safe_text(column["name"]),
                styles["ColumnHeading"],
            )
        )

        story.append(
            Paragraph(
                (
                    f"Valid values: {column['count']:,} | "
                    f"Missing values: {column['missing_values']:,}"
                ),
                styles["ReportSmall"],
            )
        )

        values = column["statistics"]

        if values is None:
            story.append(
                Paragraph(
                    "No valid numeric values are available.",
                    styles["ReportBody"],
                )
            )
            continue

        numeric_rows = [
            ["Mean", format_number(values["mean"])],
            ["Median", format_number(values["median"])],
            ["Minimum", format_number(values["min"])],
            ["Maximum", format_number(values["max"])],
            [
                "Standard Deviation",
                format_number(values["std"]),
            ],
            [
                "25th Percentile",
                format_number(values["p25"]),
            ],
            [
                "75th Percentile",
                format_number(values["p75"]),
            ],
        ]

        story.append(
            create_table(
                headers=["Statistic", "Value"],
                rows=numeric_rows,
                column_widths=[250, 255],
                styles=styles,
            )
        )

        story.append(Spacer(1, 12))


# --------------------------------------------------
# Categorical statistics
# --------------------------------------------------

def add_categorical_statistics(story, statistics, styles):
    categorical_columns = [
        result
        for result in statistics["results"]
        if result["type"] == "categorical"
    ]

    story.append(
        Paragraph(
            "6. Categorical Statistical Analysis",
            styles["SectionHeading"],
        )
    )

    if not categorical_columns:
        story.append(
            Paragraph(
                "No categorical columns were selected for analysis.",
                styles["ReportBody"],
            )
        )
        return

    for column in categorical_columns:
        story.append(
            Paragraph(
                safe_text(column["name"]),
                styles["ColumnHeading"],
            )
        )

        story.append(
            Paragraph(
                (
                    f"Valid values: {column['count']:,} | "
                    f"Missing values: {column['missing_values']:,} | "
                    f"Unique categories: {column['unique_categories']:,}"
                ),
                styles["ReportSmall"],
            )
        )

        story.append(
            Paragraph(
                (
                    "<b>Most common category:</b> "
                    f"{safe_text(column['mode'] or 'N/A')}"
                ),
                styles["ReportBody"],
            )
        )

        frequencies = column["frequencies"]

        if not frequencies:
            story.append(
                Paragraph(
                    "No valid categorical values are available.",
                    styles["ReportBody"],
                )
            )
            continue

        frequency_rows = [
            [
                frequency["value"],
                f"{frequency['count']:,}",
                f"{frequency['percentage']:.2f}%",
            ]
            for frequency in frequencies
        ]

        story.append(
            create_table(
                headers=[
                    "Category",
                    "Count",
                    "Percentage",
                ],
                rows=frequency_rows,
                column_widths=[305, 90, 110],
                styles=styles,
            )
        )

        story.append(Spacer(1, 12))


# --------------------------------------------------
# Data visualizations
# --------------------------------------------------

def add_visualizations(story, statistics, styles):
    story.append(
        Paragraph(
            "7. Data Visualizations",
            styles["SectionHeading"],
        )
    )

    story.append(
        Paragraph(
            (
                "These charts visualize statistical distributions "
                "calculated from the uploaded dataset. "
                "All chart values come from Pandas and NumPy."
            ),
            styles["ReportBody"],
        )
    )

    story.append(Spacer(1, 8))

    for result in statistics["results"]:
        column_name = result["name"]

        # Categorical charts
        if result["type"] == "categorical":
            frequencies = result.get("frequencies", [])

            if not frequencies:
                continue

            story.append(
                Paragraph(
                    safe_text(column_name),
                    styles["ColumnHeading"],
                )
            )

            story.append(
                KeepTogether(
                    [
                        Paragraph(
                            "Category Counts",
                            styles["ReportBody"],
                        ),
                        create_bar_chart(frequencies),
                    ]
                )
            )

            story.append(Spacer(1, 14))

            story.append(
                KeepTogether(
                    [
                        Paragraph(
                            "Category Distribution",
                            styles["ReportBody"],
                        ),
                        create_donut_chart(frequencies),
                    ]
                )
            )

            story.append(
                Paragraph(
                    (
                        "The donut chart displays the six most "
                        "frequent categories separately. "
                        "Remaining categories are grouped as Other."
                    ),
                    styles["ReportSmall"],
                )
            )

            story.append(Spacer(1, 20))

        # Numeric charts
        elif result["type"] == "numeric":
            histogram = result.get("histogram", [])
            boxplot = result.get("boxplot")

            if not histogram and not boxplot:
                continue

            story.append(
                Paragraph(
                    safe_text(column_name),
                    styles["ColumnHeading"],
                )
            )

            if histogram:
                story.append(
                    KeepTogether(
                        [
                            Paragraph(
                                "Histogram",
                                styles["ReportBody"],
                            ),
                            create_histogram(histogram),
                        ]
                    )
                )

                story.append(
                    Paragraph(
                        (
                            "The histogram shows how numeric values "
                            "are distributed across calculated ranges."
                        ),
                        styles["ReportSmall"],
                    )
                )

                story.append(Spacer(1, 14))

            if boxplot:
                story.append(
                    KeepTogether(
                        [
                            Paragraph(
                                "Box Plot",
                                styles["ReportBody"],
                            ),
                            create_box_plot(boxplot),
                        ]
                    )
                )

                story.append(
                    Paragraph(
                        (
                            "The box plot displays the median, "
                            "quartiles, whiskers, and potential "
                            "outliers using the calculated statistics."
                        ),
                        styles["ReportSmall"],
                    )
                )

                # Explain collapsed boxes when quartiles coincide
                if (
                    boxplot.get("q1") is not None
                    and boxplot.get("median") is not None
                    and boxplot.get("q3") is not None
                    and boxplot["q1"]
                    == boxplot["median"]
                    == boxplot["q3"]
                ):
                    story.append(
                        Paragraph(
                            (
                                "Note: The first quartile, median, "
                                "and third quartile are identical. "
                                "The box therefore appears as a line. "
                                "This is expected for this distribution."
                            ),
                            styles["ReportSmall"],
                        )
                    )

                story.append(Spacer(1, 20))


# --------------------------------------------------
# AI insights
# --------------------------------------------------

def add_ai_insights(story, insights, styles):
    """Include existing Claude insights in the report."""

    story.append(
        Paragraph(
            "8. AI Insights &amp; Storytelling",
            styles["SectionHeading"],
        )
    )

    # Explain where the insights came from
    story.append(
        Paragraph(
            (
                "The following interpretations were generated "
                "by Claude from the dataset's calculated statistics. "
                "They were generated before this report was downloaded."
            ),
            styles["ReportSmall"],
        )
    )

    story.append(Spacer(1, 10))

    # Dataset summary
    story.append(
        Paragraph(
            "Dataset Summary",
            styles["ColumnHeading"],
        )
    )

    story.append(
        Paragraph(
            safe_text(insights["dataset_summary"]),
            styles["ReportBody"],
        )
    )

    story.append(Spacer(1, 12))

    # Key findings
    story.append(
        Paragraph(
            "Key Findings",
            styles["ColumnHeading"],
        )
    )

    for index, insight in enumerate(insights["insights"], start=1):
        title = insight["title"]
        finding = insight["finding"]
        interpretation = insight["interpretation"]
        caveat = insight["caveat"]
        severity = insight["severity"]

        # Keep the title and first finding together
        story.append(
            KeepTogether(
                [
                    Paragraph(
                        f"{index}. {safe_text(title)}",
                        styles["InsightHeading"],
                    ),
                    Paragraph(
                        (
                            f"<b>Classification:</b> "
                            f"{safe_text(severity.capitalize())}"
                        ),
                        styles["ReportSmall"],
                    ),
                    Paragraph(
                        safe_text(finding),
                        styles["ReportBody"],
                    ),
                ]
            )
        )

        # Interpretation
        story.append(
            Paragraph(
                "Interpretation",
                styles["InsightLabel"],
            )
        )

        story.append(
            Paragraph(
                safe_text(interpretation),
                styles["ReportBody"],
            )
        )

        # Supporting evidence
        evidence = insight.get("evidence", [])

        if evidence:
            story.append(
                Paragraph(
                    "Supporting Evidence",
                    styles["InsightLabel"],
                )
            )

            evidence_rows = [
                [
                    item["column"],
                    item["metric"],
                    item["value"],
                ]
                for item in evidence
            ]

            story.append(
                create_table(
                    headers=[
                        "Column",
                        "Metric",
                        "Value",
                    ],
                    rows=evidence_rows,
                    column_widths=[155, 175, 175],
                    styles=styles,
                )
            )

        # Individual caveat
        story.append(
            Paragraph(
                "Important Caveat",
                styles["InsightLabel"],
            )
        )

        story.append(
            Paragraph(
                safe_text(caveat),
                styles["ReportBody"],
            )
        )

        story.append(Spacer(1, 18))

    # Overall limitations
    overall_caveats = insights.get("overall_caveats", [])

    if overall_caveats:
        story.append(
            Paragraph(
                "Overall Limitations",
                styles["ColumnHeading"],
            )
        )

        for caveat in overall_caveats:
            story.append(
                Paragraph(
                    f"&#8226; {safe_text(caveat)}",
                    styles["ReportBody"],
                )
            )

    story.append(Spacer(1, 12))


# --------------------------------------------------
# Methodology
# --------------------------------------------------

def add_methodology(story, styles, has_insights):
    """Describe how statistics and interpretations were produced."""

    explanation = (
        "All numerical statistics and categorical frequencies "
        "in this report were calculated using Pandas from the "
        "uploaded CSV dataset. Columns were included or excluded "
        "according to user-confirmed classifications. Missing "
        "values were excluded from statistical calculations "
        "where appropriate. Histograms and box plots use "
        "statistical values calculated by Pandas and NumPy. "
        "Charts are rendered using ReportLab."
    )

    if has_insights:
        explanation += (
            " AI interpretations were generated separately "
            "using Claude and supplied to the report generator. "
            "The report download did not make another AI request. "
            "These interpretations should be reviewed before "
            "being used to make important decisions."
        )
    else:
        explanation += (
            " No AI interpretations were supplied for this report."
        )

    story.append(
        KeepTogether(
            [
                Paragraph(
                    (
                        "9. Methodology"
                        if has_insights
                        else "8. Methodology"
                    ),
                    styles["SectionHeading"],
                ),
                Paragraph(
                    explanation,
                    styles["ReportBody"],
                ),
            ]
        )
    )


# --------------------------------------------------
# Main report generator
# --------------------------------------------------

def generate_report(
    dataframe: pd.DataFrame,
    filename: str,
    classifications: list,
    statistics: dict,
    insights: dict | None = None,
) -> bytes:
    """
    Generate a complete DataTale PDF report.

    AI insights are optional and must already exist.
    This function never calls Claude.
    """

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=45,
        leftMargin=45,
        topMargin=50,
        bottomMargin=65,
        title="DataTale Dataset Analysis Report",
        author="DataTale",
    )

    styles = create_styles()
    story = []

    # Report branding
    story.append(
        Paragraph(
            "DataTale",
            styles["ReportTitle"],
        )
    )

    story.append(
        Paragraph(
            "Dataset Analysis Report",
            styles["ReportSubtitle"],
        )
    )

    story.append(Spacer(1, 12))

    # Report metadata
    generated_at = datetime.now(timezone.utc).strftime(
        "%B %d, %Y at %H:%M UTC"
    )

    story.append(
        Paragraph(
            f"<b>Dataset:</b> {safe_text(filename)}",
            styles["ReportBody"],
        )
    )

    story.append(
        Paragraph(
            f"<b>Generated:</b> {generated_at}",
            styles["ReportBody"],
        )
    )

    story.append(Spacer(1, 14))

    # Section 1-2
    add_dataset_overview(
        story,
        dataframe,
        styles,
    )

    # Section 3
    add_column_profiles(
        story,
        dataframe,
        styles,
    )

    # Section 4
    add_classifications(
        story,
        classifications,
        styles,
    )

    # Section 5
    add_numeric_statistics(
        story,
        statistics,
        styles,
    )

    # Section 6
    add_categorical_statistics(
        story,
        statistics,
        styles,
    )

    # Start visualizations on a fresh page
    story.append(PageBreak())

    # Section 7
    add_visualizations(
        story,
        statistics,
        styles,
    )

    # Include AI insights only when supplied
    if insights is not None:
        story.append(PageBreak())

        add_ai_insights(
            story,
            insights,
            styles,
        )

    # Final methodology section
    add_methodology(
        story,
        styles,
        has_insights=insights is not None,
    )

    # Build PDF
    document.build(
        story,
        onFirstPage=add_page_footer,
        onLaterPages=add_page_footer,
    )

    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes