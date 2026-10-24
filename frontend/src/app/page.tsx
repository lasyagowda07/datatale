"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  service: string;
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkBackend() {
      try {
        // Read the backend URL from our environment variable
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        // Send a GET request to FastAPI
        const response = await fetch(`${apiUrl}/health`);

        if (!response.ok) {
          throw new Error("Backend request failed");
        }

        // Convert the JSON response into a JavaScript object
        const data: HealthResponse = await response.json();

        setHealth(data);
      } catch {
        setError("Unable to connect to the backend.");
      }
    }

    checkBackend();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-3xl font-semibold text-slate-900">
          DataTale
        </h1>

        <p className="mb-8 text-slate-500">
          AI Data Storytelling & Visualization Studio
        </p>

        <h2 className="mb-3 text-lg font-medium text-slate-800">
          Backend Connection
        </h2>

        {health ? (
          <div className="rounded-lg bg-green-50 p-4 text-green-800">
            <p>✅ Connected successfully!</p>
            <p className="mt-2 text-sm">Status: {health.status}</p>
            <p className="text-sm">Service: {health.service}</p>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            ❌ {error}
          </div>
        ) : (
          <div className="rounded-lg bg-blue-50 p-4 text-blue-800">
            Connecting to FastAPI...
          </div>
        )}
      </div>
    </main>
  );
}