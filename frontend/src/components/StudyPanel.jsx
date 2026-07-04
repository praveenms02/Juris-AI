import { useState } from "react";
import Spinner from "./Spinner.jsx";

export default function StudyPanel({ data, loading, onGenerate }) {
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (loading) return <Spinner label="Generating study material…" />;

  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
        <p className="text-sm text-slate-400">Flashcards, key points, revision notes, and memory tips from your document.</p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-4 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950"
        >
          Generate Study Material
        </button>
      </div>
    );
  }

  const cards = data.flashcards || [];
  const card = cards[cardIndex];

  return (
    <div className="space-y-4">
      {cards.length > 0 ? (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6">
          <div className="text-xs uppercase text-violet-300">Flashcard {cardIndex + 1} / {cards.length}</div>
          <button
            type="button"
            onClick={() => setFlipped(!flipped)}
            className="mt-4 min-h-[120px] w-full rounded-xl bg-slate-950 p-4 text-left ring-1 ring-slate-800"
          >
            <div className="text-xs text-slate-500">{flipped ? "Answer" : "Question"}</div>
            <div className="mt-2 text-sm text-white">{flipped ? card.a : card.q}</div>
          </button>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={cardIndex <= 0}
              onClick={() => { setCardIndex((i) => i - 1); setFlipped(false); }}
              className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={cardIndex >= cards.length - 1}
              onClick={() => { setCardIndex((i) => i + 1); setFlipped(false); }}
              className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
        <h3 className="text-sm font-semibold text-white">Key Points</h3>
        <ul className="mt-2 list-inside list-disc text-sm text-slate-300">
          {(data.key_points || []).map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
        <h3 className="text-sm font-semibold text-white">Revision Notes</h3>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-300">{data.revision_notes || data.answer}</pre>
      </div>

      {(data.memory_tips || []).length > 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-5">
          <h3 className="text-sm font-semibold text-white">Memory Tips</h3>
          <ul className="mt-2 list-inside list-disc text-sm text-slate-400">
            {data.memory_tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
