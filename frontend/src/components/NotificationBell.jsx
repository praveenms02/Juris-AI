import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, MessageCircle, Users, Sparkles } from "lucide-react";
import api from "../api/client.js";
import { useSocket } from "../context/SocketContext.jsx";

function typeIcon(type) {
  if (type === "invite" || type === "room_joined") return <Users className="h-3.5 w-3.5 text-emerald-400" />;
  if (type === "mention") return <span className="text-xs font-bold text-violet-400">@</span>;
  if (type === "ai_summary") return <Sparkles className="h-3.5 w-3.5 text-violet-400" />;
  return <MessageCircle className="h-3.5 w-3.5 text-sky-400" />;
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(date).toLocaleDateString();
}

function notificationLabel(n) {
  const p = n.payload || {};
  switch (n.type) {
    case "invite":
      return `${p.invitedBy || "Someone"} invited you to "${p.roomTitle || "a room"}"`;
    case "room_joined":
      return `${p.joinedUser || "Someone"} joined your room "${p.roomTitle || ""}"`;
    case "mention":
      return `${p.mentionedBy || "Someone"} mentioned you`;
    case "reply":
      return `${p.repliedBy || "Someone"} replied to your message`;
    case "ai_summary":
      return "AI meeting summary is ready";
    default:
      return "New notification";
  }
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const { socket } = useSocket();
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const loadNotifications = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // poll every 30s as fallback
    return () => clearInterval(interval);
  }, []);

  // Real-time notification push via Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handler = () => loadNotifications();
    socket.on("notification:push", handler);
    return () => socket.off("notification:push", handler);
  }, [socket]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = async (notifId) => {
    try {
      await api.patch(`/notifications/${notifId}/read`);
      setNotifications((prev) => prev.map((n) => n._id === notifId ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  const handleNotificationClick = async (n) => {
    if (!n.read) await markRead(n._id);
    if (n.payload?.token) {
      // Invitation — navigate to accept page
      navigate(`/rooms/join?token=${n.payload.token}`);
    } else if (n.roomId) {
      const roomDocId = n.roomId?.documentId || n.documentId;
      if (roomDocId) navigate(`/rooms/${roomDocId}`);
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        id="notification-bell"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-300 transition"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No notifications yet</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-800/50 ${!n.read ? "bg-emerald-500/5" : ""}`}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800">
                    {typeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${n.read ? "text-slate-400" : "text-white"}`}>
                      {notificationLabel(n)}
                    </p>
                    <span className="mt-0.5 text-xs text-slate-600">{timeAgo(n.createdAt)}</span>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
