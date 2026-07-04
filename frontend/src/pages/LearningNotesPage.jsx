import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client.js";
import Spinner from "../components/Spinner.jsx";

const NOTE_TYPES = [
  { id: "revision", label: "Revision Notes" },
  { id: "exam", label: "Exam Prep" },
  { id: "quick_reference", label: "Quick Reference" },
  { id: "key_takeaways", label: "Key Takeaways" },
];

export default function LearningNotesPage() {
  const { documentId } = useParams();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [noteType, setNoteType] = useState("revision");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/notes/${documentId}`);
      setNotes(data.notes || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      await api.post(`/notes/generate/${documentId}`, { noteType });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate notes");
    } finally {
      setGenerating(false);
    }
  };

  const exportNotes = async () => {
    try {
      const { data } = await api.get(`/notes/${documentId}/export`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jurisai-notes-${documentId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || "Export failed");
    }
  };

  const active = notes.find((n) => n.noteType === noteType) || notes[0];

  if (loading) return <Spinner label="Loading notes…" />;

  return (
    <div className="space-y-6">
      <Link to="/learning/hub" className="text-sm text-emerald-300 hover:underline">
        ← Learning Hub
      </Link>
      <div className="font-display text-3xl text-white">Study Notes</div>

      <div className="flex flex-wrap gap-2">
        {NOTE_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setNoteType(t.id)}
            className={
              noteType === t.id
                ? "rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/30"
                : "rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-800"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate Notes"}
        </button>
        {active ? (
          <button
            type="button"
            onClick={exportNotes}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
          >
            Export
          </button>
        ) : null}
      </div>

      {error ? <p className="text-rose-300">{error}</p> : null}

      {active ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
          <h2 className="text-lg font-semibold text-white">{active.title}</h2>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-300">
            {active.content}
          </pre>
        </div>
      ) : (
        <p className="text-sm text-slate-400">No notes yet. Click Generate Notes to create them from your document.</p>
      )}
    </div>
  );
}
