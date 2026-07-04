import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client.js";
import AnalysisStatusPill from "../components/AnalysisStatusPill.jsx";
import ClauseCard from "../components/ClauseCard.jsx";
import FileTypeIcon from "../components/FileTypeIcon.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusPill from "../components/StatusPill.jsx";

function InsightCard({ title, icon, children, accent = "emerald" }) {
  const ring =
    accent === "sky"
      ? "ring-sky-500/20"
      : accent === "violet"
        ? "ring-violet-500/20"
        : accent === "amber"
          ? "ring-amber-500/20"
          : "ring-emerald-500/20";
  return (
    <section className={`rounded-3xl border border-slate-800 bg-slate-900/25 p-6 shadow-glow ring-1 ${ring}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span aria-hidden="true">{icon}</span>
        {title}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EntityRow({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value || "—"}</div>
    </div>
  );
}

function formatCurrency(val) {
  if (!val) return "";
  const cleaned = String(val).trim();
  // If value already starts with a currency symbol, return as-is (prevent double symbols)
  if (/^[^\d\s]/.test(cleaned)) {
    return cleaned;
  }
  return `₹${cleaned}`;
}

function RiskCard({ risk }) {
  const [open, setOpen] = useState(false);
  const severity = risk.severity || "Medium";
  const border =
    severity === "High"
      ? "border-rose-500/40 bg-rose-500/5"
      : severity === "Medium"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-sky-500/40 bg-sky-500/5";

  const badge =
    severity === "High"
      ? "bg-rose-500/15 text-rose-200 ring-rose-500/30"
      : severity === "Medium"
        ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
        : "bg-sky-500/15 text-sky-200 ring-sky-500/30";

  return (
    <div className={`rounded-2xl border p-4 ${border}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">{risk.clause}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${badge}`}>
              {severity} Risk
            </span>
            <span className="text-xs text-slate-400">({risk.category})</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">{risk.description}</p>
        </div>
        <span className="shrink-0 text-slate-500">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mt-3 border-t border-slate-800/60 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Recommendation</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{risk.suggestion}</p>
        </div>
      ) : null}
    </div>
  );
}

function highlightEntities(text, entities) {
  if (!text || !entities) return text;
  const values = Object.values(entities).filter((v) => v && String(v).length > 1);
  if (!values.length) return text;

  let result = text;
  const sorted = [...values].sort((a, b) => String(b).length - String(a).length);
  for (const val of sorted) {
    const escaped = String(val).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(escaped, "gi"),
      (m) => `<mark class="rounded bg-emerald-500/25 px-0.5 text-emerald-100">${m}</mark>`
    );
  }
  return result;
}

