"""
JurisAI FastAPI entrypoint.

Run locally:
  uvicorn app:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.analyzer import analyze_document_text
from services.chunking import chunk_text
from services.extraction import extract_text
from services.learning_engine import (
    explain_clause_simple,
    generate_study_notes,
    suggest_learning_topics,
)
from services.quiz_engine import evaluate_quiz, generate_quiz
from services.mode_engine import (
    run_explain_document,
    run_legal_qa,
    run_quiz_mode,
    run_study_mode,
    run_topics_mode,
)
from services.vector_store import purge_document, upsert_chunks
from services.risk_engine import RiskEngine

load_dotenv()

app = FastAPI(title="JurisAI AI Service", version="3.0.0")

# Allow the Node backend to call this service from local dev.
_origins = os.getenv("CORS_ORIGINS", "http://localhost:5000,http://127.0.0.1:5000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PurgeRequest(BaseModel):
    document_id: str = Field(..., min_length=1)


class AnalyzeRequest(BaseModel):
    document_id: str = Field(..., min_length=1)
    extracted_text: str = Field(..., min_length=1)
    explanation_mode: str = Field(default="normal", pattern="^(normal|beginner)$")


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|ai)$")
    content: str = Field(..., min_length=1)


class IntelligenceRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    document_id: str = Field(..., min_length=1)
    mode: str = Field(..., pattern="^(legal|explain|study|quiz|topics)$")
    query: str = Field(default="")
    chat_history: list[ChatMessage] = Field(default_factory=list)
    extracted_text: str = Field(default="")
    document_summary: str = Field(default="")
    short_summary: str = Field(default="")
    entities: dict = Field(default_factory=dict)
    clauses: list[dict] = Field(default_factory=list)
    risks: list[dict] = Field(default_factory=list)
    top_k: int = Field(default=5, ge=1, le=10)


class ChatRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    document_id: str = Field(..., min_length=1)
    query: str = Field(..., min_length=1)
    chat_history: list[ChatMessage] = Field(default_factory=list)
    document_summary: str = Field(default="")
    entities: dict = Field(default_factory=dict)
    clauses: list[dict] = Field(default_factory=list)
    top_k: int = Field(default=5, ge=1, le=10)
    mode: str = Field(default="legal", pattern="^legal$")


class StudyNotesRequest(BaseModel):
    document_id: str = Field(..., min_length=1)
    extracted_text: str = Field(..., min_length=1)
    summary: str = Field(default="")
    short_summary: str = Field(default="")
    clauses: list[dict] = Field(default_factory=list)
    entities: dict = Field(default_factory=dict)
    note_type: str = Field(default="revision", pattern="^(revision|exam|quick_reference|key_takeaways)$")


class ExplainClauseRequest(BaseModel):
    clause_text: str = Field(..., min_length=1)
    clause_title: str = Field(default="Clause")


class QuizGenerateRequest(BaseModel):
    document_id: str = Field(..., min_length=1)
    extracted_text: str = Field(..., min_length=1)
    clauses: list[dict] = Field(default_factory=list)
    entities: dict = Field(default_factory=dict)
    num_questions: int = Field(default=8, ge=3, le=15)


class QuizEvaluateRequest(BaseModel):
    questions: list[dict] = Field(..., min_length=1)
    answers: list[dict] = Field(default_factory=list)


class LearningTopicsRequest(BaseModel):
    extracted_text: str = Field(default="")
    clauses: list[dict] = Field(default_factory=list)
    entities: dict = Field(default_factory=dict)


class RiskAnalysisRequest(BaseModel):
    document_id: str = Field(..., min_length=1)
    extracted_text: str = Field(..., min_length=1)
    clauses: list[str] = Field(default_factory=list)


@app.get("/health")
def health():
    return {"ok": True, "service": "jurisai-ai", "phase": 3}


@app.post("/intelligence")
def intelligence_endpoint(body: IntelligenceRequest):
    """
    Document intelligence modes — each mode returns distinct structured output.
    explain/study/quiz/topics do not require a user query.
    """
    try:
        history = [{"role": m.role, "content": m.content} for m in body.chat_history]
        mode = body.mode

        if mode == "legal":
            if not body.query.strip():
                raise HTTPException(status_code=400, detail="Query is required for legal mode.")
            result = run_legal_qa(
                user_id=body.user_id,
                document_id=body.document_id,
                query=body.query,
                chat_history=history,
                clauses=body.clauses,
                top_k=body.top_k,
            )
        elif mode == "explain":
            result = run_explain_document(
                extracted_text=body.extracted_text,
                summary=body.document_summary,
                short_summary=body.short_summary or body.document_summary,
                entities=body.entities,
                clauses=body.clauses,
                risks=body.risks,
                user_id=body.user_id,
                document_id=body.document_id,
            )
        elif mode == "study":
            result = run_study_mode(
                extracted_text=body.extracted_text,
                summary=body.document_summary,
                entities=body.entities,
                clauses=body.clauses,
                user_id=body.user_id,
                document_id=body.document_id,
            )
        elif mode == "quiz":
            result = run_quiz_mode(
                extracted_text=body.extracted_text,
                entities=body.entities,
                clauses=body.clauses,
            )
        elif mode == "topics":
            result = run_topics_mode(
                extracted_text=body.extracted_text,
                entities=body.entities,
                clauses=body.clauses,
                user_id=body.user_id,
                document_id=body.document_id,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown mode: {mode}")

        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/chat")
def chat_endpoint(body: ChatRequest):
    """
    Legal Q&A chat — top-5 RAG with conversational memory and citations.
    """
    try:
        history = [{"role": m.role, "content": m.content} for m in body.chat_history]
        result = run_legal_qa(
            user_id=body.user_id,
            document_id=body.document_id,
            query=body.query,
            chat_history=history,
            clauses=body.clauses,
            top_k=body.top_k,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/analyze-document")
def analyze_document_endpoint(body: AnalyzeRequest):
    """
    Phase 2: summarize, extract entities, detect clauses, simplify language.
    Node passes extracted_text from MongoDB (Phase 1 ingestion).
    """
    try:
        result = analyze_document_text(
            body.extracted_text,
            explanation_mode=body.explanation_mode,
        )
        return {
            "document_id": body.document_id,
            "summary": result["summary"],
            "short_summary": result["short_summary"],
            "entities": result["entities"],
            "clauses": result["clauses"],
            "simplified_text": result["simplified_text"],
            "risks": result.get("risks", []),
            "analysis_status": "completed",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/purge-document")
def purge_document_endpoint(body: PurgeRequest):
    """
    Remove vectors for a document.

    Called by the Node API when a user deletes an upload.
    """
    try:
        purge_document(body.document_id)
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001 — surface useful message for operators
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/process-document")
async def process_document(
    user_id: str = Form(...),
    document_id: str = Form(...),
    filename: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Full pipeline:
    1) persist upload to a temp path
    2) extract text
    3) chunk text (500 words / 50 overlap)
    4) embed + store in ChromaDB
    5) return metadata to Node (including extracted text for Mongo)
    """
    suffix = Path(filename).suffix.lower() or ""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = Path(tmp.name)
    tmp.close()

    try:
        contents = await file.read()
        tmp_path.write_bytes(contents)

        extracted = extract_text(tmp_path)
        chunks = chunk_text(extracted, chunk_size=600, chunk_overlap=100)

        stored = upsert_chunks(
            user_id=user_id,
            document_id=document_id,
            filename=filename,
            chunks=chunks,
        )

        return {
            "chunk_count": stored,
            "processing_status": "completed",
            "extracted_text": extracted,
        }
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except Exception:
            pass


