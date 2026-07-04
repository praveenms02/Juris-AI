import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import Spinner from "../components/Spinner.jsx";

const CATEGORIES = [
  "Contracts",
  "Rental Agreements",
  "Employment",
  "Legal Learning",
  "General Discussion",
];

export default function DiscussionForum() {
  const navigate = useNavigate();
  const [discussions, setDiscussions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/discussions", { params: { category: category || undefined } });
      setDiscussions(data.discussions || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load discussions");
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    load();
  }, [load]);

  const createDiscussion = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    try {
      await api.post("/discussions", { title, content, category: category || "General Discussion" });
      setTitle("");
      setContent("");
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create discussion");
    }
  };

  const openDiscussion = async (id) => {
    try {
      const { data } = await api.get(`/discussions/${id}`);
      setSelected(data.discussion);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to load thread");
    }
  };

  const postReply = async () => {
    if (!selected || !reply.trim()) return;
    try {
      const { data } = await api.post(`/discussions/${selected._id}/reply`, { content: reply.trim() });
      setSelected(data.discussion);
      setReply("");
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to post reply");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="font-display text-4xl text-white">Discussion Forum</div>
        <Link
          to="/learning/hub"
          className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-sm text-amber-300 ring-1 ring-amber-500/20 hover:bg-amber-500/20 transition"
        >
          💬 Open a Room from Learning Hub
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={!category ? "rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/30" : "rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-800"}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={category === c ? "rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/30" : "rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-300 ring-1 ring-slate-800"}
          >
            {c}
          </button>
        ))}
      </div>

      <form onSubmit={createDiscussion} className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5 space-y-3">
        <div className="text-sm font-medium text-white">Start a discussion</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What would you like to discuss?"
          rows={3}
          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
        />
        <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">
          Post
        </button>
      </form>

      {error ? <p className="text-rose-300">{error}</p> : null}
      {loading ? <Spinner label="Loading discussions…" /> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {discussions.map((d) => (
              <button
              key={d._id}
              type="button"
              onClick={() => openDiscussion(d._id)}
              className="block w-full rounded-2xl border border-slate-800 bg-slate-900/30 p-4 text-left hover:border-emerald-500/30"
            >
              <div className="text-xs text-emerald-400">{d.category}</div>
              <div className="mt-1 font-medium text-white">{d.title}</div>
              <div className="mt-1 line-clamp-2 text-sm text-slate-400">{d.content}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-600">
                  {d.userId?.name || "User"} · {d.replies?.length || 0} replies
                </span>
                {d.documentId && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate(`/rooms/${d.documentId._id || d.documentId}`); }}
                    className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-300 ring-1 ring-amber-500/20 hover:bg-amber-500/20 transition"
                  >
                    💬 Open Room
                  </button>
                )}
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-slate-500 hover:text-slate-300">
              Close
            </button>
            <h2 className="mt-2 text-lg font-semibold text-white">{selected.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{selected.content}</p>
            <div className="mt-4 space-y-2">
              {(selected.replies || []).map((r) => (
                <div key={r._id} className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">
                  <span className="text-emerald-300">{r.userId?.name || "User"}:</span> {r.content}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              />
              <button type="button" onClick={postReply} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950">
                Reply
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
