"""
LLM handler — OpenAI when configured, otherwise HuggingFace or extractive fallback.
"""

from __future__ import annotations

import os
import re
from functools import lru_cache

NOT_FOUND_PHRASE = "This information is not present in the document."
FALLBACK_PHRASE = (
    "The uploaded document does not explicitly mention this information. "
    "Would you like a summary of the closest related clause instead?"
)

_HF_MAX_PROMPT_CHARS = 4000


@lru_cache(maxsize=1)
def _openai_available() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def _generate_openai(prompt: str) -> str:
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage

    model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
    llm = ChatOpenAI(model=model, temperature=0.2, timeout=120)
    system = "You are JurisAI, a legal document assistant. Answer only from context. Use simple English."
    response = llm.invoke([SystemMessage(content=system), HumanMessage(content=prompt)])
    return (response.content or "").strip()


@lru_cache(maxsize=1)
def _get_hf_pipeline():
    from transformers import pipeline

    model_name = os.getenv("HF_LLM_MODEL", "google/flan-t5-base")
    return pipeline("text2text-generation", model=model_name, max_new_tokens=384, device=-1)


def _truncate_context(context: str, max_chars: int = 3000) -> str:
    if len(context) <= max_chars:
        return context
    return context[:max_chars].rstrip() + "\n…[truncated]"


def _generate_extractive_from_context(context: str, question: str) -> str:
    """Answer from context using keyword overlap — local fallback."""
    if not context.strip():
        return FALLBACK_PHRASE

    stop = {
        "what", "when", "where", "which", "who", "whom", "this", "that", "the", "and",
        "for", "with", "from", "about", "does", "document", "uploaded",
    }
    q_words = {w for w in re.findall(r"[a-z]{3,}", question.lower()) if w not in stop}
    sentences = re.split(r"(?<=[.!?])\s+", context)
    scored: list[tuple[int, str]] = []
    for s in sentences:
        s = s.strip()
        if len(s) < 15:
            continue
        sw = set(re.findall(r"[a-z]{3,}", s.lower()))
        overlap = len(q_words & sw)
        if overlap:
            scored.append((overlap, s))
    if not scored:
        return FALLBACK_PHRASE
    scored.sort(key=lambda x: x[0], reverse=True)
    answer = " ".join(s for _, s in scored[:2])
    return answer if len(answer) > 20 else FALLBACK_PHRASE


def generate_answer_from_context(context: str, query: str, prompt: str | None = None) -> str:
    """
    Generate a human-like answer grounded in retrieved context.

    Uses OpenAI if configured, else HF when USE_HF_LLM=true, else extractive synthesis.
    """
    full_prompt = prompt or f"Context:\n{context}\n\nQuestion:\n{query}\n\nAnswer:"
    ctx = _truncate_context(context)

    if _openai_available():
        try:
            return _generate_openai(full_prompt)
        except Exception as exc:
            print(f"OpenAI failed: {exc}")

    if os.getenv("USE_HF_LLM", "true").lower() in ("1", "true", "yes"):
        try:
            truncated = full_prompt if len(full_prompt) <= _HF_MAX_PROMPT_CHARS else full_prompt[:_HF_MAX_PROMPT_CHARS]
            pipe = _get_hf_pipeline()
            result = pipe(truncated)
            text = result[0].get("generated_text", "").strip()
            if text and len(text) > 15:
                return text
        except Exception as exc:
            print(f"HuggingFace failed: {exc}")

    return _generate_extractive_from_context(ctx, query)


def generate_answer(prompt: str) -> str:
    """Legacy entry — extracts context/question from prompt when possible."""
    ctx_match = re.search(r"Context:\n(.*?)\n\nQuestion:", prompt, re.DOTALL)
    q_match = re.search(r"Question:\n(.+?)\n\n", prompt, re.DOTALL)
    context = ctx_match.group(1).strip() if ctx_match else ""
    question = q_match.group(1).strip() if q_match else ""
    if context and question:
        return generate_answer_from_context(context, question, prompt=prompt)
    return generate_answer_from_context("", question or "Summarize", prompt=prompt)
