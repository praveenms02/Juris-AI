import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import api from "../api/client.js";

export default function JoinRoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("loading"); // loading | success | error
  const [roomId, setRoomId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No invitation token provided.");
      return;
    }

    (async () => {
      try {
        const { data } = await api.post(`/rooms/join/accept?token=${encodeURIComponent(token)}`);
        setRoomId(data.roomId);
        setMessage(data.message);
        setStatus("success");
        // Auto-redirect after 2s
        setTimeout(() => {
          navigate(`/rooms/${data.roomId}`, { replace: true });
        }, 2000);
      } catch (err) {
        setStatus("error");
        setMessage(err.response?.data?.message || "Failed to accept invitation.");
      }
    })();
  }, [token, navigate]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center">
        {status === "loading" && (
          <>
            <Loader className="mx-auto h-12 w-12 animate-spin text-emerald-400" />
            <p className="mt-4 text-slate-300">Accepting your invitation…</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
            <div className="mt-4 text-lg font-semibold text-white">You're in!</div>
            <p className="mt-2 text-sm text-slate-400">{message}</p>
            <p className="mt-1 text-xs text-slate-600">Redirecting to the discussion room…</p>
            <button
              onClick={() => navigate(`/rooms/${roomId}`, { replace: true })}
              className="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
            >
              Go to Room Now
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-rose-400" />
            <div className="mt-4 text-lg font-semibold text-white">Invitation Failed</div>
            <p className="mt-2 text-sm text-slate-400">{message}</p>
            <button
              onClick={() => navigate("/learning/forum", { replace: true })}
              className="mt-6 w-full rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition"
            >
              Go to Discussion Forum
            </button>
          </>
        )}
      </div>
    </div>
  );
}