@app.post("/generate-study-notes")
def generate_study_notes_endpoint(body: StudyNotesRequest):
    """Phase 5: Generate structured study notes from analyzed document."""
    try:
        result = generate_study_notes(
            extracted_text=body.extracted_text,
            summary=body.summary,
            short_summary=body.short_summary,
            clauses=body.clauses,
            entities=body.entities,
            note_type=body.note_type,
        )
        return {"document_id": body.document_id, **result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/explain-clause")
def explain_clause_endpoint(body: ExplainClauseRequest):
    """Phase 5: Beginner-friendly clause explanation."""
    try:
        return explain_clause_simple(body.clause_text, body.clause_title)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/generate-quiz")
def generate_quiz_endpoint(body: QuizGenerateRequest):
    """Phase 5: Generate quiz from document content."""
    try:
        result = generate_quiz(
            extracted_text=body.extracted_text,
            clauses=body.clauses,
            entities=body.entities,
            num_questions=body.num_questions,
        )
        return {"document_id": body.document_id, **result}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/evaluate-quiz")
def evaluate_quiz_endpoint(body: QuizEvaluateRequest):
    """Phase 5: Score quiz answers."""
    try:
        return evaluate_quiz(questions=body.questions, answers=body.answers)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/suggest-learning-topics")
def suggest_topics_endpoint(body: LearningTopicsRequest):
    """Phase 5: Recommend related legal learning topics."""
    try:
        topics = suggest_learning_topics(
            extracted_text=body.extracted_text,
            clauses=body.clauses,
            entities=body.entities,
        )
        return {"topics": topics}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/analyze-risk")
async def analyze_risk_endpoint(body: RiskAnalysisRequest):
    """
    Phase 4: Analyze legal document for risks.
    
    Detects:
    - Risky clauses
    - Missing clauses
    - One-sided language
    - Financial risks
    - Compliance issues
    - Overall risk score
    """
    try:
        risk_engine = RiskEngine()
        
        # Detect missing clauses
        missing_clauses = risk_engine.detect_missing_clauses(body.extracted_text)
        
        # Detect risky language
        risky_language = risk_engine.detect_risky_language(body.extracted_text)
        
        # Analyze financial risks
        financial_risks = risk_engine.analyze_financial_risks(body.extracted_text)
        
        # Rule-based clause risk scoring (no LLM dependency)
        clause_risks = risk_engine.analyze_clause_risk_sync(body.clauses)
        
        # Calculate overall risk score
        overall_score, risk_breakdown = risk_engine.calculate_risk_score(
            clause_risks=clause_risks,
            missing_clauses=missing_clauses,
            risky_language=risky_language,
            financial_risks=financial_risks
        )
        
        # Generate recommendations
        risk_analysis = {
            "clause_risks": clause_risks,
            "missing_clauses": missing_clauses,
            "risky_language": risky_language,
            "financial_risks": financial_risks
        }
        recommendations = risk_engine.generate_recommendations(risk_analysis, overall_score)
        
        return {
            "document_id": body.document_id,
            "overall_risk_score": overall_score,
            "risk_breakdown": risk_breakdown,
            "clause_risks": clause_risks,
            "missing_clauses": missing_clauses,
            "risky_language": risky_language,
            "financial_risks": financial_risks,
            "recommendations": recommendations,
            "analysis_status": "completed"
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc
