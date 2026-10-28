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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

// Severity badge styles
const SEVERITY_STYLES = {
  info: "border-blue-200 bg-blue-50 text-blue-700",
  interesting: "border-purple-200 bg-purple-50 text-purple-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

// Icons for each insight severity
const SEVERITY_ICONS = {
  info: Info,
  interesting: Lightbulb,
  warning: AlertTriangle,
};

export default function AiInsights({
  file,
  classifications,
  disabled = false,
}: AiInsightsProps) {
  const [insights, setInsights] = useState<InsightResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  // Track which insight cards have expanded evidence
  const [expandedInsights, setExpandedInsights] = useState<number[]>([]);

  // Request AI insights from FastAPI
  async function generateInsights() {
    if (isGenerating || disabled) return;

    setIsGenerating(true);
    setError("");
    setInsights(null);
    setExpandedInsights([]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("Backend API URL is not configured.");
      }

      // Upload the CSV again for server-side statistical calculations
      const formData = new FormData();
      formData.append("file", file);

      // Send only confirmed column names and types
      formData.append(
        "classifications",
        JSON.stringify(classifications)
      );

      const response = await fetch(`${apiUrl}/api/insights`, {
        method: "POST",
        body: formData,
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getApiError(data, "Unable to generate AI insights.")
        );
      }

      const result = data as InsightsApiResponse;

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

  // Expand or collapse supporting evidence
  function toggleEvidence(index: number) {
    setExpandedInsights((previous) =>
      previous.includes(index)
        ? previous.filter((item) => item !== index)
        : [...previous, index]
    );
  }

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

          <Button
            type="button"
            onClick={generateInsights}
            disabled={isGenerating || disabled}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Insights...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                {insights ? "Regenerate Insights" : "Generate AI Insights"}
              </>
            )}
          </Button>
        </div>

        {/* Initial State */}
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

        {/* Loading State */}
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

        {/* API Error */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Generated Results */}
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
                            {insight.evidence.map((evidence, evidenceIndex) => (
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
                            ))}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}