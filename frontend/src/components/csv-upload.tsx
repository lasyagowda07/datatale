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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Maximum upload size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Profile information for each column
type ColumnProfile = {
  name: string;
  data_type: string;
  missing_values: number;
  unique_values: number;
};

// Structure of the backend response
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

export default function CsvUpload() {
  const inputRef = useRef<HTMLInputElement>(null);

  // File selection states
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Backend analysis states
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState("");

  // Validate the selected file
  function handleFile(selectedFile: File) {
    setFile(null);
    setError("");
    setAnalysis(null);
    setApiError("");

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
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
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

    const selectedFile = event.dataTransfer.files?.[0];

    if (selectedFile) {
      handleFile(selectedFile);
    }
  }

  // Remove the selected file
  function removeFile() {
    if (isAnalyzing) return;

    setFile(null);
    setError("");
    setAnalysis(null);
    setApiError("");
  }

  // Upload CSV to FastAPI
  async function analyzeDataset() {
    if (!file || isAnalyzing) return;

    setIsAnalyzing(true);
    setApiError("");
    setAnalysis(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("Backend API URL is not configured.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to analyze dataset."
        );
      }

      setAnalysis(data as AnalysisResponse);
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "Something went wrong while analyzing the dataset."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Calculate total missing values
 const totalMissingValues =
  analysis?.column_profiles?.reduce(
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
              setIsDragging(true);
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
                className="hidden"
                aria-label="Select CSV file"
              />

              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isAnalyzing}
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
                disabled={isAnalyzing}
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
              disabled={isAnalyzing}
              className="mt-5 w-full"
            >
              {isAnalyzing ? "Analyzing dataset..." : "Analyze Dataset"}
            </Button>
          )}

          {/* API Error */}
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
                {/* Rows */}
                <div className="rounded-xl bg-blue-50 p-4">
                  <Database className="mb-3 h-5 w-5 text-blue-600" />
                  <p className="text-sm text-slate-500">Total Rows</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {analysis.rows.toLocaleString()}
                  </p>
                </div>

                {/* Columns */}
                <div className="rounded-xl bg-purple-50 p-4">
                  <Columns3 className="mb-3 h-5 w-5 text-purple-600" />
                  <p className="text-sm text-slate-500">Columns</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {analysis.columns}
                  </p>
                </div>

                {/* Missing Values */}
                <div className="rounded-xl bg-amber-50 p-4">
                  <AlertCircle className="mb-3 h-5 w-5 text-amber-600" />
                  <p className="text-sm text-slate-500">Missing Values</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {totalMissingValues.toLocaleString()}
                  </p>
                </div>

                {/* Duplicate Rows */}
                <div className="rounded-xl bg-green-50 p-4">
                  <Copy className="mb-3 h-5 w-5 text-green-600" />
                  <p className="text-sm text-slate-500">Duplicate Rows</p>
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
                      <th className="px-4 py-3 font-medium">Column</th>
                      <th className="px-4 py-3 font-medium">Data Type</th>
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
        </div>
      )}
    </div>
  );
}