import { useEffect, useRef } from "react";

/**
 * Scrollable document text with highlight support for citations and topics.
 */
export default function DocumentTextViewer({ text, highlightText, highlightChunkIndex, chunkSize = 600 }) {
  const ref = useRef(null);
  const markerRef = useRef(null);

  const displayText = text || "No document text available.";

  useEffect(() => {
    if (!ref.current) return;

    if (highlightText && displayText.includes(highlightText.slice(0, 40))) {
      markerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (highlightChunkIndex != null && highlightChunkIndex >= 0) {
      const approxOffset = highlightChunkIndex * chunkSize * 5;
      const el = ref.current;
      if (el) {
        el.scrollTop = Math.min(approxOffset, el.scrollHeight);
      }
    }
  }, [highlightText, highlightChunkIndex, displayText, chunkSize]);

  if (highlightText && displayText.includes(highlightText.slice(0, 30))) {
    const idx = displayText.indexOf(highlightText.slice(0, 80));
    const before = displayText.slice(0, idx);
    const match = displayText.slice(idx, idx + highlightText.length);
    const after = displayText.slice(idx + highlightText.length);

    return (
      <div
        ref={ref}
        className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/30 p-5 text-sm leading-relaxed text-slate-300"
      >
        {before}
        <mark ref={markerRef} className="rounded bg-emerald-500/30 px-0.5 text-emerald-100 ring-1 ring-emerald-500/40">
          {match || highlightText.slice(0, 200)}
        </mark>
        {after}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/30 p-5 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap"
    >
      {displayText.slice(0, 50000)}
      {displayText.length > 50000 ? "\n\n…[document truncated for display]" : ""}
    </div>
  );
}