export default function DocumentDetailPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [explanationMode, setExplanationMode] = useState("normal");
  const [textView, setTextView] = useState("simple");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/documents/${id}`);
      setDoc(data.document);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const { data } = await api.post(`/documents/analyze/${id}`, {
        explanationMode,
      });
      setDoc(data.document);
    } catch (err) {
      setAnalysisError(
        err.response?.data?.analysisError ||
          err.response?.data?.message ||
          "Analysis failed"
      );
      if (err.response?.data?.document) {
        setDoc(err.response.data.document);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const entities = doc?.entities || {};
  const clauses = doc?.clauses || [];
  const risks = doc?.risks || [];
  const hasAnalysis = doc?.analysisStatus === "completed";

  const displayText = useMemo(() => {
    if (!doc) return "";
    if (textView === "simple" && doc.simplifiedText) return doc.simplifiedText;
    return doc.extractedText || "";
  }, [doc, textView]);

  const highlightedHtml = useMemo(() => {
    if (textView !== "legal" || !hasAnalysis) return null;
    return highlightEntities(displayText.slice(0, 12000), entities);
  }, [displayText, entities, hasAnalysis, textView]);

  const downloadSummary = () => {
    const lines = [
      `Document: ${doc?.originalname || ""}`,
      "",
      "Summary",
      doc?.shortSummary || doc?.summary || "",
      "",
      "Key details",
      `Owner: ${entities.owner || "—"}`,
      `Tenant: ${entities.tenant || "—"}`,
      `Rent: ${entities.rent || "—"}`,
      `Deposit: ${entities.deposit || "—"}`,
      `Duration: ${entities.duration || "—"}`,
      `Address: ${entities.address || "—"}`,
      "",
      "Clauses",
      ...(clauses.map((c) => `- ${c.title} (${c.importance}): ${c.text}`) || []),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc?.originalname || "document"}-summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Spinner label="Loading document insights…" />;
  }

  if (error || !doc) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard" className="text-sm text-emerald-300 hover:underline">
          ← Back to dashboard
        </Link>
        <div className="text-rose-300">{error || "Document not found"}</div>
      </div>
    );
  }

  const canAnalyze = doc.processingStatus === "completed" && (doc.extractedText || "").trim().length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/dashboard" className="text-sm text-emerald-300 hover:underline">
            ← Dashboard
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <FileTypeIcon filetype={doc.filetype} />
            <div>
              <h1 className="font-display text-3xl text-white">{doc.originalname}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <StatusPill status={doc.processingStatus} />
                <AnalysisStatusPill status={doc.analysisStatus} />
                <span>{doc.chunkCount ?? 0} chunks indexed</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={explanationMode}
            onChange={(e) => setExplanationMode(e.target.value)}
            disabled={analyzing}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none ring-emerald-500/30 focus:ring-2"
            aria-label="Explanation mode"
          >
            <option value="normal">Normal explanation</option>
            <option value="beginner">Beginner explanation</option>
          </select>
          <Link
            to={`/chat/${id}`}
            className="rounded-xl bg-violet-500/15 px-5 py-2.5 text-sm font-semibold text-violet-100 ring-1 ring-violet-500/40 hover:bg-violet-500/25"
          >
            Chat with document
          </Link>
          <Link
            to={`/risk/${id}`}
            className="rounded-xl bg-orange-500/15 px-5 py-2.5 text-sm font-semibold text-orange-100 ring-1 ring-orange-500/40 hover:bg-orange-500/25"
          >
            Risk Analysis
          </Link>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!canAnalyze || analyzing}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzing ? "Analyzing…" : hasAnalysis ? "Re-analyze document" : "Analyze document"}
          </button>
        </div>
      </div>

      {!canAnalyze ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          {doc.processingStatus !== "completed"
            ? "Wait until document processing completes before running analysis."
            : "No extracted text is available for this document."}
        </div>
      ) : null}

      {analyzing ? (
        <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-6">
          <Spinner label="Running AI analysis — summarization, entity extraction, and clause detection may take a few minutes on first run…" />
        </div>
      ) : null}

      {analysisError ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {analysisError}
        </div>
      ) : null}

      {hasAnalysis ? (
        <>
          <InsightCard title="Summary" icon="📊" accent="emerald">
            <p className="text-lg leading-relaxed text-slate-200">
              {doc.shortSummary || doc.summary || "No summary generated."}
            </p>
            {doc.summary && doc.summary !== doc.shortSummary ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-400">{doc.summary}</p>
            ) : null}
            <button
              type="button"
              onClick={downloadSummary}
              className="mt-4 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900"
            >
              Download summary
            </button>
          </InsightCard>

          <InsightCard title="Key details" icon="📌" accent="sky">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <EntityRow label="Owner" value={entities.owner} />
              <EntityRow label="Tenant" value={entities.tenant} />
              <EntityRow label="Rent" value={formatCurrency(entities.rent)} />
              <EntityRow label="Deposit" value={formatCurrency(entities.deposit)} />
              <EntityRow label="Duration" value={entities.duration} />
              <EntityRow label="Address" value={entities.address} />
            </div>
          </InsightCard>

          <InsightCard title="Detected risks" icon="⚠️" accent="rose">
            {risks.length === 0 ? (
              <p className="text-sm text-slate-400">No major risks detected in this document.</p>
            ) : (
              <div className="space-y-3">
                {risks.map((r, i) => (
                  <RiskCard key={`${r.clause}-${i}`} risk={r} />
                ))}
              </div>
            )}
          </InsightCard>

          <InsightCard title="Detected clauses" icon="📑" accent="amber">
            {clauses.length === 0 ? (
              <p className="text-sm text-slate-400">No clauses detected in this document.</p>
            ) : (
              <div className="space-y-3">
                {clauses.map((c, i) => (
                  <ClauseCard key={`${c.title}-${i}`} clause={c} defaultOpen={i === 0} />
                ))}
              </div>
            )}
          </InsightCard>

          <InsightCard title="Document text" icon="🧾" accent="violet">
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTextView("simple")}
                className={
                  textView === "simple"
                    ? "rounded-xl bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-100 ring-1 ring-violet-500/40"
                    : "rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-slate-800"
                }
              >
                Simple view
              </button>
              <button
                type="button"
                onClick={() => setTextView("legal")}
                className={
                  textView === "legal"
                    ? "rounded-xl bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-100 ring-1 ring-violet-500/40"
                    : "rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-slate-800"
                }
              >
                Legal view
              </button>
            </div>
            {textView === "legal" && highlightedHtml ? (
              <div
                className="max-h-[480px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-300"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ) : (
              <div className="max-h-[480px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-300">
                {displayText || "No simplified text available."}
              </div>
            )}
          </InsightCard>
        </>
      ) : (
        !analyzing && (
          <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/20 p-12 text-center">
            <div className="text-4xl">⚖️</div>
            <p className="mt-4 text-slate-300">
              Click <strong className="text-white">Analyze document</strong> to generate summary, key details,
              clauses, and a plain-language explanation.
            </p>
          </div>
        )
      )}
    </div>
  );
}
