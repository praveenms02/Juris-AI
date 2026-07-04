"""
Document intelligence modes — distinct behavior per feature (Legal, Explain, Study, Quiz, Topics).
"""

from __future__ import annotations

import re
from typing import Any

from services.llm_handler import FALLBACK_PHRASE, generate_answer_from_context
from services.prompt_template import (
    build_explain_prompt,
    build_legal_prompt,
    build_study_prompt,
    build_topics_prompt,
)
from services.quiz_engine import generate_quiz
from services.retriever import RetrievedChunk, format_context, retrieve_chunks


def _confidence_pct(distance: float) -> int:
    """Convert cosine distance to a 0–98% confidence display score."""
    return max(0, min(98, round((1.0 - min(distance, 1.0)) * 100)))


def _estimate_page(chunk_index: int, chunk_size_words: int = 600) -> int:
    words_before = chunk_index * chunk_size_words
    return max(1, words_before // 350 + 1)


def _clause_label(text: str, clauses: list[dict] | None) -> str:
    clauses = clauses or []
    snippet = (text or "")[:120]
    for c in clauses:
        ct = c.get("text") or ""
        if ct and (snippet in ct or ct[:80] in text):
            return c.get("title") or "Clause"
    m = re.search(r"(?:section|clause|article)\s+([\d\.]+)", text or "", re.I)
    if m:
        return f"Section {m.group(1)}"
    return "Document excerpt"


def enrich_sources(chunks: list[RetrievedChunk], clauses: list[dict] | None = None) -> list[dict]:
    """Build citation objects with page, clause, excerpt, and confidence."""
    sources: list[dict] = []
    for c in chunks:
        excerpt = c.text.strip()
        sources.append(
            {
                "chunk_index": c.chunk_index,
                "chunk_id": c.chunk_id,
                "text": excerpt[:500] + ("…" if len(excerpt) > 500 else ""),
                "excerpt": excerpt[:280] + ("…" if len(excerpt) > 280 else ""),
                "score": c.score,
                "confidence": _confidence_pct(c.score),
                "page": _estimate_page(c.chunk_index),
                "clause": _clause_label(excerpt, clauses),
            }
        )
    return sources


def _infer_doc_type(text: str, clauses: list[dict]) -> str:
    lower = (text or "").lower()
    if any(k in lower for k in ("rent", "tenant", "landlord", "lease")):
        return "Rental Agreement"
    if any(k in lower for k in ("employment", "employee", "employer", "salary")):
        return "Employment Contract"
    if any(k in lower for k in ("nda", "confidential", "non-disclosure")):
        return "Confidentiality Agreement"
    return "Legal Agreement"


def _format_history(messages: list[dict] | None, limit: int = 8) -> str:
    if not messages:
        return ""
    lines = []
    for msg in messages[-limit:]:
        role = msg.get("role", "user")
        content = (msg.get("content") or "").strip()
        if content:
            lines.append(f"{'User' if role == 'user' else 'Assistant'}: {content}")
    return "\n".join(lines)


def run_legal_qa(
    *,
    user_id: str,
    document_id: str,
    query: str,
    chat_history: list[dict] | None = None,
    clauses: list[dict] | None = None,
    top_k: int = 5,
) -> dict[str, Any]:
    """
    Mode 1 — Legal Q&A: top-5 RAG retrieval, conversational memory, rich citations.
    """
    query = (query or "").strip()
    if not query:
        raise ValueError("Query cannot be empty.")

    chunks = retrieve_chunks(
        user_id=user_id,
        document_id=document_id,
        query=query,
        top_k=top_k,
    )
    context = format_context(chunks)
    history = _format_history(chat_history)

    print("=== RETRIEVED CHUNKS ===")
    print(context)

    if not chunks:
        return {
            "mode": "legal",
            "answer": FALLBACK_PHRASE,
            "sources": [],
            "related_excerpt": "",
        }

    prompt = build_legal_prompt(context=context, question=query, chat_history=history)
    answer = generate_answer_from_context(context, query, prompt=prompt)

    if not answer or answer.lower().startswith("this information"):
        related = chunks[0].text[:400] if chunks else ""
        answer = FALLBACK_PHRASE
        return {
            "mode": "legal",
            "answer": answer,
            "sources": enrich_sources(chunks, clauses),
            "related_excerpt": related,
        }

    return {
        "mode": "legal",
        "answer": answer,
        "sources": enrich_sources(chunks, clauses),
        "related_excerpt": "",
    }


def run_explain_document(
    *,
    extracted_text: str,
    summary: str = "",
    short_summary: str = "",
    entities: dict | None = None,
    clauses: list[dict] | None = None,
    risks: list[dict] | None = None,
    user_id: str = "",
    document_id: str = "",
) -> dict[str, Any]:
    """
    Mode 2 — Explain Document: full structured breakdown, no user question required.
    """
    entities = entities or {}
    clauses = clauses or []
    risks = risks or []
    text = (extracted_text or "").strip()

    chunks = []
    if user_id and document_id:
        chunks = retrieve_chunks(
            user_id=user_id,
            document_id=document_id,
            query="document summary purpose parties obligations rent deposit termination penalty maintenance",
            top_k=5,
        )
    context = format_context(chunks) if chunks else text[:8000]

    prompt = build_explain_prompt(context=context)
    narrative = generate_answer_from_context(context, "Explain this entire document.", prompt=prompt)

    important_terms = []
    for c in clauses:
        title = (c.get("title") or "").replace(" Clause", "")
        if title:
            important_terms.append(title)
    if entities.get("rent"):
        important_terms.append("Monthly rent")
    if entities.get("deposit"):
        important_terms.append("Security deposit")

    risk_lines = []
    for r in risks[:5]:
        if isinstance(r, dict):
            risk_lines.append(r.get("description") or r.get("title") or str(r))
        else:
            risk_lines.append(str(r))

    structured = {
        "document_type": _infer_doc_type(text, clauses),
        "purpose": short_summary or summary or "Defines the legal terms and obligations between the parties.",
        "parties": {
            "owner": entities.get("owner") or "Not specified",
            "tenant": entities.get("tenant") or "Not specified",
        },
        "duration": entities.get("duration") or "See agreement term clause",
        "financial_obligations": {
            "rent": entities.get("rent") or "Not specified",
            "deposit": entities.get("deposit") or "Not specified",
        },
        "important_terms": list(dict.fromkeys(important_terms))[:12],
        "responsibilities": [c.get("title") for c in clauses if "maintenance" in (c.get("title") or "").lower()],
        "penalties": [c.get("title") for c in clauses if "penalty" in (c.get("title") or "").lower()],
        "termination": [c.get("title") for c in clauses if "termin" in (c.get("title") or "").lower()],
        "potential_risks": risk_lines or ["Review penalty, termination, and indemnity clauses carefully."],
        "overall_summary": narrative or short_summary or summary or "See clauses below for details.",
        "clauses": [{"title": c.get("title"), "text": (c.get("text") or "")[:400]} for c in clauses[:8]],
    }

    formatted = _format_explain_output(structured)
    return {
        "mode": "explain",
        "structured": structured,
        "answer": formatted,
        "sources": enrich_sources(chunks, clauses) if chunks else [],
    }


def _format_explain_output(s: dict) -> str:
    lines = [
        "Document Summary",
        "",
        f"Type:\n{s['document_type']}",
        "",
        f"Purpose:\n{s['purpose']}",
        "",
        "Parties:",
        f"Owner/Landlord: {s['parties']['owner']}",
        f"Tenant: {s['parties']['tenant']}",
        "",
        "Important Terms:",
    ]
    for t in s.get("important_terms") or []:
        lines.append(f"• {t}")
    lines.extend(["", "Potential Risks:"])
    for r in s.get("potential_risks") or []:
        lines.append(f"• {r}")
    lines.extend(["", "Overall Summary:", s.get("overall_summary") or ""])
    return "\n".join(lines)


def run_study_mode(
    *,
    extracted_text: str,
    summary: str = "",
    entities: dict | None = None,
    clauses: list[dict] | None = None,
    user_id: str = "",
    document_id: str = "",
) -> dict[str, Any]:
    """Mode 3 — Study: flashcards, key points, revision notes."""
    entities = entities or {}
    clauses = clauses or []

    chunks = []
    if user_id and document_id:
        chunks = retrieve_chunks(
            user_id=user_id,
            document_id=document_id,
            query="key facts dates amounts people rent deposit duration obligations",
            top_k=5,
        )
    context = format_context(chunks) if chunks else (extracted_text or "")[:8000]

    prompt = build_study_prompt(context=context)
    notes_text = generate_answer_from_context(context, "Generate study material.", prompt=prompt)

    flashcards: list[dict] = []
    if entities.get("rent"):
        flashcards.append({"q": "What is the monthly rent?", "a": entities["rent"]})
    if entities.get("deposit"):
        flashcards.append({"q": "What is the security deposit?", "a": entities["deposit"]})
    if entities.get("owner"):
        flashcards.append({"q": "Who is the owner/landlord?", "a": entities["owner"]})
    if entities.get("tenant"):
        flashcards.append({"q": "Who is the tenant?", "a": entities["tenant"]})
    if entities.get("duration"):
        flashcards.append({"q": "What is the agreement duration?", "a": entities["duration"]})
    for c in clauses[:5]:
        flashcards.append({
            "q": f"What does the {c.get('title', 'clause')} say?",
            "a": (c.get("text") or "")[:200],
        })

    key_points = []
    if summary:
        key_points.append(summary[:300])
    for c in clauses[:4]:
        key_points.append(f"{c.get('title')}: {(c.get('text') or '')[:120]}…")

    return {
        "mode": "study",
        "executive_summary": summary or notes_text[:500],
        "key_points": key_points,
        "important_dates": _extract_dates(extracted_text),
        "important_people": [v for k, v in entities.items() if k in ("owner", "tenant") and v],
        "important_amounts": [v for k, v in entities.items() if k in ("rent", "deposit") and v],
        "flashcards": flashcards,
        "revision_notes": notes_text,
        "memory_tips": [
            "Link each party to their obligations (who pays rent, who maintains).",
            "Memorize dates: start, end, notice period, payment due date.",
            "Connect amounts (rent, deposit, penalties) to the clauses that mention them.",
        ],
        "answer": notes_text,
        "sources": enrich_sources(chunks, clauses) if chunks else [],
    }


def _extract_dates(text: str) -> list[str]:
    patterns = [
        r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
        r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b",
        r"\b\d+\s+(?:months?|years?)\b",
    ]
    found: list[str] = []
    for pat in patterns:
        for m in re.finditer(pat, text or "", re.I):
            val = m.group(0)
            if val not in found:
                found.append(val)
    return found[:10]


def run_quiz_mode(
    *,
    extracted_text: str,
    entities: dict | None = None,
    clauses: list[dict] | None = None,
) -> dict[str, Any]:
    """Mode 4 — Quiz: 10–15 structured questions, not chat."""
    result = generate_quiz(
        extracted_text=extracted_text,
        clauses=clauses,
        entities=entities,
        num_questions=15,
    )
    return {
        "mode": "quiz",
        "questions": result["questions"],
        "question_count": result["question_count"],
    }


def run_topics_mode(
    *,
    extracted_text: str,
    entities: dict | None = None,
    clauses: list[dict] | None = None,
    user_id: str = "",
    document_id: str = "",
) -> dict[str, Any]:
    """Mode 5 — Topics: navigable outline with chunk references for highlighting."""
    entities = entities or {}
    clauses = clauses or []

    chunks = []
    if user_id and document_id:
        chunks = retrieve_chunks(
            user_id=user_id,
            document_id=document_id,
            query="all sections topics clauses parties payment deposit maintenance termination dispute",
            top_k=5,
        )
    context = format_context(chunks) if chunks else (extracted_text or "")[:6000]
    prompt = build_topics_prompt(context=context)
    _ = generate_answer_from_context(context, "Extract topics.", prompt=prompt)

    topics: list[dict] = []

    def add_topic(title: str, summary: str, keywords: list[str], chunk_index: int = 0, clause: str = ""):
        topics.append({
            "title": title,
            "summary": summary,
            "keywords": keywords,
            "chunk_index": chunk_index,
            "page": _estimate_page(chunk_index),
            "clause": clause,
            "highlight_text": summary[:200],
        })

    if entities.get("owner"):
        add_topic("Owner Information", f"Landlord/owner: {entities['owner']}", ["owner", "landlord", "lessor"])
    if entities.get("tenant"):
        add_topic("Tenant Information", f"Tenant/lessee: {entities['tenant']}", ["tenant", "lessee"])
    if entities.get("address"):
        add_topic("Property Details", entities["address"], ["property", "premises", "address"])
    if entities.get("rent"):
        add_topic("Payment Terms", f"Monthly rent: {entities['rent']}", ["rent", "payment", "monthly"])
    if entities.get("deposit"):
        add_topic("Security Deposit", f"Deposit: {entities['deposit']}", ["deposit", "security"])
    if entities.get("duration"):
        add_topic("Duration & Term", entities["duration"], ["duration", "term", "period"])

    for i, c in enumerate(clauses):
        title = (c.get("title") or "Clause").replace(" Clause", "")
        chunk_idx = chunks[i % len(chunks)].chunk_index if chunks else i
        add_topic(
            title,
            (c.get("text") or "")[:180],
            title.lower().split(),
            chunk_index=chunk_idx,
            clause=c.get("title") or "",
        )

    if not topics:
        add_topic("General Provisions", "Review the full document for key obligations.", ["agreement", "parties"])

    return {
        "mode": "topics",
        "topics": topics,
        "sources": enrich_sources(chunks, clauses) if chunks else [],
    }
