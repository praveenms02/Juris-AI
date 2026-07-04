import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bot, ChevronRight, Lock, MessageCircle,
  Paperclip, Send, Settings, Sparkles, Users, Globe, Wifi, WifiOff,
} from "lucide-react";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import Spinner from "../components/Spinner.jsx";
import RoomSettingsModal from "../components/RoomSettingsModal.jsx";

// ── helpers ────────────────────────────────────────────────────────────────

function initials(name = "") {
  return name.split(" ").map((w) => w[0] || "").join("").toUpperCase().slice(0, 2);
}

function avatarColor(name = "") {
  const colors = [
    "bg-emerald-500", "bg-sky-500", "bg-violet-500",
    "bg-amber-500", "bg-rose-500", "bg-teal-500", "bg-indigo-500",
  ];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Avatar({ name, size = "md" }) {
  const sz = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <div className={`${sz} ${avatarColor(name)} flex items-center justify-center rounded-full font-semibold text-white shrink-0`}>
      {initials(name)}
    </div>
  );
}

function TypingIndicator({ typingUsers }) {
  const names = typingUsers.filter((u) => u.userName !== "JurisAI");
  if (!names.length) return null;
  const label = names.length === 1
    ? `${names[0].userName} is typing…`
    : `${names.map((u) => u.userName).join(", ")} are typing…`;
  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-slate-500">
      <span className="flex gap-0.5">
        <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
        <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
        <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
      </span>
      {label}
    </div>
  );
}

