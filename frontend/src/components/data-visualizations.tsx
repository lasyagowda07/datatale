"use client";

import { useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  BarChart3,
  ChartPie,
  Activity,
  Box,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Chart colors
const CHART_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#84cc16",
];

const NUMERIC_COLOR = "#3b82f6";

// Categorical frequency
type CategoryFrequency = {
  value: string;
  count: number;
  percentage: number;
};

// Numeric descriptive statistics
type NumericStatistics = {
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  std: number | null;
  p25: number | null;
  p75: number | null;
};

// Histogram bin
type HistogramBin = {
  start: number;
  end: number;
  count: number;
};

// Box plot statistics
type BoxplotStatistics = {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
  lower_whisker: number;
  upper_whisker: number;
  outlier_count: number;
  outliers: number[];
};

// Numeric column
type NumericColumn = {
  name: string;
  type: "numeric";
  count: number;
  missing_values: number;
  statistics: NumericStatistics | null;
  histogram?: HistogramBin[];
  boxplot?: BoxplotStatistics | null;
};

// Categorical column
type CategoricalColumn = {
  name: string;
  type: "categorical";
  count: number;
  missing_values: number;
  unique_categories: number;
  mode: string | null;
  frequencies: CategoryFrequency[];
};

// Combined column types
type ColumnStatistics = NumericColumn | CategoricalColumn;

// Backend statistics response
type StatisticsResponse = {
  total_rows: number;
  analyzed_columns: number;
  results: ColumnStatistics[];
};

// Component props
type DataVisualizationsProps = {
  statistics: StatisticsResponse;
};

// Chart types
type ChartType = "bar" | "donut" | "histogram" | "boxplot";

// Categorical chart item
type CategoryChartItem = {
  name: string;
  count: number;
  percentage: number;
  color: string;
};

// Format numbers for display
function formatNumber(value: number, digits = 3) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

