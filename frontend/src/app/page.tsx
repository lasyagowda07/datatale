import CsvUpload from "@/components/csv-upload";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-blue-600 uppercase">
            AI-Powered Analytics
          </p>

          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            datatale
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
            Turn raw datasets into meaningful insights, beautiful
            visualizations, and compelling data stories.
          </p>
        </div>

        <CsvUpload />

        <p className="mt-6 text-center text-xs text-slate-400">
          Your dataset is processed temporarily and is not permanently stored.
        </p>
      </div>
    </main>
  );
}