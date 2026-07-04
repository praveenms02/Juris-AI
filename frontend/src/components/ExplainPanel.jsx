import Spinner from "./Spinner.jsx";

export default function ExplainPanel({ data, loading, onGenerate }) {
  if (loading) return <Spinner label="Analyzing document…" />;

  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center">
        <p className="text-sm text-slate-400">
          Get a full plain-English breakdown of this document — purpose, parties, obligations, risks, and more.
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-4 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Explain Document
        </button>
      </div>
    );
  }

  const s = data.structured || {};

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/30 p-6">
      <h2 className="text-lg font-semibold text-white">Document Summary</h2>

      <Section label="Type" value={s.document_type} />
      <Section label="Purpose" value={s.purpose} />

      <div>
        <div className="text-xs uppercase text-slate-500">Parties</div>
        <div className="mt-1 text-sm text-slate-200">
          Owner: {s.parties?.owner || "—"}
          <br />
          Tenant: {s.parties?.tenant || "—"}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase text-slate-500">Important Terms</div>
        <ul className="mt-2 list-inside list-disc text-sm text-slate-300">
          {(s.important_terms || []).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-xs uppercase text-slate-500">Financial Obligations</div>
        <div className="mt-1 text-sm text-slate-300">
          Rent: {s.financial_obligations?.rent || "—"} · Deposit: {s.financial_obligations?.deposit || "—"}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase text-slate-500">Potential Risks</div>
        <ul className="mt-2 list-inside list-disc text-sm text-rose-200/90">
          {(s.potential_risks || []).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <Section label="Overall Summary" value={s.overall_summary || data.answer} />

      <button type="button" onClick={onGenerate} className="text-xs text-emerald-400 hover:underline">
        Regenerate explanation
      </button>
    </div>
  );
}

function Section({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <p className="mt-1 text-sm leading-relaxed text-slate-300">{value}</p>
    </div>
  );
}
