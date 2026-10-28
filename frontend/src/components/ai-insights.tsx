"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Lightbulb,
  Info,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Download,
  FileText,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// --------------------------------------------------
// Types
// --------------------------------------------------

// User-confirmed column classifications
type ColumnType = "numeric" | "categorical" | "skip";

type ColumnClassification = {
  name: string;
  type: ColumnType;
};

// Evidence supporting an AI insight
type InsightEvidence = {
  column: string;
  metric: string;
  value: string;
};

// Individual AI insight
type DataInsight = {
  title: string;
  finding: string;
  evidence: InsightEvidence[];
  interpretation: string;
  caveat: string;
  severity: "info" | "interesting" | "warning";
};

// Claude's structured storytelling response
type InsightResponse = {
  dataset_summary: string;
  insights: DataInsight[];
  overall_caveats: string[];
};

// API response from /api/insights
type InsightsApiResponse = {
  filename: string;
  storytelling: InsightResponse;
  message: string;
};

// Component properties
type AiInsightsProps = {
  file: File;
  classifications: ColumnClassification[];
  disabled?: boolean;
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

// Extract readable FastAPI errors
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

// Extract error details from an unsuccessful response
async function getResponseError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data: unknown = await response.json();

    return getApiError(data, fallback);
  } catch {
    return fallback;
  }
}