// Shorten long labels
function shortenLabel(value: string, maxLength = 24) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength)}…`
    : value;
}

// Tooltip for categorical charts
function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly {
    payload: CategoryChartItem;
  }[];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="max-w-[280px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="break-words text-sm font-semibold text-slate-900">
        {item.name}
      </p>

      <p className="mt-2 text-sm text-slate-600">
        Count:{" "}
        <span className="font-semibold text-slate-900">
          {item.count.toLocaleString()}
        </span>
      </p>

      <p className="mt-1 text-sm text-slate-600">
        Percentage:{" "}
        <span className="font-semibold text-slate-900">
          {item.percentage.toFixed(2)}%
        </span>
      </p>
    </div>
  );
}

// Tooltip for histogram bins
function HistogramTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly {
    payload: HistogramBin;
  }[];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const bin = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm font-semibold text-slate-900">
        Value range
      </p>

      <p className="mt-2 text-sm text-slate-600">
        {formatNumber(bin.start, 5)} –{" "}
        {formatNumber(bin.end, 5)}
      </p>

      <p className="mt-2 text-sm text-slate-600">
        Count:{" "}
        <span className="font-semibold text-slate-900">
          {bin.count.toLocaleString()}
        </span>
      </p>
    </div>
  );
}

// Draw a box plot using SVG
function NumericBoxPlot({
  boxplot,
}: {
  boxplot: BoxplotStatistics;
}) {
  const {
    min,
    max,
    q1,
    median,
    q3,
    lower_whisker,
    upper_whisker,
    outliers,
  } = boxplot;

  // Expand the display range when all values are identical
  const spread = max - min;
  const padding = spread === 0 ? 1 : spread * 0.08;

  const domainMin = min - padding;
  const domainMax = max + padding;
  const domainRange = domainMax - domainMin;

  // Convert numeric values into SVG coordinates
  const toX = (value: number) =>
    60 + ((value - domainMin) / domainRange) * 680;

  const centerY = 110;
  const boxTop = 75;
  const boxHeight = 70;

  return (
    <div className="space-y-5">
      <div className="w-full overflow-x-auto">
        <svg
          viewBox="0 0 800 230"
          className="min-w-[500px] w-full"
          role="img"
          aria-label="Box plot showing quartiles, median, whiskers, and outliers"
        >
          {/* Whisker line */}
          <line
            x1={toX(lower_whisker)}
            y1={centerY}
            x2={toX(upper_whisker)}
            y2={centerY}
            stroke="#64748b"
            strokeWidth={3}
          />

          {/* Lower whisker cap */}
          <line
            x1={toX(lower_whisker)}
            y1={centerY - 22}
            x2={toX(lower_whisker)}
            y2={centerY + 22}
            stroke="#64748b"
            strokeWidth={3}
          />

          {/* Upper whisker cap */}
          <line
            x1={toX(upper_whisker)}
            y1={centerY - 22}
            x2={toX(upper_whisker)}
            y2={centerY + 22}
            stroke="#64748b"
            strokeWidth={3}
          />

          {/* Interquartile box */}
          <rect
            x={toX(q1)}
            y={boxTop}
            width={Math.max(toX(q3) - toX(q1), 2)}
            height={boxHeight}
            fill="#bfdbfe"
            stroke="#3b82f6"
            strokeWidth={2}
            rx={4}
          />

          {/* Median line */}
          <line
            x1={toX(median)}
            y1={boxTop}
            x2={toX(median)}
            y2={boxTop + boxHeight}
            stroke="#1d4ed8"
            strokeWidth={4}
          />

          {/* Outlier points */}
          {outliers.map((value, index) => (
            <circle
              key={`${value}-${index}`}
              cx={toX(value)}
              cy={centerY}
              r={5}
              fill="#f97316"
              stroke="#ffffff"
              strokeWidth={1.5}
            >
              <title>
                Potential outlier: {formatNumber(value, 5)}
              </title>
            </circle>
          ))}

          {/* Axis line */}
          <line
            x1={60}
            y1={185}
            x2={740}
            y2={185}
            stroke="#cbd5e1"
            strokeWidth={1}
          />

          {/* Axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const value = domainMin + domainRange * fraction;
            const x = 60 + fraction * 680;

            return (
              <g key={fraction}>
                <line
                  x1={x}
                  y1={180}
                  x2={x}
                  y2={190}
                  stroke="#94a3b8"
                />

                <text
                  x={x}
                  y={210}
                  textAnchor="middle"
                  fontSize={12}
                  fill="#64748b"
                >
                  {formatNumber(value)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Box plot summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Minimum", min],
          ["Q1", q1],
          ["Median", median],
          ["Q3", q3],
          ["Maximum", max],
          ["Lower whisker", lower_whisker],
          ["Upper whisker", upper_whisker],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-lg bg-slate-50 p-3"
          >
            <p className="text-xs text-slate-500">
              {label}
            </p>

            <p className="mt-1 break-words text-sm font-semibold text-slate-900">
              {formatNumber(Number(value))}
            </p>
          </div>
        ))}

        <div className="rounded-lg bg-orange-50 p-3">
          <p className="text-xs text-orange-700">
            Potential outliers
          </p>

          <p className="mt-1 text-sm font-semibold text-orange-900">
            {boxplot.outlier_count}
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Potential outliers are identified using the 1.5 × IQR rule.
        Whiskers extend to actual observations within the calculated
        boundaries.
      </p>
    </div>
  );
}

export default function DataVisualizations({
  statistics,
}: DataVisualizationsProps) {
  // All analyzed columns
  const columns = statistics.results;
  

  // Selected column
  const [selectedColumn, setSelectedColumn] = useState(
    columns[0]?.name ?? ""
  );

  // Selected chart type
  const [chartType, setChartType] = useState<ChartType>("bar");

  // Find active column
  const activeColumn =
    columns.find((column) => column.name === selectedColumn) ??
    columns[0];

  // Handle column selection
  function handleColumnChange(columnName: string) {
    const column = columns.find(
      (item) => item.name === columnName
    );

    if (!column) {
      return;
    }

    setSelectedColumn(columnName);

    // Automatically select the correct default chart
    setChartType(
      column.type === "categorical" ? "bar" : "histogram"
    );
  }

  // Empty state
  if (!activeColumn) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Data Visualizations
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            No analyzed columns are available.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Determine which chart to display
  const activeChartType: ChartType =
    activeColumn.type === "categorical"
      ? chartType === "donut"
        ? "donut"
        : "bar"
      : chartType === "boxplot"
        ? "boxplot"
        : "histogram";

  // Prepare categorical chart data
  const categoryData: CategoryChartItem[] =
    activeColumn.type === "categorical"
      ? activeColumn.frequencies.map((item, index) => ({
          name: item.value,
          count: item.count,
          percentage: item.percentage,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }))
      : [];

  // Prepare donut data
  const MAX_DONUT_CATEGORIES = 7;

  const sortedDonutData = [...categoryData].sort(
    (first, second) => second.count - first.count
  );

  const donutData: CategoryChartItem[] =
    sortedDonutData.length > MAX_DONUT_CATEGORIES
      ? [
          ...sortedDonutData.slice(0, MAX_DONUT_CATEGORIES),
          {
            name: "Other",
            count: sortedDonutData
              .slice(MAX_DONUT_CATEGORIES)
              .reduce((total, item) => total + item.count, 0),
            percentage: sortedDonutData
              .slice(MAX_DONUT_CATEGORIES)
              .reduce(
                (total, item) => total + item.percentage,
                0
              ),
            color: "#94a3b8",
          },
        ]
      : sortedDonutData;

  // Prepare numeric histogram data
  const histogramData =
    activeColumn.type === "numeric"
      ? activeColumn.histogram ?? []
      : [];


  // Calculate bar chart height
  const barChartHeight = Math.max(
    360,
    categoryData.length * 48
  );

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-6 p-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />

            <h2 className="text-xl font-semibold text-slate-900">
              Data Visualizations
            </h2>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Explore your dataset using interactive charts calculated
            from actual data.
          </p>
        </div>

        {/* Column selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">
            Select a column
          </p>

          <div className="flex flex-wrap gap-2">
            {columns.map((column) => (
              <button
                key={column.name}
                type="button"
                onClick={() => handleColumnChange(column.name)}
                aria-pressed={activeColumn.name === column.name}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  activeColumn.name === column.name
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {column.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chart type selection */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">
            Visualization type
          </p>

          <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {activeColumn.type === "categorical" ? (
              <>
                <button
                  type="button"
                  onClick={() => setChartType("bar")}
                  aria-pressed={activeChartType === "bar"}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
                    activeChartType === "bar"
                      ? "bg-white font-medium text-blue-600 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  Bar Chart
                </button>

                <button
                  type="button"
                  onClick={() => setChartType("donut")}
                  aria-pressed={activeChartType === "donut"}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
                    activeChartType === "donut"
                      ? "bg-white font-medium text-blue-600 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  <ChartPie className="h-4 w-4" />
                  Donut Chart
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setChartType("histogram")}
                  aria-pressed={activeChartType === "histogram"}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
                    activeChartType === "histogram"
                      ? "bg-white font-medium text-blue-600 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  Histogram
                </button>

                <button
                  type="button"
                  onClick={() => setChartType("boxplot")}
                  aria-pressed={activeChartType === "boxplot"}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
                    activeChartType === "boxplot"
                      ? "bg-white font-medium text-blue-600 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  <Box className="h-4 w-4" />
                  Box Plot
                </button>
              </>
            )}
          </div>
        </div>

        {/* Column summary */}
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="break-words text-lg font-semibold text-slate-900">
              {activeColumn.name}
            </h3>

            <Badge variant="secondary">
              {activeColumn.type === "numeric"
                ? "Numeric"
                : "Categorical"}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
            <span>
              {activeColumn.count.toLocaleString()} valid values
            </span>

            <span>
              {activeColumn.missing_values.toLocaleString()} missing
            </span>

            {activeColumn.type === "categorical" && (
              <span>
                {activeColumn.unique_categories.toLocaleString()} categories
              </span>
            )}
          </div>
        </div>

        {/* Categorical bar chart */}
        {activeColumn.type === "categorical" &&
          activeChartType === "bar" &&
          (categoryData.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <div
                className="min-w-[420px]"
                style={{ height: barChartHeight }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryData}
                    layout="vertical"
                    margin={{
                      top: 10,
                      right: 35,
                      left: 10,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      type="number"
                      allowDecimals={false}
                    />

                    <YAxis
                      dataKey="name"
                      type="category"
                      width={185}
                      interval={0}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: string) =>
                        shortenLabel(value)
                      }
                    />

                    <Tooltip content={<CategoryTooltip />} />

                    <Bar
                      dataKey="count"
                      maxBarSize={32}
                      radius={[0, 6, 6, 0]}
                    >
                      {categoryData.map((item) => (
                        <Cell
                          key={item.name}
                          fill={item.color}
                        />
                      ))}

                      <LabelList
                        dataKey="count"
                        position="right"
                        fontSize={11}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No category values are available.
            </p>
          ))}

        {/* Categorical donut chart */}
        {activeColumn.type === "categorical" &&
          activeChartType === "donut" &&
          (donutData.length > 0 ? (
            <div className="space-y-5">
              <div className="relative h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="78%"
                      paddingAngle={2}
                    >
                      {donutData.map((item) => (
                        <Cell
                          key={item.name}
                          fill={item.color}
                        />
                      ))}
                    </Pie>

                    <Tooltip content={<CategoryTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-3xl font-semibold text-slate-900">
                    {activeColumn.count.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">
                    Valid values
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {donutData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: item.color }}
                      />

                      <span className="break-words text-xs text-slate-700">
                        {item.name}
                      </span>
                    </div>

                    <span className="shrink-0 text-xs font-semibold">
                      {item.percentage.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>

              {categoryData.length > MAX_DONUT_CATEGORIES && (
                <p className="text-xs text-slate-500">
                  Smaller categories are grouped into &quot;Other&quot;.
                  Switch to the bar chart to view every category.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No category values are available.
            </p>
          ))}

        {/* Numeric histogram */}
        {activeColumn.type === "numeric" &&
          activeChartType === "histogram" &&
          (histogramData.length > 0 ? (
            <div className="space-y-4">
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={histogramData}
                    barCategoryGap={0}
                    margin={{
                      top: 15,
                      right: 20,
                      left: 0,
                      bottom: 35,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      dataKey="start"
                      tickFormatter={(value: number) =>
                        formatNumber(value, 2)
                      }
                      tick={{ fontSize: 11 }}
                      angle={-30}
                      textAnchor="end"
                      height={65}
                    />

                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                    />

                    <Tooltip content={<HistogramTooltip />} />

                    <Bar
                      dataKey="count"
                      fill={NUMERIC_COLOR}
                      radius={[3, 3, 0, 0]}
                      isAnimationActive
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-xs text-slate-500">
                Each bar shows the number of observations within
                a numeric range. Bins are calculated using NumPy.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No histogram data is available.
            </p>
          ))}

        {/* Numeric box plot */}
        {activeColumn.type === "numeric" &&
          activeChartType === "boxplot" &&
          (activeColumn.boxplot ? (
            <NumericBoxPlot boxplot={activeColumn.boxplot} />
          ) : (
            <p className="text-sm text-slate-500">
              No box plot data is available.
            </p>
          ))}

        {/* Chart explanation */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">
              About this chart:
            </span>{" "}
            {activeChartType === "bar" &&
              "Compare the number of records across categories."}

            {activeChartType === "donut" &&
              "Understand how each category contributes to the total."}

            {activeChartType === "histogram" &&
              "Explore how numeric values are distributed across ranges."}

            {activeChartType === "boxplot" &&
              "Explore the median, quartiles, whiskers, and potential outliers."}
          </p>
        </div>

        {/* Data source */}
        <p className="text-xs text-slate-500">
          Chart values are calculated by Pandas and NumPy,
          not generated by AI.
        </p>
      </CardContent>
    </Card>
  );
}