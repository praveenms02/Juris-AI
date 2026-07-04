import { useState } from "react";
import { Globe, Lock, Mail, Settings, Trash2, UserMinus, X } from "lucide-react";
import api from "../api/client.js";

export default function RoomSettingsModal({ room, onClose, onUpdate }) {
  const [visibility, setVisibility] = useState(room.visibility);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [removing, setRemoving] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);

  const handleVisibilityChange = async (newVis) => {
    setSavingVisibility(true);
    try {
      await api.patch(`/rooms/${room._id}/visibility`, { visibility: newVis });
      setVisibility(newVis);
      await onUpdate();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update visibility");
    } finally {
      setSavingVisibility(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    setInviteError("");
    setInviteStatus("");
    try {
      const { data } = await api.post(`/rooms/${room._id}/invite`, {
        emailOrUsername: inviteInput.trim(),
      });
      setInviteStatus(data.message);
      setInviteInput("");
    } catch (err) {
      setInviteError(err.response?.data?.message || "Failed to send invitation");
    }
  };

  const handleRemove = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from this room?`)) return;
    setRemoving(userId);
    try {
      await api.delete(`/rooms/${room._id}/participants/${userId}`);
      await onUpdate();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to remove participant");
    } finally {
      setRemoving("");
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/rooms/${room._id}`);
      onClose();
      window.location.href = "/learning/forum";
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete room");
    }
  };

  const members = room.participants || [];
  const ownerId = room.ownerId?._id || room.ownerId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-4">
          <Settings className="h-5 w-5 text-slate-400" />
          <span className="font-semibold text-white">Room Settings</span>
          <button onClick={onClose} className="ml-auto rounded-lg p-1 text-slate-500 hover:text-white hover:bg-slate-800 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {/* Room info */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Room</div>
            <p className="text-white font-medium">{room.title}</p>
          </div>

          {/* Visibility */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Visibility</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleVisibilityChange("public")}
                disabled={savingVisibility}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                  visibility === "public"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Globe className="h-5 w-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Public</div>
                  <div className="text-xs text-slate-500 mt-0.5">Any registered user can join</div>
                </div>
              </button>
              <button
                onClick={() => handleVisibilityChange("private")}
                disabled={savingVisibility}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                  visibility === "private"
                    ? "border-rose-500/40 bg-rose-500/10 text-white"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Lock className="h-5 w-5 text-rose-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium">Private</div>
                  <div className="text-xs text-slate-500 mt-0.5">Invite only</div>
                </div>
              </button>
            </div>
          </div>

          {/* Invite */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Invite User</div>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                value={inviteInput}
                onChange={(e) => { setInviteInput(e.target.value); setInviteStatus(""); setInviteError(""); }}
                placeholder="Email or username"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 transition"
              />
              <button
                type="submit"
                disabled={!inviteInput.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-40"
              >
                <Mail className="h-4 w-4" />
                Invite
              </button>
            </form>
            {inviteStatus && <p className="mt-2 text-xs text-emerald-400">{inviteStatus}</p>}
            {inviteError && <p className="mt-2 text-xs text-rose-400">{inviteError}</p>}
          </div>

          {/* Participants */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Participants ({members.length})
            </div>
            <div className="space-y-2">
              {members.map((p) => {
                const uid = p.userId?._id || p.userId;
                const name = p.userId?.name || "User";
                const isThisOwner = uid === ownerId;
                return (
                  <div key={uid} className="flex items-center gap-3 rounded-xl bg-slate-950 px-4 py-2.5">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                      ["bg-emerald-500","bg-sky-500","bg-violet-500","bg-amber-500"][name.charCodeAt(0) % 4]
                    }`}>
                      {name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{name}</div>
                      <div className="text-xs text-slate-500 capitalize">{p.role}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`h-2 w-2 rounded-full ${p.isOnline ? "bg-emerald-400" : "bg-slate-600"}`} />
                      {!isThisOwner && (
                        <button
                          onClick={() => handleRemove(uid, name)}
                          disabled={removing === uid}
                          className="rounded-lg p-1 text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-40"
                          title="Remove from room"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-rose-400 mb-2">Danger Zone</div>
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2 text-sm text-rose-300 ring-1 ring-rose-500/20 hover:bg-rose-500/20 transition"
              >
                <Trash2 className="h-4 w-4" />
                Delete Discussion Room
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-rose-300">Are you sure? This will delete all messages and cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition">
                    Yes, Delete
                  </button>
                  <button onClick={() => setDeleteConfirm(false)} className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
