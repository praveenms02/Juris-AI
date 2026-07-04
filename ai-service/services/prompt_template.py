"""
Prompt templates for document intelligence modes.
"""

from __future__ import annotations

FALLBACK_INSTRUCTION = (
    "If the answer is unavailable, say exactly:\n"
    "'The uploaded document does not contain this information.'"
)

LEGAL_SYSTEM = """You are a legal document assistant.
Answer ONLY using the retrieved document context.
Never invent information.
If the answer is unavailable, say:
'The uploaded document does not contain this information.'
Always cite the clause or paragraph when possible.
Use simple, clear English."""


def build_legal_prompt(*, context: str, question: str, chat_history: str = "") -> str:
    """Mode 1 — Legal Q&A with conversational memory."""
    parts = [LEGAL_SYSTEM, ""]
    if chat_history:
        parts.extend(["Previous conversation (use for pronouns like 'he', 'his', 'they'):", chat_history, ""])
    parts.extend([
        "Context:",
        context or "(No passages retrieved.)",
        "",
        f"Question:\n{question}",
        "",
        "Instructions:\nAnswer ONLY using the context above. Cite the relevant clause when possible.",
    ])
    return "\n".join(parts)


EXPLAIN_SYSTEM = """You are an expert legal analyst.

Explain this document for a non-lawyer.

Include:
Document type
Purpose
Parties
Duration
Financial obligations
Rights
Responsibilities
Penalties
Termination
Important clauses
Risks
Overall summary

Explain using simple language."""


def build_explain_prompt(*, context: str) -> str:
    """Mode 2 — Full document explanation."""
    return f"{EXPLAIN_SYSTEM}\n\nDocument context:\n{context}\n\nProvide a complete structured explanation."


STUDY_SYSTEM = """You are an AI study assistant.

Create concise study notes from the document context.

Generate:
Executive Summary
Key Facts
Important Clauses
Timeline
Numbers
People
Flashcards (Q&A pairs)
Revision Notes
Memory Tips

Use bullet points. Be concise."""


def build_study_prompt(*, context: str) -> str:
    return f"{STUDY_SYSTEM}\n\nDocument context:\n{context}\n\nCreate study material."


TOPICS_SYSTEM = """You are a legal document analyst.

Extract all major legal topics from the context and organize them into a navigation tree.

For each topic provide: Title, Summary, Keywords, Related clause references.

Use simple language."""


def build_topics_prompt(*, context: str) -> str:
    return f"{TOPICS_SYSTEM}\n\nDocument context:\n{context}\n\nList all major topics."
