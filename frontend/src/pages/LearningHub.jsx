import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import Spinner from "../components/Spinner.jsx";
import FileTypeIcon from "../components/FileTypeIcon.jsx";
import { MessageCircle, Globe, Lock, BookOpen, ClipboardList, BarChart2, FileText } from "lucide-react";

function StatCard({ icon: Icon, title, value, color }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 flex items-center gap-4">
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
        <div className="mt-0.5 text-2xl font-semibold text-white">{value}</div>
      </div>
    </div>
  );
}

export default function LearningHub() {
  const [documents, setDocuments] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [docsRes, dashRes, roomsRes] = await Promise.allSettled([
          api.get("/documents"),
          api.get("/learning/dashboard"),
          api.get("/rooms"),
        ]);
        if (docsRes.status === "fulfilled") {
          setDocuments((docsRes.value.data.documents || []).filter((d) => d.processingStatus === "completed"));
        }
        if (dashRes.status === "fulfilled") setDashboard(dashRes.value.data.dashboard);
        if (roomsRes.status === "fulfilled") setRooms(roomsRes.value.data.rooms || []);
        if (docsRes.status === "rejected") {
          setError(docsRes.reason?.response?.data?.message || "Failed to load documents");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner label="Loading learning hub…" />;

  const d = dashboard || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="font-display text-4xl text-white">Learning Hub</div>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Study your legal documents with AI-generated notes, quizzes, annotations, and real-time discussions.
        </p>
      </div>

      {error ? <p className="text-rose-300">{error}</p> : null}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText}      title="Documents studied" value={d.documentsStudied ?? 0}       color="bg-emerald-500/20" />
        <StatCard icon={BookOpen}      title="Notes generated"   value={d.notesGenerated ?? 0}         color="bg-sky-500/20" />
        <StatCard icon={ClipboardList} title="Quizzes taken"     value={d.quizzesTaken ?? 0}           color="bg-violet-500/20" />
        <StatCard icon={BarChart2}     title="Average score"     value={`${d.averageQuizScore ?? 0}%`} color="bg-amber-500/20" />
      </div>

      {/* Active Discussion Rooms */}
      {rooms.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <MessageCircle className="h-4 w-4 text-amber-400" />
              Active Discussion Rooms
            </div>
            <Link to="/learning/forum" className="text-xs text-slate-500 hover:text-emerald-300 transition">
              View all →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.slice(0, 6).map((r) => (
              <Link
                key={r._id}
                to={`/rooms/${r.documentId?._id || r.documentId}`}
                className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm hover:border-amber-500/30 transition"
              >
                {r.visibility === "private"
                  ? <Lock className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  : <Globe className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                <span className="truncate text-slate-300 flex-1">{r.title}</span>
                <span className="text-xs text-slate-600 shrink-0">{r.messageCount || 0} msgs</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent quiz attempts */}
      {(d.recentAttempts || []).length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
          <div className="text-sm font-semibold text-white mb-4">Recent Quiz Attempts</div>
          <div className="space-y-2">
            {d.recentAttempts.map((a) => (
              <div key={a._id} className="flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-sm">
                <span className="text-slate-300 truncate">{a.documentId?.originalname || "Document"}</span>
                <span className="text-emerald-300 font-medium shrink-0 ml-2">{a.score}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document cards */}
      <div>
        <div className="mb-4 text-sm font-semibold text-slate-400 uppercase tracking-wide">Your Documents</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 hover:border-slate-700 transition"
            >
              <div className="flex items-start gap-3">
                <FileTypeIcon filetype={doc.filetype} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">{doc.originalname}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {doc.analysisStatus === "completed" ? "✓ Analyzed" : "Not analyzed yet"}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/learning/notes/${doc._id}`}
                  className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 transition"
                >
                  Study Notes
                </Link>
                <Link
                  to={`/learning/quiz/${doc._id}`}
                  className="rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs text-sky-200 ring-1 ring-sky-500/30 hover:bg-sky-500/20 transition"
                >
                  Quiz
                </Link>
                <Link
                  to={`/learning/annotate/${doc._id}`}
                  className="rounded-lg bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/20 transition"
                >
                  Annotate
                </Link>
                <Link
                  to={`/chat/${doc._id}`}
                  className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs text-slate-300 ring-1 ring-slate-800 hover:text-emerald-200 transition"
                >
                  AI Chat
                </Link>
                <Link
                  to={`/rooms/${doc._id}`}
                  className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 ring-1 ring-amber-500/30 hover:bg-amber-500/20 transition"
                >
                  💬 Discuss
                </Link>
              </div>
            </div>
          ))}
        </div>

        {documents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-400">
            Upload and process a document first to start learning.
            <div className="mt-4">
              <Link to="/upload" className="text-emerald-300 hover:underline">
                Go to Upload →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
