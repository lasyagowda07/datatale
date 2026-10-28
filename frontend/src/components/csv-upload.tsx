"use client";

import { useRef, useState } from "react";
import {
  FileSpreadsheet,
  UploadCloud,
  X,
  Database,
  Columns3,
  Copy,
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Calculator,
  BarChart3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AiInsights from "@/components/ai-insights";
import DataVisualizations from "@/components/data-visualizations";

// Maximum upload size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Dataset profiling types
type ColumnProfile = {
  name: string;
  data_type: string;
  missing_values: number;
  unique_values: number;
};

type AnalysisResponse = {
  filename: string;
  rows: number;
  columns: number;
  column_names: string[];
  duplicate_rows: number;
  column_profiles: ColumnProfile[];
  preview: {
    columns: string[];
    rows: (string | number | boolean | null)[][];
  };
  message: string;
};

// AI classification types
type ColumnType = "numeric" | "categorical" | "skip";

type ColumnClassification = {
  name: string;
  type: ColumnType;
  confidence: number;
  needs_review: boolean;
};

type ClassificationResponse = {
  filename: string;
  confidence_threshold: number;
  columns: ColumnClassification[];
  message: string;
};

// Numeric statistics returned by Pandas
type NumericStatistics = {
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  std: number | null;
  p25: number | null;
  p75: number | null;
};

// Histogram bins returned by NumPy
type HistogramBin = {
  start: number;
  end: number;
  count: number;
};

// Box plot statistics returned by Pandas
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

// Frequency distribution for categorical columns
type CategoryFrequency = {
  value: string;
  count: number;
  percentage: number;
};

// Discriminated union for statistical results
type NumericResult = {
  name: string;
  type: "numeric";
  count: number;
  missing_values: number;
  statistics: NumericStatistics | null;
  histogram: HistogramBin[];
  boxplot: BoxplotStatistics | null;
};

type CategoricalResult = {
  name: string;
  type: "categorical";
  count: number;
  missing_values: number;
  unique_categories: number;
  mode: string | null;
  frequencies: CategoryFrequency[];
};

type StatisticsResult = NumericResult | CategoricalResult;

type StatisticsResponse = {
  total_rows: number;
  analyzed_columns: number;
  results: StatisticsResult[];
};

// Explain what DataTale will calculate for each classification
const ANALYSIS_DESCRIPTIONS: Record<ColumnType, string> = {
  numeric: "Descriptive statistics, histogram, and box plot",
  categorical: "Category counts and percentages",
  skip: "Excluded from statistical analysis",
};

// Format numbers for display without changing calculations
function formatStatistic(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(value);
}

// Extract a readable error message from FastAPI responses
function getApiError(data: unknown, fallback: string) {
  if (
    typeof data === "object" &&
    data !== null &&
    "detail" in data &&
    typeof data.detail === "string"
  ) {
    return data.detail;
  }

  return fallback;
}

export default function CsvUpload() {
  const inputRef = useRef<HTMLInputElement>(null);

  // File selection states
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Dataset profiling states
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState("");

  // AI classification states
  const [classifications, setClassifications] = useState<
    ColumnClassification[]
  >([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationError, setClassificationError] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [reviewedColumns, setReviewedColumns] = useState<string[]>([]);

  // Statistics calculation states
  const [statistics, setStatistics] = useState<StatisticsResponse | null>(
    null
  );
  const [isCalculating, setIsCalculating] = useState(false);
  const [statisticsError, setStatisticsError] = useState("");

  // Reset visualizations and AI insights after recalculation
  const [statisticsVersion, setStatisticsVersion] = useState(0);

  // Prevent file changes while requests are running
  const isBusy = isAnalyzing || isClassifying || isCalculating;

  // Clear statistics when classifications change
  function resetStatistics() {
    setStatistics(null);
    setStatisticsError("");
  }

  // Clear all results when a new file is selected
  function resetResults() {
    setAnalysis(null);
    setApiError("");
    setClassifications([]);
    setClassificationError("");
    setIsConfirmed(false);
    setReviewedColumns([]);
    resetStatistics();
  }

  // Validate the selected CSV
  function handleFile(selectedFile: File) {
    if (isBusy) return;

    setFile(null);
    setError("");
    resetResults();

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File size must not exceed 10 MB.");
      return;
    }

    if (selectedFile.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    setFile(selectedFile);
  }

  // Handle file picker selection
  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      handleFile(selectedFile);
    }

    event.target.value = "";
  }

  // Handle drag and drop
  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (isBusy) return;

    const selectedFile = event.dataTransfer.files?.[0];

    if (selectedFile) {
      handleFile(selectedFile);
    }
  }

  // Remove the selected file and its results
  function removeFile() {
    if (isBusy) return;

    setFile(null);
    setError("");
    resetResults();
  }

  // Build a multipart request containing the CSV
  function createFormData(selectedFile: File) {
    const formData = new FormData();
    formData.append("file", selectedFile);
    return formData;
  }

  // Upload the CSV for dataset profiling
  async function analyzeDataset() {
    if (!file || isBusy) return;

    setIsAnalyzing(true);
    resetResults();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("Backend API URL is not configured.");
      }

      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: "POST",
        body: createFormData(file),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getApiError(data, "Unable to analyze dataset.")
        );
      }

      setAnalysis(data as AnalysisResponse);
    } catch (caughtError) {
      setApiError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while analyzing the dataset."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Ask Claude to classify the dataset columns
  async function classifyDataset() {
    if (!file || !analysis || isBusy) return;

    setIsClassifying(true);
    setClassificationError("");
    setClassifications([]);
    setReviewedColumns([]);
    setIsConfirmed(false);
    resetStatistics();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("Backend API URL is not configured.");
      }

      const response = await fetch(`${apiUrl}/api/classify`, {
        method: "POST",
        body: createFormData(file),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getApiError(data, "Unable to classify dataset columns.")
        );
      }

      const result = data as ClassificationResponse;

      // Verify Claude returned every dataset column
      const expectedNames = analysis.column_names;
      const returnedNames = result.columns.map(
        (column) => column.name
      );

      const validColumns =
        returnedNames.length === expectedNames.length &&
        new Set(returnedNames).size === expectedNames.length &&
        expectedNames.every((name) => returnedNames.includes(name));

      if (!validColumns) {
        throw new Error(
          "The classification response does not match the dataset."
        );
      }

      setClassifications(result.columns);
    } catch (caughtError) {
      setClassificationError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong during AI classification."
      );
    } finally {
      setIsClassifying(false);
    }
  }

  // Change a classification locally without calling Claude again
  function updateClassification(
    name: string,
    newType: ColumnType
  ) {
    setClassifications((previous) =>
      previous.map((column) =>
        column.name === name
          ? { ...column, type: newType }
          : column
      )
    );

    setReviewedColumns((previous) =>
      previous.includes(name) ? previous : [...previous, name]
    );

    setIsConfirmed(false);
    resetStatistics();
  }

  // Approve a low-confidence classification
  function approveClassification(name: string) {
    setReviewedColumns((previous) =>
      previous.includes(name) ? previous : [...previous, name]
    );

    setIsConfirmed(false);
    resetStatistics();
  }

  // Calculate statistics using confirmed classifications
  async function calculateDatasetStatistics() {
    if (
      !file ||
      !analysis ||
      !isConfirmed ||
      isBusy ||
      classifications.length === 0
    ) {
      return;
    }

    setIsCalculating(true);
    setStatisticsError("");
    setStatistics(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("Backend API URL is not configured.");
      }

      // Include the original CSV in the request
      const formData = createFormData(file);

      // Send only confirmed names and types
      const confirmedClassifications = classifications.map(
        (column) => ({
          name: column.name,
          type: column.type,
        })
      );

      formData.append(
        "classifications",
        JSON.stringify(confirmedClassifications)
      );

      // Request deterministic calculations from FastAPI
      const response = await fetch(`${apiUrl}/api/statistics`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          getApiError(data, "Unable to calculate statistics.")
        );
      }


      setStatistics(data as StatisticsResponse);

      // Reset charts and AI insights after recalculation
      setStatisticsVersion((previous) => previous + 1);
    } catch (caughtError) {
      setStatisticsError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while calculating statistics."
      );
    } finally {
      setIsCalculating(false);
    }
  }

  // Identify low-confidence columns needing review
  const pendingReview = classifications.filter(
    (column) =>
      column.needs_review &&
      !reviewedColumns.includes(column.name)
  );

  // Calculate total missing values from dataset profile
  const totalMissingValues =
    analysis?.column_profiles.reduce(
      (total, column) => total + column.missing_values,
      0
    ) ?? 0;

  return (
    <div className="space-y-8">
      {/* CSV Upload Card */}
      <Card className="w-full border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();

              if (!isBusy) {
                setIsDragging(true);
              }
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-blue-100 p-4">
                <UploadCloud className="h-7 w-7 text-blue-600" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Upload your dataset
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Drag and drop a CSV file, or browse your computer.
                </p>
              </div>

              <Badge variant="secondary">
                CSV files only · Max 10 MB
              </Badge>

              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={isBusy}
                className="hidden"
                aria-label="Select CSV file"
              />

              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isBusy}
              >
                Browse files
              </Button>
            </div>
          </div>

          {/* Selected File */}
          {file && (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <FileSpreadsheet className="h-6 w-6 shrink-0 text-green-600" />

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {file.name}
                  </p>

                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeFile}
                disabled={isBusy}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* File Validation Error */}
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Analyze Button */}
          {file && (
            <Button
              type="button"
              onClick={analyzeDataset}
              disabled={isBusy}
              className="mt-5 w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing dataset...
                </>
              ) : (
                "Analyze Dataset"
              )}
            </Button>
          )}

          {/* Profiling API Error */}
          {apiError && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {apiError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-8">
          {/* Dataset Overview */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-900">
                  Dataset Overview
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {analysis.filename}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {/* Total Rows */}
                <div className="rounded-xl bg-blue-50 p-4">
                  <Database className="mb-3 h-5 w-5 text-blue-600" />

                  <p className="text-sm text-slate-500">
                    Total Rows
                  </p>

                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {analysis.rows.toLocaleString()}
                  </p>
                </div>

                {/* Columns */}
                <div className="rounded-xl bg-purple-50 p-4">
                  <Columns3 className="mb-3 h-5 w-5 text-purple-600" />

                  <p className="text-sm text-slate-500">
                    Columns
                  </p>

                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {analysis.columns}
                  </p>
                </div>

                {/* Missing Values */}
                <div className="rounded-xl bg-amber-50 p-4">
                  <AlertCircle className="mb-3 h-5 w-5 text-amber-600" />

                  <p className="text-sm text-slate-500">
                    Missing Values
                  </p>

                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {totalMissingValues.toLocaleString()}
                  </p>
                </div>

                {/* Duplicate Rows */}
                <div className="rounded-xl bg-green-50 p-4">
                  <Copy className="mb-3 h-5 w-5 text-green-600" />

                  <p className="text-sm text-slate-500">
                    Duplicate Rows
                  </p>

                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {analysis.duplicate_rows.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Column Profiles */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-900">
                  Column Profiles
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Explore data types, missing values, and unique values.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">
                        Column
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Data Type
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Missing Values
                      </th>

                      <th className="px-4 py-3 font-medium">
                        Unique Values
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {analysis.column_profiles.map((column, index) => (
                      <tr
                        key={`${column.name}-${index}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {column.name}
                        </td>

                        <td className="px-4 py-3">
                          <Badge variant="secondary">
                            {column.data_type}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={
                              column.missing_values > 0
                                ? "font-medium text-amber-700"
                                : "text-slate-600"
                            }
                          >
                            {column.missing_values}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {column.unique_values}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Dataset Preview */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-900">
                  Dataset Preview
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Showing the first {analysis.preview.rows.length} rows.
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-max text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      {analysis.preview.columns.map((column, index) => (
                        <th
                          key={`${column}-${index}`}
                          className="whitespace-nowrap px-4 py-3 font-medium"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {analysis.preview.rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-t border-slate-100"
                      >
                        {row.map((value, columnIndex) => (
                          <td
                            key={columnIndex}
                            className="whitespace-nowrap px-4 py-3 text-slate-700"
                          >
                            {value === null ? (
                              <span className="italic text-slate-400">
                                Missing
                              </span>
                            ) : (
                              String(value)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* AI Classification */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="h-6 w-6 text-blue-600" />

                    <h2 className="text-xl font-semibold text-slate-900">
                      AI Column Classification
                    </h2>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Let Claude identify how each column should be analyzed.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={classifyDataset}
                  disabled={isBusy}
                >
                  {isClassifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Classifying...
                    </>
                  ) : (
                    <>
                      <BrainCircuit className="mr-2 h-4 w-4" />
                      {classifications.length > 0
                        ? "Classify Again"
                        : "Classify with AI"}
                    </>
                  )}
                </Button>
              </div>

              {/* Classification Error */}
              {classificationError && (
                <p role="alert" className="mb-4 text-sm text-red-600">
                  {classificationError}
                </p>
              )}

              {/* Empty Classification State */}
              {classifications.length === 0 && !isClassifying && (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
                  Your dataset is ready for AI classification.
                </div>
              )}

              {/* Classification Results */}
              {classifications.length > 0 && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary">
                      {classifications.length} columns classified
                    </Badge>

                    {pendingReview.length > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-amber-700"
                      >
                        {pendingReview.length} need review
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-green-300 bg-green-50 text-green-700"
                      >
                        All columns reviewed
                      </Badge>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[850px] text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-medium">
                            Column
                          </th>

                          <th className="px-4 py-3 font-medium">
                            Classification
                          </th>

                          <th className="px-4 py-3 font-medium">
                            Confidence
                          </th>

                          <th className="px-4 py-3 font-medium">
                            Planned Analysis
                          </th>

                          <th className="px-4 py-3 font-medium">
                            Review
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {classifications.map((column) => {
                          const reviewed = reviewedColumns.includes(
                            column.name
                          );

                          return (
                            <tr
                              key={column.name}
                              className="border-t border-slate-100"
                            >
                              <td className="px-4 py-4 font-medium text-slate-900">
                                {column.name}
                              </td>

                              <td className="px-4 py-4">
                                <select
                                  aria-label={`Classification for ${column.name}`}
                                  value={column.type}
                                  onChange={(event) =>
                                    updateClassification(
                                      column.name,
                                      event.target.value as ColumnType
                                    )
                                  }
                                  disabled={isConfirmed || isBusy}
                                  className="w-full min-w-[130px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                                >
                                  <option value="numeric">
                                    Numeric
                                  </option>

                                  <option value="categorical">
                                    Categorical
                                  </option>

                                  <option value="skip">
                                    Skip
                                  </option>
                                </select>
                              </td>

                              <td className="px-4 py-4 text-slate-700">
                                {(column.confidence * 100).toFixed(0)}%
                              </td>

                              <td className="px-4 py-4 text-slate-600">
                                {ANALYSIS_DESCRIPTIONS[column.type]}
                              </td>

                              <td className="px-4 py-4">
                                {column.needs_review && !reviewed ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isBusy}
                                    onClick={() =>
                                      approveClassification(column.name)
                                    }
                                  >
                                    Approve
                                  </Button>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-green-300 bg-green-50 text-green-700"
                                  >
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    {reviewed
                                      ? "Reviewed"
                                      : "Auto-approved"}
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Confirmation Controls */}
                  {!isConfirmed ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-600">
                        {pendingReview.length > 0
                          ? `Review ${pendingReview.length} column(s) before continuing.`
                          : "All classifications are ready for confirmation."}
                      </p>

                      <Button
                        type="button"
                        disabled={pendingReview.length > 0 || isBusy}
                        onClick={() => {
                          setIsConfirmed(true);
                          resetStatistics();
                        }}
                      >
                        Confirm Classifications
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-green-200 bg-green-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-green-800">
                          <CheckCircle2 className="h-5 w-5" />
                          Classifications confirmed successfully.
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => {
                            setIsConfirmed(false);
                            resetStatistics();
                          }}
                        >
                          Edit Classifications
                        </Button>
                      </div>

                      {/* Calculate Statistics Button */}
                      <Button
                        type="button"
                        onClick={calculateDatasetStatistics}
                        disabled={isBusy}
                        className="w-full"
                      >
                        {isCalculating ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Calculating Statistics...
                          </>
                        ) : (
                          <>
                            <Calculator className="mr-2 h-4 w-4" />
                            {statistics
                              ? "Recalculate Statistics"
                              : "Calculate Statistics"}
                          </>
                        )}
                      </Button>

                      {/* Statistics Error */}
                      {statisticsError && (
                        <p
                          role="alert"
                          className="text-sm text-red-600"
                        >
                          {statisticsError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistical Analysis Results */}
          {statistics && (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-blue-600" />

                    <h2 className="text-xl font-semibold text-slate-900">
                      Statistical Analysis
                    </h2>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Statistics calculated from your dataset using
                    Pandas and your confirmed column classifications.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {statistics.total_rows.toLocaleString()} rows
                    </Badge>

                    <Badge variant="secondary">
                      {statistics.analyzed_columns} columns analyzed
                    </Badge>
                  </div>
                </div>

                {/* All Columns Skipped */}
                {statistics.results.length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
                    All columns were excluded from statistical analysis.
                    Change a column classification to calculate statistics.
                  </p>
                )}

                {/* Results for Each Analyzed Column */}
                <div className="space-y-6">
                  {statistics.results.map((result) => (
                    <div
                      key={result.name}
                      className="rounded-xl border border-slate-200 p-5"
                    >
                      {/* Column Header */}
                      <div className="mb-4 flex flex-wrap items-center gap-3">
                        <h3 className="break-words font-semibold text-slate-900">
                          {result.name}
                        </h3>

                        <Badge variant="outline">
                          {result.type === "numeric"
                            ? "Numeric"
                            : "Categorical"}
                        </Badge>
                      </div>

                      {/* Column Summary */}
                      <div className="mb-5 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span>
                          Valid values:{" "}
                          {result.count.toLocaleString()}
                        </span>

                        <span>
                          Missing values:{" "}
                          {result.missing_values.toLocaleString()}
                        </span>
                      </div>

                      {/* Numeric Statistics */}
                      {result.type === "numeric" && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                          {(
                            [
                              ["Mean", result.statistics?.mean],
                              ["Median", result.statistics?.median],
                              ["Minimum", result.statistics?.min],
                              ["Maximum", result.statistics?.max],
                              [
                                "Std. deviation",
                                result.statistics?.std,
                              ],
                              [
                                "25th percentile",
                                result.statistics?.p25,
                              ],
                              [
                                "75th percentile",
                                result.statistics?.p75,
                              ],
                            ] as const
                          ).map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-lg bg-slate-50 p-4"
                            >
                              <p className="text-xs text-slate-500">
                                {label}
                              </p>

                              <p className="mt-2 break-words text-lg font-semibold text-slate-900">
                                {formatStatistic(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Categorical Statistics */}
                      {result.type === "categorical" && (
                        <div className="space-y-4">
                          {/* Category Summary */}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg bg-slate-50 p-4">
                              <p className="text-xs text-slate-500">
                                Unique categories
                              </p>

                              <p className="mt-2 text-lg font-semibold text-slate-900">
                                {result.unique_categories.toLocaleString()}
                              </p>
                            </div>

                            <div className="rounded-lg bg-slate-50 p-4">
                              <p className="text-xs text-slate-500">
                                Most common category
                              </p>

                              <p className="mt-2 break-words text-sm font-semibold text-slate-900">
                                {result.mode ?? "N/A"}
                              </p>
                            </div>
                          </div>

                          {/* Frequency Distribution */}
                          <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full min-w-[450px] text-left text-sm">
                              <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                  <th className="px-4 py-3 font-medium">
                                    Category
                                  </th>

                                  <th className="px-4 py-3 font-medium">
                                    Count
                                  </th>

                                  <th className="px-4 py-3 font-medium">
                                    Percentage
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {result.frequencies.map(
                                  (frequency, index) => (
                                    <tr
                                      key={`${frequency.value}-${index}`}
                                      className="border-t border-slate-100"
                                    >
                                      <td className="break-words px-4 py-3 text-slate-900">
                                        {frequency.value}
                                      </td>

                                      <td className="px-4 py-3 text-slate-600">
                                        {frequency.count.toLocaleString()}
                                      </td>

                                      <td className="px-4 py-3 text-slate-600">
                                        {frequency.percentage.toFixed(2)}%
                                      </td>
                                    </tr>
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* No Valid Categories */}
                          {result.frequencies.length === 0 && (
                            <p className="text-sm text-slate-500">
                              No nonmissing category values are available.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interactive Data Visualizations */}
          {statistics && statistics.results.length > 0 && (
            <DataVisualizations
              key={statisticsVersion}
              statistics={statistics}
            />
          )}

          {/* AI Insights & Storytelling */}
          {statistics &&
            statistics.results.length > 0 &&
            file &&
            isConfirmed && (
              <AiInsights
                key={`${file.name}-${file.size}-${statisticsVersion}`}
                file={file}
                classifications={classifications.map((column) => ({
                  name: column.name,
                  type: column.type,
                }))}
                disabled={isBusy}
              />
            )}
        </div>
      )}
    </div>
  );
}