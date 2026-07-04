import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle, XCircle, MinusCircle, AlertTriangle } from "lucide-react";
import api from "../api/client.js";
import Spinner from "../components/Spinner.jsx";

function Badge({ type }) {
  if (type === "mcq") return <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300 ring-1 ring-sky-500/20">MCQ</span>;
  if (type === "true_false") return <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/20">True / False</span>;
  if (type === "fill_blank") return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/20">Fill Blank</span>;
  if (type === "scenario") return <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300 ring-1 ring-rose-500/20">Scenario</span>;
  return <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{type}</span>;
}

function ScoreRing({ score }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";
  const stroke = score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171";
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
        <circle
          cx="52" cy="52" r={r} fill="none"
          stroke={stroke} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 52 52)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <span className={`-mt-16 text-3xl font-bold ${color}`}>{score}%</span>
    </div>
  );
}

export default function QuizCenter() {
  const { documentId } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false); // tried to submit without answering

  const generate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setAnswers({});
    setAttempted(false);
    try {
      const { data } = await api.post(`/quiz/generate/${documentId}`, { numQuestions: 8 });
      setQuiz(data.quiz);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate quiz");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!quiz) return;

    // Validate — require all questions answered
    const unanswered = quiz.questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      setAttempted(true);
      return;
    }

    setSubmitting(true);
    setError("");
    setAttempted(false);
    try {
      const payload = {
        quizId: quiz._id,
        answers: quiz.questions.map((q) => ({
          question_id: q.id,
          answer: answers[q.id] || "",
        })),
      };
      const { data } = await api.post("/quiz/submit", payload);
      setResult(data.evaluation);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const totalQ = quiz?.questions?.length ?? 0;
  const answeredCount = quiz
    ? quiz.questions.filter((q) => answers[q.id]?.trim()).length
    : 0;
  const allAnswered = answeredCount === totalQ && totalQ > 0;

  return (
    <div className="space-y-6">
      <Link to="/learning/hub" className="text-sm text-emerald-300 hover:underline">
        ← Learning Hub
      </Link>
      <div className="font-display text-3xl text-white">Quiz Center</div>

      {!quiz && !loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-8 text-center">
          <p className="text-slate-400 text-sm mb-4">
            Generate a quiz based on your document's content. Answer all questions and submit to see your score.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition"
          >
            Generate Quiz from Document
          </button>
        </div>
      )}

      {error && <p className="text-rose-300 text-sm">{error}</p>}
      {loading && <Spinner label="Generating quiz…" />}

      {/* ── Quiz Questions ─────────────────────────────────────────────── */}
      {quiz && !result && (
        <div className="space-y-5">
          {/* Progress bar */}
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>{answeredCount} / {totalQ} answered</span>
            {attempted && !allAnswered && (
              <span className="flex items-center gap-1 text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                Please answer all questions before submitting
              </span>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${totalQ > 0 ? (answeredCount / totalQ) * 100 : 0}%` }}
            />
          </div>

          {quiz.questions.map((q, i) => {
            const isUnanswered = attempted && !answers[q.id]?.trim();
            return (
              <div
                key={q.id}
                className={`rounded-2xl border p-5 transition ${
                  isUnanswered
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-slate-800 bg-slate-900/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-500 font-medium">Q{i + 1}</span>
                  <Badge type={q.type} />
                  {isUnanswered && (
                    <span className="text-[10px] text-amber-400 ml-auto">Required</span>
                  )}
                </div>
                <p className="text-sm text-white leading-relaxed">{q.question}</p>

                {q.options?.length ? (
                  <div className="mt-3 space-y-2">
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
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          className="accent-emerald-500 shrink-0"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Type your answer here…"
                    className={`mt-3 w-full rounded-xl border px-3 py-2.5 text-sm text-white outline-none transition ${
                      isUnanswered
                        ? "border-amber-500/40 bg-slate-950 placeholder-amber-700"
                        : "border-slate-700 bg-slate-950 placeholder-slate-600 focus:border-emerald-500/50"
                    }`}
                  />
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition"
            >
              {submitting ? "Submitting…" : "Submit Quiz"}
            </button>
            {!allAnswered && (
              <span className="text-xs text-slate-500">
                {totalQ - answeredCount} question{totalQ - answeredCount !== 1 ? "s" : ""} remaining
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-6">
          {/* Score card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col sm:flex-row items-center gap-6">
            <ScoreRing score={result.score} />
            <div className="flex-1 text-center sm:text-left">
              <div className="text-2xl font-semibold text-white">
                {result.score >= 80 ? "Excellent!" : result.score >= 50 ? "Good effort!" : "Keep practicing!"}
              </div>
              <p className="mt-1 text-slate-400 text-sm">
                {result.correct_count} correct out of {result.total} questions
              </p>
              <div className="mt-4 flex flex-wrap gap-3 justify-center sm:justify-start text-xs">
                <span className="flex items-center gap-1 text-emerald-300">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {result.correct_count} correct
                </span>
                <span className="flex items-center gap-1 text-rose-300">
                  <XCircle className="h-3.5 w-3.5" />
                  {result.total - result.correct_count} incorrect
                </span>
              </div>
            </div>
          </div>

          {/* Per-question breakdown */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Answer Breakdown</div>
            {result.results.map((r, i) => (
              <div
                key={r.question_id}
                className={`rounded-xl border p-4 ${
                  r.is_correct
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-rose-500/20 bg-rose-500/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  {r.is_correct
                    ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    : r.user_answer
                    ? <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    : <MinusCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-500 mb-1">Q{i + 1}</div>
                    <p className="text-sm text-white">{r.question}</p>

                    <div className="mt-2 grid sm:grid-cols-2 gap-2">
                      <div className={`rounded-lg px-3 py-1.5 text-xs ${
                        r.is_correct ? "bg-emerald-500/10 text-emerald-200" : "bg-slate-900 text-slate-400"
                      }`}>
                        <span className="font-medium">Your answer:</span>{" "}
                        {r.user_answer || <span className="italic text-slate-600">Not answered</span>}
                      </div>
                      {!r.is_correct && (
                        <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
                          <span className="font-medium">Correct answer:</span> {r.correct_answer}
                        </div>
                      )}
                    </div>

                    <p className="mt-2 text-xs text-slate-400">{r.feedback}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setQuiz(null); setResult(null); setAnswers({}); }}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800 transition"
          >
            Try Another Quiz
          </button>
        </div>
      )}
    </div>
  );
}
