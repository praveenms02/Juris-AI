"""
Phase 5 — Learning engine: study notes, clause explanations, topic suggestions.

Uses existing Phase 2 analysis outputs (clauses, entities, summary) plus extracted text.
Local-only; no paid APIs required.
"""

from __future__ import annotations

import re
from typing import Any

from services.simplifier import simplify_text


def _bullet_lines(items: list[str], prefix: str = "- ") -> str:
    return "\n".join(f"{prefix}{item}" for item in items if item)


def _extract_definitions(text: str, limit: int = 8) -> list[str]:
    """Pull likely defined terms from legal text."""
    patterns = [
        r'"([^"]{3,40})"\s*(?:means|shall mean|refers to)',
        r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*\(\s*["\']?[^"\']+["\']?\s*\)',
        r'\b(?:hereinafter|referred to as)\s+["\']?([^"\']{3,40})["\']?',
    ]
    found: list[str] = []
    for pat in patterns:
        for m in re.finditer(pat, text or "", re.IGNORECASE):
            term = m.group(1).strip()
            if term and term not in found:
                found.append(term)
            if len(found) >= limit:
                break
        if len(found) >= limit:
            break
    return found[:limit]


def _real_world_example(clause_title: str) -> str:
    examples = {
        "Rent Clause": (
            "If rent is ₹15,000/month and due on the 5th, paying on the 6th may trigger a late fee "
            "as stated in the agreement."
        ),
        "Termination Clause": (
            "If you want to leave early, you usually must give written notice (e.g. 60 days) or pay "
            "penalties described in the clause."
        ),
        "Security Deposit Clause": (
            "When moving out, the landlord may deduct repair costs from the deposit before refunding "
            "the balance."
        ),
        "Maintenance Clause": (
            "A leaking tap might be the tenant's job; structural roof damage is often the landlord's."
        ),
        "Penalty Clause": (
            "Missing a payment deadline could mean daily fines until the amount is cleared."
        ),
    }
    for key, example in examples.items():
        if key.lower() in clause_title.lower():
            return example
    return "Apply this clause to everyday situations by checking who must act, by when, and what happens if they do not."


def explain_clause_simple(clause_text: str, clause_title: str = "Clause") -> dict[str, str]:
    """
    Produce legal, beginner, real-world, and importance views for one clause.
    """
    text = (clause_text or "").strip()
    if not text:
        return {
            "title": clause_title,
            "legal_version": "",
            "beginner_version": "",
            "real_world_example": "",
            "why_it_matters": "No clause text was provided.",
        }

    beginner = simplify_text(text, mode="beginner")
    importance = (
        "This clause sets clear rules both sides must follow. Ignoring it can lead to disputes, "
        "financial loss, or difficulty ending the agreement."
    )
    if "rent" in clause_title.lower() or "deposit" in clause_title.lower():
        importance = "Directly affects how much you pay, when you pay, and what happens to your money."
    elif "terminat" in clause_title.lower():
        importance = "Controls how and when you can exit the agreement without legal trouble."

    return {
        "title": clause_title,
        "legal_version": text,
        "beginner_version": beginner,
        "real_world_example": _real_world_example(clause_title),
        "why_it_matters": importance,
    }


def generate_study_notes(
    *,
    extracted_text: str,
    summary: str = "",
    short_summary: str = "",
    clauses: list[dict] | None = None,
    entities: dict | None = None,
    note_type: str = "revision",
) -> dict[str, Any]:
    """
    Build structured study notes from analyzed document content.

    note_type: revision | exam | quick_reference | key_takeaways
    """
    clauses = clauses or []
    entities = entities or {}
    text = (extracted_text or "").strip()

    important_clauses = [
        {"title": c.get("title", "Clause"), "text": c.get("text", ""), "importance": c.get("importance", "Medium")}
        for c in clauses
        if c.get("text")
    ]
    definitions = _extract_definitions(text)
    entity_lines = [
        f"{k.replace('_', ' ').title()}: {v}" for k, v in entities.items() if v
    ]

    key_takeaways = []
    if short_summary:
        key_takeaways.append(short_summary)
    elif summary:
        key_takeaways.append(summary[:400] + ("…" if len(summary) > 400 else ""))
    for c in important_clauses[:3]:
        key_takeaways.append(f"{c['title']}: {c['text'][:120]}…" if len(c["text"]) > 120 else f"{c['title']}: {c['text']}")

    sections: dict[str, Any] = {
        "key_takeaways": key_takeaways,
        "important_clauses": important_clauses,
        "important_definitions": definitions,
        "key_details": entity_lines,
    }

    if note_type == "exam":
        title = "Exam Preparation Notes"
        body_parts = [
            "# Exam Preparation Notes\n",
            "## Must-Know Points\n",
            _bullet_lines(key_takeaways),
            "\n## Clause Checklist\n",
        ]
        for c in important_clauses:
            body_parts.append(f"\n### {c['title']} ({c['importance']})\n{c['text']}\n")
            exp = explain_clause_simple(c["text"], c["title"])
            body_parts.append(f"**In simple words:** {exp['beginner_version'][:300]}\n")
    elif note_type == "quick_reference":
        title = "Quick Reference Notes"
        body_parts = [
            "# Quick Reference\n",
            "## Key Details\n",
            _bullet_lines(entity_lines) or "- See full document",
            "\n## Clauses at a Glance\n",
        ]
        for c in important_clauses:
            body_parts.append(f"- **{c['title']}**: {c['text'][:100]}…\n" if len(c["text"]) > 100 else f"- **{c['title']}**: {c['text']}\n")
    elif note_type == "key_takeaways":
        title = "Key Takeaways"
        body_parts = ["# Key Takeaways\n", _bullet_lines(key_takeaways)]
    else:
        title = "Revision Notes"
        body_parts = [
            "# Revision Notes\n",
            "## Summary\n",
            summary or short_summary or "No summary available.",
            "\n## Key Takeaways\n",
            _bullet_lines(key_takeaways),
            "\n## Important Clauses\n",
        ]
        for c in important_clauses:
            body_parts.append(f"\n### {c['title']}\n{c['text']}\n")
        if definitions:
            body_parts.append("\n## Definitions\n")
            body_parts.append(_bullet_lines(definitions))

    content = "\n".join(body_parts).strip()
    return {
        "title": title,
        "note_type": note_type,
        "content": content,
        "sections": sections,
    }


def generate_revision_notes(**kwargs: Any) -> dict[str, Any]:
    """Alias for revision-style study notes."""
    return generate_study_notes(**kwargs, note_type="revision")


def suggest_learning_topics(
    *,
    clauses: list[dict] | None = None,
    entities: dict | None = None,
    extracted_text: str = "",
) -> list[dict[str, str]]:
    """
    Recommend related legal concepts based on document content.
    """
    clauses = clauses or []
    text_lower = (extracted_text or "").lower()
    topics: list[dict[str, str]] = []
    seen: set[str] = set()

    mapping = [
        (["rent", "lease", "tenant", "landlord"], "Rental Agreements & Tenancy Law", "Understand rent, deposits, and eviction rules."),
        (["employ", "salary", "employee", "employer"], "Employment Contracts", "Learn about notice periods, benefits, and termination."),
        (["confidential", "nda", "non-disclosure"], "Confidentiality & IP", "Study how trade secrets and NDAs work."),
        (["indemn", "liability", "damages"], "Liability & Indemnification", "Learn who pays when something goes wrong."),
        (["arbitration", "dispute", "mediation"], "Dispute Resolution", "Compare courts, mediation, and arbitration."),
        (["terminate", "termination", "notice"], "Contract Termination", "Review notice periods and exit penalties."),
        (["deposit", "security"], "Security Deposits", "Know refund rules and lawful deductions."),
        (["penalty", "late fee", "fine"], "Penalties & Breach", "Study when fines are enforceable."),
    ]

    for keywords, title, desc in mapping:
        if any(kw in text_lower for kw in keywords) or any(
            any(kw in (c.get("title", "") + c.get("text", "")).lower() for kw in keywords) for c in clauses
        ):
            if title not in seen:
                seen.add(title)
                topics.append({"topic": title, "reason": desc})

    if entities.get("rent") or entities.get("deposit"):
        t = "Indian Rental Laws (State-specific)"
        if t not in seen:
            topics.append({"topic": t, "reason": "Your document mentions rent/deposit — review local rent control acts."})

    if not topics:
        topics.append({"topic": "Contract Law Basics", "reason": "Foundation for reading any legal agreement."})
        topics.append({"topic": "Legal Document Reading Skills", "reason": "Practice identifying parties, duties, and deadlines."})

    return topics[:8]
