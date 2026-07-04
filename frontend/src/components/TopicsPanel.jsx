import Spinner from "./Spinner.jsx";

export default function TopicsPanel({ data, loading, onGenerate, onSelectTopic }) {
  if (loading) return <Spinner label="Extracting topics…" />;

  if (!data?.topics?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
        <p className="text-sm text-slate-400">Navigate your document by topic — click to highlight the relevant section.</p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-4 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950"
        >
          Extract Topics
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document outline</div>
      {data.topics.map((topic) => (
        <button
          key={topic.title}
          type="button"
          onClick={() => onSelectTopic?.(topic)}
          className="block w-full rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-left hover:border-emerald-500/40 hover:bg-emerald-500/5"
        >
          <div className="font-medium text-white">{topic.title}</div>
          <p className="mt-1 line-clamp-2 text-xs text-slate-400">{topic.summary}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-600">
            {topic.page ? <span>Page ~{topic.page}</span> : null}
            {topic.clause ? <span>{topic.clause}</span> : null}
            {(topic.keywords || []).slice(0, 3).map((k) => (
              <span key={k} className="rounded bg-slate-950 px-1.5 py-0.5">{k}</span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
