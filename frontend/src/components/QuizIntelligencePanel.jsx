import { useState } from "react";
import { CheckCircle, XCircle, MinusCircle, AlertTriangle } from "lucide-react";
import Spinner from "./Spinner.jsx";

// ── helpers ────────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreAnswer(question, userAnswer) {
  const given = normalize(userAnswer);
  const correct = normalize(question.correct_answer || "");
  const type = question.type || "";

  // Never mark blank as correct
  if (!given) return false;

  if (type === "mcq" || type === "true_false") {
    return given === correct;
  }

  // short_answer / fill_blank / scenario — fuzzy match
  const STOP = new Set(["the", "a", "an", "is", "in", "of", "to", "and", "or", "this", "for"]);
  const givenWords = new Set(given.split(" ").filter((w) => !STOP.has(w)));
  const correctWords = new Set(correct.split(" ").filter((w) => !STOP.has(w)));
  const overlap = [...givenWords].filter((w) => correctWords.has(w));
  const needed = Math.max(1, Math.floor(correctWords.size / 2));

  return (
    correct.includes(given) ||
    given.includes(correct) ||
    (given.length >= 3 && overlap.length >= needed)
  );
}

function Badge({ type }) {
  const map = {
    mcq: ["MCQ", "bg-sky-500/10 text-sky-300 ring-sky-500/20"],
    true_false: ["True / False", "bg-violet-500/10 text-violet-300 ring-violet-500/20"],
    fill_blank: ["Fill Blank", "bg-amber-500/10 text-amber-300 ring-amber-500/20"],
    scenario: ["Scenario", "bg-rose-500/10 text-rose-300 ring-rose-500/20"],
    short_answer: ["Short Answer", "bg-teal-500/10 text-teal-300 ring-teal-500/20"],
  };
  const [label, cls] = map[type] || ["Question", "bg-slate-800 text-slate-400"];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${cls}`}>
      {label}
    </span>
  );
}

function ScoreRing({ pct }) {
  const color = pct >= 80 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="56" cy="56" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 56 56)"
        />
      </svg>
      <span className="absolute text-3xl font-bold" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function QuizIntelligencePanel({ data, loading, onGenerate }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [attempted, setAttempted] = useState(false);

  const reset = async () => {
    setIndex(0);
    setAnswers({});
    setSubmitted(false);
    setResults(null);
    setAttempted(false);
    await onGenerate();
  };

  // ── Loading / empty states ────────────────────────────────────────────────

  if (loading) return <Spinner label="Generating quiz…" />;

  if (!data?.questions?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
        <p className="text-sm text-slate-400 mb-4">
          Generate a quiz from this document — MCQ, True/False, Fill-in-blank & Scenario questions.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  const questions = data.questions;
  const total = questions.length;
  const answeredCount = questions.filter((q) => answers[q.id]?.trim()).length;
  const q = questions[index];

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    const unanswered = questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      setAttempted(true);
      return;
    }
    const res = questions.map((question) => {
      const isCorrect = scoreAnswer(question, answers[question.id]);
      return {
        id: question.id,
        question: question.question,
        type: question.type,
        userAnswer: answers[question.id] || "",
        correctAnswer: question.correct_answer,
        isCorrect,
        explanation: question.explanation || "",
      };
    });
    const correctCount = res.filter((r) => r.isCorrect).length;
    setResults({ items: res, correctCount, total, pct: Math.round((correctCount / total) * 100) });
    setSubmitted(true);
  };

  // ── Results view ──────────────────────────────────────────────────────────

  if (submitted && results) {
    const { pct, correctCount, items } = results;
    return (
      <div className="space-y-6">
        {/* Score header */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing pct={pct} />
          <div className="flex-1 text-center sm:text-left">
            <div className="text-xl font-semibold text-white">
              {pct >= 80 ? "🎉 Excellent!" : pct >= 50 ? "👍 Good effort!" : "📚 Keep practicing!"}
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {correctCount} correct out of {total} questions
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs justify-center sm:justify-start">
              <span className="flex items-center gap-1 text-emerald-300">
                <CheckCircle className="h-3.5 w-3.5" /> {correctCount} correct
              </span>
              <span className="flex items-center gap-1 text-rose-300">
                <XCircle className="h-3.5 w-3.5" /> {total - correctCount} incorrect
              </span>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Detailed Results
          </div>
          {items.map((r, i) => (
            <div
              key={r.id}
              className={`rounded-xl border p-4 ${
                r.isCorrect
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-rose-500/20 bg-rose-500/5"
              }`}
            >
              <div className="flex items-start gap-3">
                {r.isCorrect
                  ? <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                  : r.userAnswer
                  ? <XCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                  : <MinusCircle className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-500">Q{i + 1}</span>
                    <Badge type={r.type} />
                  </div>
                  <p className="text-sm text-white leading-relaxed">{r.question}</p>

                  <div className="mt-2 space-y-1">
                    <div className={`rounded-lg px-3 py-1.5 text-xs ${
                      r.isCorrect ? "bg-emerald-500/10 text-emerald-200" : "bg-slate-900 text-slate-400"
                    }`}>
                      <span className="font-medium">Your answer: </span>
                      {r.userAnswer || <span className="italic text-slate-600">Not answered</span>}
                    </div>
                    {!r.isCorrect && (
                      <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
                        <span className="font-medium">Correct answer: </span>{r.correctAnswer}
                      </div>
                    )}
                    {r.explanation && (
                      <div className="px-1 pt-0.5 text-[11px] text-slate-500 italic">{r.explanation}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-slate-900 px-5 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800 transition"
        >
          Try New Quiz
        </button>
      </div>
    );
  }

  // ── Question view ─────────────────────────────────────────────────────────

  const isUnanswered = attempted && !answers[q.id]?.trim();

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Question {index + 1} of {total}</span>
          <span>{answeredCount}/{total} answered</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800">
          <div
            className="h-1.5 rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
        {/* Answer dots */}
        <div className="flex gap-1 flex-wrap">
          {questions.map((qu, i) => (
            <button
              key={qu.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full transition ${
                i === index
                  ? "bg-emerald-400 scale-125"
                  : answers[qu.id]?.trim()
                  ? "bg-emerald-600"
                  : "bg-slate-700 hover:bg-slate-600"
              }`}
              title={`Q${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Question card */}
      <div className={`rounded-2xl border p-5 transition ${
        isUnanswered ? "border-amber-500/40 bg-amber-500/5" : "border-slate-800 bg-slate-900/30"
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <Badge type={q.type} />
          {isUnanswered && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 ml-auto">
              <AlertTriangle className="h-3 w-3" /> Required
            </span>
          )}
        </div>
        <p className="text-sm text-white leading-relaxed">{q.question}</p>

        {q.options?.length ? (
          <div className="mt-4 space-y-2">
            {q.options.map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                  answers[q.id] === opt
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
                    : "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={opt}
                  checked={answers[q.id] === opt}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  className="accent-emerald-500 shrink-0"
                />
                {opt}
              </label>
            ))}
          </div>
        ) : (
          <input
            value={answers[q.id] || ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            placeholder="Type your answer here…"
            className={`mt-4 w-full rounded-xl border px-3 py-2.5 text-sm text-white outline-none transition ${
              isUnanswered
                ? "border-amber-500/40 bg-slate-950 placeholder-amber-800"
                : "border-slate-700 bg-slate-950 placeholder-slate-600 focus:border-emerald-500/50"
            }`}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => setIndex((i) => i - 1)}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm text-slate-300 ring-1 ring-slate-800 disabled:opacity-40 hover:bg-slate-900 transition"
        >
          ← Back
        </button>

        {index < total - 1 ? (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition"
          >
            Submit Quiz
          </button>
        )}
      </div>

      {attempted && answeredCount < total && (
        <p className="text-xs text-amber-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Please answer all {total} questions before submitting ({total - answeredCount} remaining)
        </p>
      )}
    </div>
  );
}
