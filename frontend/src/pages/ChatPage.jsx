import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client.js";
import DocumentTextViewer from "../components/DocumentTextViewer.jsx";
import ExplainPanel from "../components/ExplainPanel.jsx";
import FileTypeIcon from "../components/FileTypeIcon.jsx";
import LegalQAPanel from "../components/LegalQAPanel.jsx";
import QuizIntelligencePanel from "../components/QuizIntelligencePanel.jsx";
import Spinner from "../components/Spinner.jsx";
import StudyPanel from "../components/StudyPanel.jsx";
import TopicsPanel from "../components/TopicsPanel.jsx";

const MODES = [
  { id: "legal", label: "Legal Q&A" },
  { id: "explain", label: "Explain" },
  { id: "study", label: "Study" },
  { id: "quiz", label: "Quiz" },
  { id: "topics", label: "Topics" },
];

export default function ChatPage() {
  const { documentId } = useParams();
  const [document, setDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("legal");
  const [modeData, setModeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modeLoading, setModeLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [lastSources, setLastSources] = useState([]);
  const [highlightText, setHighlightText] = useState("");
  const [highlightChunk, setHighlightChunk] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/chat/${documentId}`);
      setDocument(data.document);
      setMessages(data.chat?.messages || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load document");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const runIntelligence = async (selectedMode) => {
    setModeLoading(true);
    setError("");
    try {
      const { data } = await api.post(`/chat/intelligence/${documentId}`, {
        mode: selectedMode,
      });
      setModeData(data);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.aiError || "Intelligence request failed");
    } finally {
      setModeLoading(false);
    }
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setModeData(null);
    setHighlightText("");
    setHighlightChunk(null);
    if (newMode !== "legal") {
      runIntelligence(newMode);
    }
  };

  const onSend = async (query) => {
    setSending(true);
    setError("");
    try {
      const { data } = await api.post("/chat", { documentId, query });
      setMessages(data.messages || []);
      setLastSources(data.sources || []);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.aiError || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const onHighlightSource = (source) => {
    setHighlightText(source.excerpt || source.text || "");
    setHighlightChunk(source.chunk_index ?? null);
  };

  const onSelectTopic = (topic) => {
    setHighlightText(topic.highlight_text || topic.summary || "");
    setHighlightChunk(topic.chunk_index ?? null);
  };

  const chatReady =
    document?.processingStatus === "completed" && (document?.chunkCount || 0) > 0;

  if (loading) return <Spinner label="Loading document intelligence…" />;

  if (error && !document) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard" className="text-sm text-emerald-300 hover:underline">← Dashboard</Link>
        <p className="text-rose-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/dashboard" className="text-sm text-emerald-300 hover:underline">← Dashboard</Link>
          <div className="mt-2 flex items-center gap-3">
            <FileTypeIcon filetype={document?.filetype} />
            <div>
              <h1 className="font-display text-3xl text-white">{document?.originalname}</h1>
              <p className="text-sm text-slate-400">Document intelligence platform</p>
            </div>
          </div>
        </div>
        <Link
          to={`/documents/${documentId}`}
          className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900"
        >
          Full analysis
        </Link>
      </div>

      {!chatReady ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Document must finish processing before using intelligence features.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleModeChange(m.id)}
            disabled={!chatReady}
            className={
              mode === m.id
                ? "rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-200 ring-1 ring-emerald-500/30"
                : "rounded-full bg-slate-950 px-4 py-1.5 text-xs text-slate-400 ring-1 ring-slate-800 hover:text-slate-200 disabled:opacity-50"
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Main layout: hide document in quiz mode ─────────────── */}
      {mode === "quiz" ? (
        <div className="max-w-2xl mx-auto w-full">
          <QuizIntelligencePanel
            data={modeData}
            loading={modeLoading}
            onGenerate={() => runIntelligence("quiz")}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</div>
            <DocumentTextViewer
              text={document?.extractedText}
              highlightText={highlightText}
              highlightChunkIndex={highlightChunk}
            />
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            {mode === "legal" ? (
              <LegalQAPanel
                messages={messages}
                onSend={onSend}
                loading={sending}
                disabled={!chatReady}
                onHighlightSource={onHighlightSource}
                lastSources={lastSources}
              />
            ) : null}

            {mode === "explain" ? (
              <ExplainPanel
                data={modeData}
                loading={modeLoading}
                onGenerate={() => runIntelligence("explain")}
              />
            ) : null}

            {mode === "study" ? (
              <StudyPanel
                data={modeData}
                loading={modeLoading}
                onGenerate={() => runIntelligence("study")}
              />
            ) : null}

            {mode === "topics" ? (
              <TopicsPanel
                data={modeData}
                loading={modeLoading}
                onGenerate={() => runIntelligence("topics")}
                onSelectTopic={onSelectTopic}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
