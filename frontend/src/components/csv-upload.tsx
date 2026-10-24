"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Maximum allowed CSV file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Define the structure of FastAPI's response
type AnalysisResponse = {
  filename: string;
  rows: number;
  columns: number;
  column_names: string[];
  message: string;
};

export default function CsvUpload() {
  // Reference to the hidden file input
  const inputRef = useRef<HTMLInputElement>(null);

  // File selection and validation states
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Backend API states
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [apiError, setApiError] = useState("");

  // Validate the selected CSV file
  function handleFile(selectedFile: File) {
    // Clear previous file, results, and errors
    setFile(null);
    setError("");
    setAnalysis(null);
    setApiError("");

    // Check file extension
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }

    // Check file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File size must be less than 10 MB.");
      return;
    }

    // Check for empty files
    if (selectedFile.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    // Store the validated file
    setFile(selectedFile);
  }

  // Handle file selection using the Browse button
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      handleFile(selectedFile);
    }

    // Allow selecting the same file again
    event.target.value = "";
  }

  // Handle dragging a file over the upload area
  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  // Handle leaving the upload area
  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  // Handle dropping a file
  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const selectedFile = event.dataTransfer.files?.[0];

    if (selectedFile) {
      handleFile(selectedFile);
    }
  }

  // Remove the selected file and analysis results
  function removeFile() {
    setFile(null);
    setError("");
    setAnalysis(null);
    setApiError("");
  }

  // Send the selected CSV file to FastAPI
  async function analyzeDataset() {
    if (!file || isAnalyzing) return;

    // Reset previous API results
    setIsAnalyzing(true);
    setApiError("");
    setAnalysis(null);

    try {
      // Read backend URL from environment variables
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("Backend API URL is not configured.");
      }

      // Create a multipart form request
      const formData = new FormData();
      formData.append("file", file);

      // Send the CSV file to FastAPI
      const response = await fetch(`${apiUrl}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      // Parse the JSON response
      const data = await response.json();

      // Handle errors returned by FastAPI
      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to analyze dataset."
        );
      }

      // Store the analysis results
      setAnalysis(data as AnalysisResponse);
    } catch (error) {
      // Display a meaningful error message
      setApiError(
        error instanceof Error
          ? error.message
          : "Something went wrong while analyzing the dataset."
      );
    } finally {
      // Stop the loading indicator
      setIsAnalyzing(false);
    }
  }

  return (
    <Card className="w-full border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        {/* CSV upload area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            {/* Upload icon */}
            <div className="rounded-full bg-blue-100 p-4">
              <UploadCloud className="h-7 w-7 text-blue-600" />
            </div>

            {/* Upload instructions */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Upload your dataset
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Drag and drop a CSV file, or browse your computer.
              </p>
            </div>

            {/* File requirements */}
            <Badge variant="secondary">
              CSV files only · Max 10 MB
            </Badge>

            {/* Hidden file input */}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Select CSV file"
            />

            {/* Browse files button */}
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isAnalyzing}
            >
              Browse files
            </Button>
          </div>
        </div>

        {/* Selected file information */}
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

            {/* Remove file button */}
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

        {/* File validation error */}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Analyze Dataset button */}
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

        {/* Backend API error */}
        {apiError && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {apiError}
          </p>
        )}

        {/* Dataset analysis results */}
        {analysis && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">
                Dataset Overview
              </h3>

              <p className="mt-1 truncate text-sm text-slate-500">
                {analysis.filename}
              </p>
            </div>

            {/* Dataset statistics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Row count */}
              <div className="rounded-lg border border-slate-100 bg-white p-4">
                <p className="text-sm text-slate-500">
                  Total Rows
                </p>

                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {analysis.rows.toLocaleString()}
                </p>
              </div>

              {/* Column count */}
              <div className="rounded-lg border border-slate-100 bg-white p-4">
                <p className="text-sm text-slate-500">
                  Total Columns
                </p>

                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {analysis.columns}
                </p>
              </div>
            </div>

            {/* Column names */}
            <div className="mt-5">
              <h4 className="mb-3 text-sm font-medium text-slate-700">
                Column Names
              </h4>

              <div className="flex flex-wrap gap-2">
                {analysis.column_names.map((column, index) => (
                  <Badge key={`${column}-${index}`} variant="secondary">
                    {column}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Success message */}
            <p className="mt-5 text-sm text-green-700">
              ✓ {analysis.message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}