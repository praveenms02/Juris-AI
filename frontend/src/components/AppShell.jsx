import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import NotificationBell from "./NotificationBell.jsx";

const linkClass = ({ isActive }) =>
  [
    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
    isActive
      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/30"
      : "text-slate-300 hover:bg-slate-900 hover:text-white",
  ].join(" ");

export default function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-full bg-slate-950">
      <div className="mx-auto flex min-h-full max-w-[1400px]">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/60 p-6 backdrop-blur lg:flex">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-2xl tracking-tight text-white">JurisAI</div>
              <div className="mt-1 text-xs text-slate-400">Document intelligence</div>
            </div>
            <NotificationBell />
          </div>

          <nav className="mt-10 flex-1 space-y-1">
            <NavLink to="/dashboard" className={linkClass}>
              <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
              Dashboard
            </NavLink>
            <NavLink to="/upload" className={linkClass}>
              <span className="h-2 w-2 rounded-full bg-sky-400/80" />
              Upload
            </NavLink>
            <NavLink to="/learning/hub" className={linkClass}>
              <span className="h-2 w-2 rounded-full bg-violet-400/80" />
              Learning Hub
            </NavLink>
            <NavLink to="/learning/forum" className={linkClass}>
              <span className="h-2 w-2 rounded-full bg-amber-400/80" />
              Discussions
            </NavLink>
          </nav>

          <div className="mt-auto pt-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs text-slate-400">Signed in as</div>
              <div className="mt-1 truncate text-sm font-medium text-white">{user?.name}</div>
              <div className="truncate text-xs text-slate-400">{user?.email}</div>
              <button
                type="button"
                onClick={logout}
                className="mt-4 w-full rounded-xl bg-slate-950 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900 transition"
              >
                Log out
              </button>
            </div>
          </div>
        </aside>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">

          {/* Mobile header */}
          <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/70 px-4 py-4 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-xl text-white">JurisAI</div>
                <div className="text-xs text-slate-400">Signed in as {user?.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-800"
                >
                  Log out
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
              {[
                { to: "/dashboard", label: "Dashboard" },
                { to: "/upload", label: "Upload" },
                { to: "/learning/hub", label: "Learning" },
                { to: "/learning/forum", label: "Discussions" },
              ].map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    isActive
                      ? "shrink-0 rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-sm text-emerald-200 ring-1 ring-emerald-500/30"
                      : "shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-center text-sm text-slate-200 ring-1 ring-slate-800"
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </header>

          <main className="p-4 sm:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
