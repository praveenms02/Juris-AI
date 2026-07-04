import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client.js";
import Spinner from "../components/Spinner.jsx";

export default function AnnotationWorkspace() {
  const { documentId } = useParams();
  const [document, setDocument] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [selection, setSelection] = useState("");
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [activeAnnotation, setActiveAnnotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, annRes] = await Promise.all([
        api.get(`/documents/${documentId}`),
        api.get(`/annotations/${documentId}`),
      ]);
      setDocument(docRes.data.document);
      setAnnotations(annRes.data.annotations || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const handleMouseUp = () => {
    const text = window.getSelection()?.toString().trim();
    if (text) setSelection(text);
  };

  const saveAnnotation = async () => {
    if (!selection) return;
    try {
      await api.post("/annotations", { documentId, selectedText: selection, note });
      setSelection("");
      setNote("");
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save annotation");
    }
  };

  const postComment = async () => {
    if (!activeAnnotation || !comment.trim()) return;
    try {
      await api.post("/annotations/comment", {
        annotationId: activeAnnotation._id,
        comment: comment.trim(),
      });
      setComment("");
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to post comment");
    }
  };

  if (loading && !document) return <Spinner label="Loading workspace…" />;

  return (
    <div className="space-y-6">
      <Link to="/learning/hub" className="text-sm text-emerald-300 hover:underline">
        ← Learning Hub
      </Link>
      <div className="font-display text-3xl text-white">Annotation Workspace</div>
      <p className="text-sm text-slate-400">{document?.originalname}</p>

      {error ? <p className="text-rose-300">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div
          onMouseUp={handleMouseUp}
          className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/30 p-5 text-sm leading-relaxed text-slate-300"
        >
          {(document?.extractedText || "No text available.").slice(0, 12000)}
        </div>

        <div className="space-y-4">
          {selection ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="text-xs uppercase text-emerald-400">Selected text</div>
              <p className="mt-2 text-sm text-slate-200">{selection}</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add your note…"
                rows={3}
                className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={saveAnnotation}
                className="mt-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                Save Highlight
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select text in the document to highlight and annotate.</p>
          )}

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Annotations ({annotations.length})
            </div>
            {annotations.map((ann) => (
              <button
                key={ann._id}
                type="button"
                onClick={() => setActiveAnnotation(ann)}
                className={`block w-full rounded-xl border p-3 text-left text-sm ${
                  activeAnnotation?._id === ann._id
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-slate-800 bg-slate-950/50"
                }`}
              >
                <div className="text-slate-400">&ldquo;{ann.selectedText.slice(0, 80)}…&rdquo;</div>
                {ann.note ? <div className="mt-1 text-slate-200">{ann.note}</div> : null}
                <div className="mt-1 text-xs text-slate-600">
                  {ann.comments?.length || 0} comments · {ann.resolved ? "Resolved" : "Open"}
                </div>
              </button>
            ))}
          </div>

          {activeAnnotation ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="text-xs uppercase text-slate-500">Discussion</div>
              <div className="mt-2 space-y-2">
                {(activeAnnotation.comments || []).map((c) => (
                  <div key={c._id} className="rounded-lg bg-slate-950 p-2 text-xs text-slate-300">
                    <span className="text-emerald-300">{c.userId?.name || "User"}:</span> {c.comment}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Reply…"
                  className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  onClick={postComment}
                  className="rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-200"
                >
                  Reply
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