// Generate a safe PDF filename
function getReportFilename(filename: string) {
  const nameWithoutExtension = filename.replace(/\.csv$/i, "");

  const safeName = nameWithoutExtension
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${safeName || "dataset"}_DataTale_Report.pdf`;
}

// --------------------------------------------------
// Severity configuration
// --------------------------------------------------

const SEVERITY_STYLES = {
  info: "border-blue-200 bg-blue-50 text-blue-700",
  interesting: "border-purple-200 bg-purple-50 text-purple-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

const SEVERITY_ICONS = {
  info: Info,
  interesting: Lightbulb,
  warning: AlertTriangle,
};

// --------------------------------------------------
// Main component
// --------------------------------------------------

export default function AiInsights({
  file,
  classifications,
  disabled = false,
}: AiInsightsProps) {
  // AI insights state
  const [insights, setInsights] = useState<InsightResponse | null>(null);

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Error states
  const [error, setError] = useState("");
  const [downloadError, setDownloadError] = useState("");

  // Download success state
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Track which insight cards have expanded evidence
  const [expandedInsights, setExpandedInsights] = useState<number[]>([]);

  // --------------------------------------------------
  // Generate AI insights
  // --------------------------------------------------

  async function generateInsights() {
    if (isGenerating || isDownloading || disabled) return;

    setIsGenerating(true);
    setError("");
    setInsights(null);
    setExpandedInsights([]);
    setDownloadError("");
    setDownloadSuccess(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("Backend API URL is not configured.");
      }

      // Prepare CSV upload
      const formData = new FormData();

      formData.append("file", file);

      // Send user-confirmed classifications
      formData.append(
        "classifications",
        JSON.stringify(classifications)
      );

      // Request insights from FastAPI
      const response = await fetch(`${apiUrl}/api/insights`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
            "Unable to generate AI insights."
          )
        );
      }

      const result: InsightsApiResponse = await response.json();

      // Store Claude's insights in React state
      setInsights(result.storytelling);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while generating insights."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  // --------------------------------------------------
  // Download PDF report
  // --------------------------------------------------

  async function downloadPdfReport() {
    // Require generated insights before downloading
    if (
      !insights ||
      isDownloading ||
      isGenerating ||
      disabled
    ) {
      return;
    }

    setIsDownloading(true);
    setDownloadError("");
    setDownloadSuccess(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("Backend API URL is not configured.");
      }

      // Prepare the report request
      const formData = new FormData();

      // Include the original CSV
      formData.append("file", file);

      // Include user-confirmed classifications
      formData.append(
        "classifications",
        JSON.stringify(classifications)
      );

      // Reuse existing Claude insights
      // No additional Claude API request is needed
      formData.append(
        "insights",
        JSON.stringify(insights)
      );

      // Request the PDF from FastAPI
      const response = await fetch(`${apiUrl}/api/report`, {
        method: "POST",
        body: formData,
      });

      // Handle backend errors
      if (!response.ok) {
        throw new Error(
          await getResponseError(
            response,
            "Unable to generate the PDF report."
          )
        );
      }

      // Verify the backend returned a PDF
      const contentType = response.headers.get("content-type");

      if (!contentType?.includes("application/pdf")) {
        throw new Error(
          "The server did not return a valid PDF response."
        );
      }

      // Convert the response into a downloadable file
      const pdfBlob = await response.blob();

      if (pdfBlob.size === 0) {
        throw new Error("The generated PDF is empty.");
      }

      // Create a temporary browser URL
      const downloadUrl = URL.createObjectURL(pdfBlob);

      // Create an invisible download link
      const downloadLink = document.createElement("a");

      downloadLink.href = downloadUrl;
      downloadLink.download = getReportFilename(file.name);

      document.body.appendChild(downloadLink);

      // Trigger the browser download
      downloadLink.click();

      // Clean up temporary resources
      downloadLink.remove();

      // Release the object URL after the browser starts the download
      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);

      setDownloadSuccess(true);
    } catch (caughtError) {
      setDownloadError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong while downloading the PDF."
      );
    } finally {
      setIsDownloading(false);
    }
  }

  // --------------------------------------------------
  // Expand or collapse evidence
  // --------------------------------------------------

  function toggleEvidence(index: number) {
    setExpandedInsights((previous) =>
      previous.includes(index)
        ? previous.filter((item) => item !== index)
        : [...previous, index]
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="p-6">
        {/* Section Heading */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-600" />

              <h2 className="text-xl font-semibold text-slate-900">
                AI Insights & Storytelling
              </h2>
            </div>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Discover meaningful patterns and understand what your
              statistics reveal, powered by Claude.
            </p>
          </div>

          {/* Generate Insights Button */}
          <Button
            type="button"
            onClick={generateInsights}
            disabled={isGenerating || isDownloading || disabled}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Insights...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />

                {insights
                  ? "Regenerate Insights"
                  : "Generate AI Insights"}
              </>
            )}
          </Button>
        </div>

        {/* --------------------------------------------------
            Initial State
        -------------------------------------------------- */}

        {!insights && !isGenerating && !error && (
          <div className="rounded-xl bg-purple-50 p-6 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-purple-500" />

            <p className="font-medium text-slate-900">
              Your dataset is ready for AI storytelling.
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Generate evidence-backed findings from your calculated
              statistics.
            </p>
          </div>
        )}

        {/* --------------------------------------------------
            Loading State
        -------------------------------------------------- */}

        {isGenerating && (
          <div
            role="status"
            className="rounded-xl border border-purple-100 bg-purple-50 p-8 text-center"
          >
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-purple-600" />

            <p className="font-medium text-slate-900">
              Claude is analyzing your statistics...
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Identifying patterns, checking evidence, and generating
              explanations.
            </p>
          </div>
        )}

        {/* --------------------------------------------------
            AI Error
        -------------------------------------------------- */}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* --------------------------------------------------
            Generated Insights
        -------------------------------------------------- */}

        {insights && (
          <div className="space-y-6">
            {/* Dataset Summary */}
            <div className="rounded-xl border border-purple-100 bg-purple-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600" />

                <h3 className="font-semibold text-slate-900">
                  Dataset Summary
                </h3>
              </div>

              <p className="text-sm leading-7 text-slate-700">
                {insights.dataset_summary}
              </p>
            </div>

            {/* Insight Cards */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">
                Key Findings ({insights.insights.length})
              </h3>

              {insights.insights.map((insight, index) => {
                const SeverityIcon = SEVERITY_ICONS[insight.severity];

                const isExpanded = expandedInsights.includes(index);

                return (
                  <div
                    key={`${insight.title}-${index}`}
                    className="rounded-xl border border-slate-200 p-5"
                  >
                    {/* Insight Header */}
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <h4 className="max-w-2xl font-semibold text-slate-900">
                        {insight.title}
                      </h4>

                      <Badge
                        variant="outline"
                        className={SEVERITY_STYLES[insight.severity]}
                      >
                        <SeverityIcon className="mr-1 h-3 w-3" />

                        {insight.severity === "interesting"
                          ? "Interesting"
                          : insight.severity === "warning"
                            ? "Warning"
                            : "Observation"}
                      </Badge>
                    </div>

                    {/* Statistical Finding */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Finding
                      </p>

                      <p className="text-sm leading-7 text-slate-700">
                        {insight.finding}
                      </p>
                    </div>

                    {/* AI Interpretation */}
                    <div className="mt-5 rounded-lg bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Interpretation
                      </p>

                      <p className="text-sm leading-7 text-slate-700">
                        {insight.interpretation}
                      </p>
                    </div>

                    {/* Evidence Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleEvidence(index)}
                      aria-expanded={isExpanded}
                      className="mt-5 flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}

                      {isExpanded
                        ? "Hide supporting evidence"
                        : `View supporting evidence (${insight.evidence.length})`}
                    </button>

                    {/* Expanded Evidence */}
                    {isExpanded && (
                      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full min-w-[400px] text-left text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-4 py-3 font-medium">
                                Column
                              </th>

                              <th className="px-4 py-3 font-medium">
                                Metric
                              </th>

                              <th className="px-4 py-3 font-medium">
                                Value
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {insight.evidence.map(
                              (evidence, evidenceIndex) => (
                                <tr
                                  key={evidenceIndex}
                                  className="border-t border-slate-100"
                                >
                                  <td className="break-words px-4 py-3 text-slate-900">
                                    {evidence.column}
                                  </td>

                                  <td className="break-words px-4 py-3 text-slate-600">
                                    {evidence.metric}
                                  </td>

                                  <td className="break-words px-4 py-3 font-medium text-slate-900">
                                    {evidence.value}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Insight Caveat */}
                    <div className="mt-5 flex items-start gap-2 text-sm text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                      <p className="leading-6">
                        {insight.caveat}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Overall Caveats */}
            {insights.overall_caveats.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />

                  <h3 className="font-semibold text-slate-900">
                    Important Limitations
                  </h3>
                </div>

                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  {insights.overall_caveats.map((caveat, index) => (
                    <li key={index}>{caveat}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* --------------------------------------------------
                PDF Report Download Section
            -------------------------------------------------- */}

            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                {/* Report Information */}
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-blue-100 p-3">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Your DataTale Report Is Ready
                    </h3>

                    <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600">
                      Download a complete PDF containing your dataset
                      overview, statistical analysis, visualizations,
                      and AI-generated insights.
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Includes charts, supporting evidence, and
                      important limitations.
                    </p>
                  </div>
                </div>

                {/* Download Button */}
                <Button
                  type="button"
                  onClick={downloadPdfReport}
                  disabled={isDownloading || isGenerating || disabled}
                  className="shrink-0"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing PDF...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF Report
                    </>
                  )}
                </Button>
              </div>

              {/* Download Error */}
              {downloadError && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {downloadError}
                </div>
              )}

              {/* Download Success */}
              {downloadSuccess && !downloadError && (
                <div
                  role="status"
                  className="mt-4 flex items-center gap-2 text-sm text-green-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Your PDF download has started.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}