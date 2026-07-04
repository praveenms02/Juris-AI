"""
Phase 5 — Quiz generation and evaluation from analyzed documents.

Rule-based MCQ / T/F / short-answer / scenario questions — no paid APIs.
"""

from __future__ import annotations

import re
import uuid
from typing import Any


def _mcq(question: str, options: list[str], correct_index: int, explanation: str = "") -> dict:
    return {
        "id": str(uuid.uuid4())[:8],
        "type": "mcq",
        "question": question,
        "options": options,
        "correct_answer": options[correct_index],
        "explanation": explanation,
    }


def _true_false(statement: str, correct: bool, explanation: str = "") -> dict:
    return {
        "id": str(uuid.uuid4())[:8],
        "type": "true_false",
        "question": statement,
        "options": ["True", "False"],
        "correct_answer": "True" if correct else "False",
        "explanation": explanation,
    }


def _short_answer(question: str, expected: str, explanation: str = "") -> dict:
    return {
        "id": str(uuid.uuid4())[:8],
        "type": "short_answer",
        "question": question,
        "correct_answer": expected,
        "explanation": explanation,
    }


def _fill_blank(question: str, expected: str, explanation: str = "") -> dict:
    return {
        "id": str(uuid.uuid4())[:8],
        "type": "fill_blank",
        "question": question,
        "correct_answer": expected,
        "explanation": explanation,
    }


def _scenario(question: str, expected: str, explanation: str = "") -> dict:
    return {
        "id": str(uuid.uuid4())[:8],
        "type": "scenario",
        "question": question,
        "correct_answer": expected,
        "explanation": explanation,
    }


def generate_quiz(
    *,
    extracted_text: str,
    clauses: list[dict] | None = None,
    entities: dict | None = None,
    num_questions: int = 8,
) -> dict[str, Any]:
    """
    Generate a mixed quiz from document clauses and extracted entities.
    """
    clauses = clauses or []
    entities = entities or {}
    text = extracted_text or ""
    questions: list[dict] = []

    rent = entities.get("rent", "")
    deposit = entities.get("deposit", "")
    duration = entities.get("duration", "")
    owner = entities.get("owner", "")
    tenant = entities.get("tenant", "")

    if rent:
        distractors = ["₹10,000", "₹50,000", "₹1,00,000"]
        opts = [rent] + [d for d in distractors if d not in str(rent)][:3]
        while len(opts) < 4:
            opts.append("Not specified")
        questions.append(
            _mcq(
                "What is the monthly rent specified in this document?",
                opts[:4],
                0,
                f"The document states rent as {rent}.",
            )
        )
        questions.append(
            _fill_blank(
                f"The monthly rent is ___________ according to this document.",
                rent,
                f"Rent amount: {rent}.",
            )
        )
    if deposit:
        questions.append(
            _mcq(
                "What is the security deposit amount?",
                [deposit, "No deposit required", "Equal to one month's rent (unspecified)", "Non-refundable"],
                0,
                f"Security deposit: {deposit}.",
            )
        )
    if owner:
        questions.append(
            _short_answer(
                "Who is the owner/landlord in this agreement?",
                owner,
                f"The owner/landlord is {owner}.",
            )
        )
    if tenant:
        questions.append(
            _short_answer(
                "Who is the tenant/lessee in this agreement?",
                tenant,
                f"The tenant is {tenant}.",
            )
        )
    if duration:
        questions.append(
            _true_false(
                f"The agreement duration is {duration}.",
                True,
                f"Duration mentioned: {duration}.",
            )
        )

    for clause in clauses[:4]:
        title = clause.get("title", "Clause")
        snippet = (clause.get("text") or "")[:200]
        if not snippet:
            continue
        questions.append(
            _true_false(
                f"This document contains a {title.replace(' Clause', '')} provision.",
                True,
                f"Found: {title}.",
            )
        )
        if "rent" in title.lower() or "deposit" in title.lower():
            questions.append(
                _scenario(
                    "The tenant pays rent five days late. What section of this document should they review first?",
                    title,
                    "Rent and penalty clauses define due dates and late fees.",
                )
            )

    if "terminat" in text.lower():
        questions.append(
            _mcq(
                "Which topic is likely covered regarding ending the agreement?",
                ["Termination / notice period", "Stock options", "Patent licensing", "Merger control"],
                0,
                "Termination language appears in the document.",
            )
        )

    if "maintenance" in text.lower() or "repair" in text.lower():
        questions.append(
            _true_false(
                "The document addresses maintenance or repair responsibilities.",
                True,
                "Maintenance/repair keywords found in the text.",
            )
        )

    if len(questions) < 3:
        questions.append(
            _short_answer(
                "What type of legal document is this (e.g. lease, contract)?",
                "Legal agreement",
                "Review the title and opening paragraphs of the document.",
            )
        )

    questions = questions[: max(3, min(num_questions, 15))]
    return {
        "questions": questions,
        "question_count": len(questions),
    }


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _score_answer(question: dict, user_answer: str) -> tuple[bool, str]:
    correct = _normalize(question.get("correct_answer", ""))
    given = _normalize(user_answer)
    qtype = question.get("type", "")

    # ── Never award marks for blank submissions ──────────────────────────────
    if not given:
        is_correct = False

    elif qtype in ("mcq", "true_false"):
        # Exact match only
        is_correct = given == correct

    elif qtype in ("short_answer", "scenario", "fill_blank"):
        # Must have a non-trivial answer AND meaningful word overlap
        given_words = set(given.split())
        correct_words = set(correct.split())

        # Require at least 1 matching word (excluding very common stop-words)
        STOP = {"the", "a", "an", "is", "in", "of", "to", "and", "or", "this", "for"}
        overlap = (given_words - STOP) & (correct_words - STOP)

        # Exact substring match OR sufficient word overlap
        is_correct = (
            correct in given                        # user's answer contains the correct answer
            or (len(given) >= 2 and given in correct)  # correct answer contains user's (only if user wrote something meaningful)
            or (
                len(overlap) >= max(1, len(correct_words - STOP) // 2)
                and len(given) >= 3                 # must have typed at least 3 chars
            )
        )
    else:
        is_correct = given == correct

    if is_correct:
        feedback = question.get("explanation", "Correct!")
    else:
        expected = question.get("correct_answer", "")
        feedback = f"Incorrect. Expected: {expected}" if expected else "Incorrect."

    return is_correct, feedback


def evaluate_quiz(*, questions: list[dict], answers: list[dict]) -> dict[str, Any]:
    """
    Score a quiz submission.

    answers: [{ question_id, answer }]
    """
    answer_map = {a.get("question_id"): a.get("answer", "") for a in answers}
    results: list[dict] = []
    correct_count = 0

    for q in questions:
        qid = q.get("id")
        user_ans = answer_map.get(qid, "")
        is_correct, feedback = _score_answer(q, user_ans)
        if is_correct:
            correct_count += 1
        results.append(
            {
                "question_id": qid,
                "question": q.get("question"),
                "type": q.get("type"),
                "user_answer": user_ans,
                "correct_answer": q.get("correct_answer"),
                "is_correct": is_correct,
                "feedback": feedback,
            }
        )

    total = len(questions) or 1
    score = round((correct_count / total) * 100)

    return {
        "score": score,
        "correct_count": correct_count,
        "total": len(questions),
        "results": results,
    }
