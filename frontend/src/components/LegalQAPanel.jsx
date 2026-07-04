import ChatBox from "./ChatBox.jsx";

function SourceCitation({ source, onHighlight }) {
  return (
    <button
      type="button"
      onClick={() => onHighlight?.(source)}
      className="block w-full rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-left text-xs hover:border-emerald-500/40"
    >
      <div className="font-medium text-emerald-300">{source.clause || "Excerpt"}</div>
      <div className="mt-1 text-slate-400">
        Page {source.page ?? "?"} · Confidence {source.confidence ?? "?"}%
      </div>
      <div className="mt-2 line-clamp-2 text-slate-500">{source.excerpt || source.text}</div>
      <div className="mt-1 text-[10px] text-slate-600">Click to highlight in document</div>
    </button>
  );
}

export default function LegalQAPanel({
  messages,
  onSend,
  loading,
  disabled,
  onHighlightSource,
  lastSources,
}) {
  return (
    <div className="space-y-3">
      <ChatBox
        messages={messages}
        onSend={onSend}
        loading={loading}
        disabled={disabled}
        onHighlightChunk={(idx) => onHighlightSource?.({ chunk_index: idx })}
      />
      {lastSources?.length > 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Source citations
          </div>
          <div className="mt-2 space-y-2">
            {lastSources.map((src, i) => (
              <SourceCitation key={src.chunk_id || i} source={src} onHighlight={onHighlightSource} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
