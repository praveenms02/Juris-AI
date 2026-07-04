"""
RAG pipeline — delegates to mode_engine for distinct mode behavior.
"""

from __future__ import annotations

from services.mode_engine import run_legal_qa


def run_rag_chat(
    *,
    user_id: str,
    document_id: str,
    query: str,
    top_k: int = 5,
    chat_history: list[dict] | None = None,
    document_summary: str = "",
    entities: dict | None = None,
    mode: str = "legal",
    clauses: list[dict] | None = None,
    extracted_text: str = "",
    risks: list[dict] | None = None,
) -> dict:
    """
    Route chat requests to the appropriate intelligence mode handler.

    Legal Q&A uses top-5 RAG; other modes should call /intelligence/{mode} directly.
    """
    if mode != "legal":
        from services.mode_engine import (
            run_explain_document,
            run_quiz_mode,
            run_study_mode,
            run_topics_mode,
        )

        if mode == "explain":
            return run_explain_document(
                extracted_text=extracted_text,
                summary=document_summary,
                short_summary=document_summary,
                entities=entities,
                clauses=clauses,
                risks=risks,
                user_id=user_id,
                document_id=document_id,
            )
        if mode == "study":
            return run_study_mode(
                extracted_text=extracted_text,
                summary=document_summary,
                entities=entities,
                clauses=clauses,
                user_id=user_id,
                document_id=document_id,
            )
        if mode == "quiz":
            return run_quiz_mode(extracted_text=extracted_text, entities=entities, clauses=clauses)
        if mode == "topics":
            return run_topics_mode(
                extracted_text=extracted_text,
                entities=entities,
                clauses=clauses,
                user_id=user_id,
                document_id=document_id,
            )

    effective_k = top_k if top_k != 5 else 5
    return run_legal_qa(
        user_id=user_id,
        document_id=document_id,
        query=query,
        chat_history=chat_history,
        clauses=clauses,
        top_k=effective_k,
    )