function MessageBubble({ msg, currentUserId, onReply, onSectionClick }) {
  const isAI = msg.role === "ai";
  const isOwn = !isAI && msg.senderId?._id === currentUserId || msg.senderId === currentUserId;
  const name = isAI ? "JurisAI" : (msg.senderName || "User");

  return (
    <div className={`group flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}>
      {isAI ? (
        <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
      ) : (
        <Avatar name={name} />
      )}

      <div className={`flex max-w-[70%] flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && (
          <span className="text-xs text-slate-500">{name}</span>
        )}

        {/* Section anchor badge */}
        {msg.sectionRef?.clauseTitle && (
          <button
            onClick={() => onSectionClick?.(msg.sectionRef)}
            className="flex items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300 ring-1 ring-violet-500/20 hover:bg-violet-500/20 transition"
          >
            <Paperclip className="h-3 w-3" />
            {msg.sectionRef.clauseTitle}
          </button>
        )}

        {/* Reply preview */}
        {msg.replyTo?.content && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-400 max-w-xs truncate">
            ↩ {msg.replyTo.senderName}: {msg.replyTo.content}
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isAI
              ? "bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/20 text-slate-200"
              : isOwn
              ? "bg-emerald-500 text-slate-950 font-medium"
              : "bg-slate-800 text-slate-200"
          }`}
        >
          {msg.content}
        </div>

        {/* AI Sources */}
        {isAI && msg.sources?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {msg.sources.slice(0, 3).map((s, i) => (
              <span key={i} className="rounded-md bg-slate-900 px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-800">
                § {s.chunk_index ?? i + 1}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
          <span className="text-xs text-slate-600">{timeAgo(msg.createdAt)}</span>
          {!isAI && (
            <button
              onClick={() => onReply(msg)}
              className="text-xs text-slate-500 hover:text-emerald-300 transition"
            >
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ParticipantRow({ p, isOwner, currentUserId, onRemove }) {
  const uid = p.userId?._id || p.userId;
  const name = p.userId?.name || "User";
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-900/50 transition">
      <div className="relative shrink-0">
        <Avatar name={name} size="sm" />
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 ${p.isOnline ? "bg-emerald-400" : "bg-slate-600"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white">{name}</div>
        <div className="text-xs text-slate-500 capitalize">{p.role}</div>
      </div>
      {isOwner && uid !== currentUserId && (
        <button onClick={() => onRemove(uid)} className="text-xs text-rose-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition shrink-0">✕</button>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function DiscussionRoom() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);

  // Input state
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [isAskingAI, setIsAskingAI] = useState(false);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [activeClauseIdx, setActiveClauseIdx] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimer = useRef(null);

  // ── Load room ────────────────────────────────────────────────────────────
  const loadRoom = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/rooms/document/${documentId}`);
      setRoom(data.room);
      setParticipants(data.room.participants || []);
    } catch (err) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
      } else if (err.response?.status === 404) {
        setError("no_room");
      } else {
        setError(err.response?.data?.message || "Failed to load room");
      }
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  // ── Socket.IO room join ───────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !room?._id) return;

    socket.emit("room:join", { roomId: room._id }, (response) => {
      if (response?.ok) {
        setMessages(response.messages || []);
      }
    });

    // Listen for new messages
    const onMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const onPresence = ({ participants: updated }) => {
      setParticipants(updated);
    };

    const onTyping = ({ userId, userName, isTyping }) => {
      setTypingUsers((prev) => {
        if (isTyping) {
          const exists = prev.some((u) => u.userId === userId);
          return exists ? prev : [...prev, { userId, userName }];
        }
        return prev.filter((u) => u.userId !== userId);
      });
    };

    socket.on("message:new", onMessage);
    socket.on("presence:update", onPresence);
    socket.on("typing:update", onTyping);

    return () => {
      socket.emit("room:leave", { roomId: room._id });
      socket.off("message:new", onMessage);
      socket.off("presence:update", onPresence);
      socket.off("typing:update", onTyping);
    };
  }, [socket, room?._id]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // ── Typing indicator ──────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!socket || !room?._id) return;
    socket.emit("typing:start", { roomId: room._id });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit("typing:stop", { roomId: room._id });
    }, 2000);
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || isSending || !socket || !room) return;
    setIsSending(true);
    const content = input.trim();
    setInput("");
    setReplyTo(null);

    socket.emit("message:send", {
      roomId: room._id,
      content,
      replyTo: replyTo?._id || null,
      sectionRef: selectedSection,
    }, (res) => {
      if (!res?.ok) setError(res?.error || "Failed to send message");
      setIsSending(false);
    });

    setSelectedSection(null);
    socket.emit("typing:stop", { roomId: room._id });
  };

  // ── Ask AI ────────────────────────────────────────────────────────────────
  const askAI = async () => {
    if (!input.trim() || isAskingAI || !socket || !room) return;
    setIsAskingAI(true);
    const query = input.trim();
    setInput("");

    socket.emit("message:ai", {
      roomId: room._id,
      query,
      sectionRef: selectedSection,
    }, (res) => {
      if (!res?.ok) setError(res?.error || "AI unavailable");
      setIsAskingAI(false);
    });

    setSelectedSection(null);
  };

  // ── Create room ───────────────────────────────────────────────────────────
  const createRoom = async () => {
    try {
      const { data } = await api.post("/rooms", { documentId });
      setRoom(data.room);
      setParticipants(data.room.participants || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create room");
    }
  };

  // ── Generate AI Summary ───────────────────────────────────────────────────
  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const { data } = await api.post(`/rooms/${room._id}/summary`);
      setSummary(data.summary);
      setShowSummaryModal(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  // ── Remove participant ────────────────────────────────────────────────────
  const removeParticipant = async (targetUserId) => {
    try {
      await api.delete(`/rooms/${room._id}/participants/${targetUserId}`);
      await loadRoom();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove participant");
    }
  };

  const clauses = room?.documentId?.clauses || [];
  const isOwner = room?.ownerId?._id === user?.id || room?.ownerId === user?.id;
  const onlineCount = participants.filter((p) => p.isOnline).length;

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Spinner label="Loading discussion room…" />
    </div>
  );

  if (accessDenied) return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-10">
        <Lock className="mx-auto h-12 w-12 text-rose-400" />
        <div className="mt-4 text-xl font-semibold text-white">Access Denied</div>
        <p className="mt-2 text-sm text-slate-400">
          This is a private discussion room. Ask the owner to invite you.
        </p>
        <button onClick={() => navigate(-1)} className="mt-6 rounded-xl bg-slate-800 px-5 py-2 text-sm text-slate-200 hover:bg-slate-700 transition">
          ← Go Back
        </button>
      </div>
    </div>
  );

  if (error === "no_room") return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-10">
        <MessageCircle className="mx-auto h-12 w-12 text-slate-500" />
        <div className="mt-4 text-xl font-semibold text-white">No Discussion Room Yet</div>
        <p className="mt-2 text-sm text-slate-400">
          Start a collaborative discussion room for this document.
        </p>
        <button
          onClick={createRoom}
          className="mt-6 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
        >
          Create Discussion Room
        </button>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex h-[80vh] items-center justify-center">
      <p className="text-rose-300">{error}</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900/60 px-4 py-3 backdrop-blur shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-white">{room?.title}</span>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              room?.visibility === "private"
                ? "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20"
                : "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20"
            }`}>
              {room?.visibility === "private" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              {room?.visibility}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {participants.length} members · {onlineCount} online
            </span>
            <span className="flex items-center gap-1">
              {connected
                ? <><Wifi className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">Live</span></>
                : <><WifiOff className="h-3 w-3 text-slate-600" />Reconnecting…</>
              }
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="flex items-center gap-1.5 rounded-xl bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 ring-1 ring-violet-500/20 hover:bg-violet-500/20 transition disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {summaryLoading ? "Generating…" : "AI Summary"}
          </button>
          {isOwner && (
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Document Sections */}
        {clauses.length > 0 && (
          <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-800/60 bg-slate-950/40 xl:flex">
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Document Sections
            </div>
            <div className="flex-1 overflow-y-auto space-y-0.5 px-2 pb-4">
              {clauses.map((clause, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveClauseIdx(i);
                    setSelectedSection({ clauseIndex: i, clauseTitle: clause.title, excerpt: clause.text?.slice(0, 200) });
                    inputRef.current?.focus();
                  }}
                  className={`w-full rounded-xl px-3 py-2 text-left text-xs transition ${
                    activeClauseIdx === i
                      ? "bg-violet-500/10 text-violet-200 ring-1 ring-violet-500/20"
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span className="truncate">{clause.title || `Clause ${i + 1}`}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Center: Chat */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <MessageCircle className="h-10 w-10 text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No messages yet. Start the discussion!</p>
                <p className="text-slate-600 text-xs mt-1">Use "Ask AI" to get RAG-powered legal analysis</p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble
                key={msg._id}
                msg={msg}
                currentUserId={user?.id}
                onReply={setReplyTo}
                onSectionClick={(ref) => setActiveClauseIdx(ref.clauseIndex)}
              />
            ))}

            <TypingIndicator typingUsers={typingUsers} />
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Bar ─────────────────────────────────────────────── */}
          <div className="shrink-0 border-t border-slate-800 bg-slate-900/60 p-3 space-y-2 backdrop-blur">
            {/* Reply preview */}
            {replyTo && (
              <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-400">
                <span className="truncate flex-1">↩ Replying to <span className="text-emerald-300">{replyTo.senderName}</span>: {replyTo.content?.slice(0, 80)}</span>
                <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-white">✕</button>
              </div>
            )}

            {/* Section anchor preview */}
            {selectedSection && (
              <div className="flex items-center gap-2 rounded-lg bg-violet-500/10 px-3 py-1.5 text-xs text-violet-300 ring-1 ring-violet-500/20">
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate flex-1">Anchored to: {selectedSection.clauseTitle}</span>
                <button onClick={() => { setSelectedSection(null); setActiveClauseIdx(null); }} className="hover:text-white">✕</button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message… (Shift+Enter for new line, @mention users)"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition max-h-32"
                style={{ minHeight: "42px" }}
              />
              <button
                onClick={askAI}
                disabled={!input.trim() || isAskingAI || !connected}
                className="flex items-center gap-1.5 rounded-xl bg-violet-500/10 px-3 py-2.5 text-sm font-medium text-violet-300 ring-1 ring-violet-500/20 hover:bg-violet-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Bot className="h-4 w-4" />
                {isAskingAI ? "…" : "Ask AI"}
              </button>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isSending || !connected}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Participants */}
        <aside className="hidden w-56 shrink-0 flex-col border-l border-slate-800/60 bg-slate-950/40 lg:flex">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Participants ({participants.length})
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 group">
            {participants.map((p) => (
              <ParticipantRow
                key={p.userId?._id || p.userId}
                p={p}
                isOwner={isOwner}
                currentUserId={user?.id}
                onRemove={removeParticipant}
              />
            ))}
          </div>
        </aside>
      </div>

      {/* ── AI Summary Modal ─────────────────────────────────────────────── */}
      {showSummaryModal && summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <span className="font-semibold text-white">AI Meeting Summary</span>
              <button onClick={() => setShowSummaryModal(false)} className="ml-auto text-slate-500 hover:text-white">✕</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-6">
              <p className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">{summary.summary}</p>
              {summary.sources?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1">
                  <span className="text-xs text-slate-500 w-full mb-1">Sources:</span>
                  {summary.sources.map((s, i) => (
                    <span key={i} className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400">§ {s.chunk_index ?? i + 1}</span>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs text-slate-600">
                Generated from {summary.messageCount} messages · {new Date(summary.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ───────────────────────────────────────────────── */}
      {showSettings && room && (
        <RoomSettingsModal
          room={room}
          onClose={() => setShowSettings(false)}
          onUpdate={loadRoom}
        />
      )}
    </div>
  );
}
