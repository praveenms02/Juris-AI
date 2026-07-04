# JurisAI — Phase 1, 2, 3 & 4

JurisAI is an AI-powered legal document intelligence platform for ingestion, analysis, chat, and risk scoring.

- **Phase 1** — Upload, extract text, chunk, embed, and index in ChromaDB.
- **Phase 2** — Summarize documents, extract key entities, detect clauses, and generate plain-language explanations.
- **Phase 3** — RAG-powered legal chatbot with chat history and source-aware answers.
- **Phase 4** — Contract risk analysis, missing clause detection, financial risk extraction, risk scoring, and recommendations.

## Architecture

- **frontend/** — React (Vite), Tailwind CSS, Axios, React Router
- **backend/** — Node.js + Express + MongoDB (Mongoose), JWT auth, uploads, risk API
- **ai-service/** — FastAPI + LangChain + ChromaDB + Transformers + spaCy + risk engine

### End-to-end flow

**Phase 1 (ingestion)**

1. User signs up or logs in (JWT).
2. User uploads a document (PDF, DOCX, TXT, or image).
3. Backend saves the file and creates a MongoDB `Document` record.
4. Backend forwards the file to `POST /process-document`.
5. AI service extracts text, chunks it, embeds chunks with `all-MiniLM-L6-v2`, and stores them in ChromaDB.
6. Backend updates MongoDB with `extractedText`, `chunkCount`, and `processingStatus`.

**Phase 2 (analysis)**

1. User opens a document and clicks **Analyze document**.
2. Backend loads `extractedText` and calls `POST /analyze-document`.
3. AI service returns summary, entities, clauses, and simplified language.
4. Backend persists analysis results and the UI displays structured insights.

**Phase 3 (RAG chat)**

1. User opens **Chat** for a processed document (`/chat/:documentId`).
2. User asks a question (e.g. “What is the rent?”).
3. Backend loads chat history and calls `POST /chat` on the AI service.
4. AI service retrieves top chunks from ChromaDB, builds a prompt with document context, and generates an answer.
5. Backend saves messages and returns the response with source excerpts.

**Phase 4 (risk analysis)**

1. User requests risk analysis for a document.
2. Backend calls `POST /analyze-risk` on the AI service with the extracted text and clause list.
3. AI service detects risky language, missing clauses, financial exposures, and clause-level risk.
4. AI service returns a risk score, breakdown, and recommendations.
5. Backend stores the risk analysis and the UI exposes the risk dashboard.

## Prerequisites

- **Node.js 18+**
- **MongoDB** running locally or accessible remotely
- **Python 3.11 or 3.12** recommended for `ai-service`
- **Tesseract OCR** for scanned document ingestion

### Install Tesseract

- **macOS (Homebrew):** `brew install tesseract`
- **Ubuntu/Debian:** `sudo apt-get install tesseract-ocr`

### Phase 2 — spaCy model

After installing Python dependencies:

```bash
cd ai-service
source .venv/bin/activate
python -m spacy download en_core_web_sm
```

The first analysis run also downloads the HuggingFace summarization model.

## Environment variables

| Variable | App | Purpose |
|----------|-----|---------|
| `MONGODB_URI` | backend | MongoDB connection |
| `JWT_SECRET` | backend | JWT signing |
| `PORT` | backend | API port |
| `AI_SERVICE_URL` | backend | FastAPI base URL |
| `FRONTEND_URL` | backend | CORS origins |
| `VITE_BACKEND_ORIGIN` | frontend | Vite proxy target |
| `CHROMA_PERSIST_DIR` | ai-service | Chroma persistence directory |
| `SUMMARIZER_MODEL` | ai-service | HuggingFace summarizer model id |
| `OPENAI_API_KEY` | ai-service | Optional GPT answers for chat |
| `OPENAI_MODEL` | ai-service | Default `gpt-3.5-turbo` |
| `USE_HF_LLM` | ai-service | Use local HuggingFace LLM instead of OpenAI |
| `RAG_TOP_K` | backend / ai-service | Number of chunks retrieved per question |
| `TESSERACT_CMD` | ai-service | Optional OCR executable path |

Copy `backend/.env.example`, `frontend/.env.example`, and `ai-service/.env.example` to `.env` in each app.

## Installation

### 1) MongoDB

Ensure MongoDB is available at your configured `MONGODB_URI`.

### 2) Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```

### 3) AI service

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### 4) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Run commands (summary)

| App | Command |
|-----|---------|
| Frontend | `npm run dev` |
| Backend | `npm start` |
| AI service | `uvicorn app:app --reload` |

## API reference

### Auth

- `POST /api/auth/register` — `{ name, email, password }`
- `POST /api/auth/login` — `{ email, password }`

### Documents (JWT required)

- `POST /api/documents/upload` — multipart field `file`
- `GET /api/documents` — optional `?q=` search
- `GET /api/documents/:id`
- `POST /api/documents/analyze/:id` — body: `{ "explanationMode": "normal" | "beginner" }`
- `DELETE /api/documents/:id`

### Chat (Phase 3)

- `POST /api/chat` — `{ "documentId", "query" }`
- `GET /api/chat/:documentId`
- `DELETE /api/chat/:documentId`

### Risk Analysis (Phase 4)

- `POST /api/risk/analyze/:documentId` — analyze document risk
- `GET /api/risk/:documentId` — fetch risk results
- `GET /api/risk` — list risk analyses for the authenticated user
- `DELETE /api/risk/:documentId` — delete a risk analysis record

### AI service

- `POST /process-document` — Phase 1 ingest
- `POST /analyze-document` — Phase 2 analysis
- `POST /chat` — Phase 3 RAG chat
- `POST /analyze-risk` — Phase 4 risk scoring
- `POST /purge-document` — remove vectors for a document
- `GET /health`

## Project structure

```
jurisai/
├── frontend/
│   └── src/pages/DocumentDetailPage.jsx
├── backend/
│   ├── models/
│   └── services/
└── ai-service/
    ├── services/
    │   ├── analyzer.py
    │   ├── clause_detector.py
    │   ├── risk_engine.py
    │   ├── rag_pipeline.py
    │   └── ...
```

## Phase 4 features

- Missing clause detection for confidentiality, liability, disputes, indemnification, and more
- Clause-level risk scoring and labels
- Financial risk extraction for deposits, fees, penalties, and high-value exposures
- Overall risk score and breakdown
- Actionable recommendations with priority and rationale
- Backend persistence via `GET /api/risk` and document-specific risk lookups
- Phase 4 support files: `phase4_test.js`, `phase4_test.py`, `PHASE_4_DOCUMENTATION.md`, `PHASE_4_IMPLEMENTATION_SUMMARY.md`

## Troubleshooting

- Ensure the AI service is running at `AI_SERVICE_URL` before analyzing or chatting.
- Install all Python dependencies and `en_core_web_sm` for Phase 2 analysis.
- If chat returns generic answers, provide `OPENAI_API_KEY` or configure `USE_HF_LLM`.
- If document analysis fails, confirm `extractedText` exists and the document is processed.
- If port 5000 is unavailable, set `PORT=5001` in `backend/.env` and update `VITE_BACKEND_ORIGIN` in `frontend/.env`.
- **`connect ECONNREFUSED 127.0.0.1:27017`:** MongoDB is not running. Start it with `brew services start mongodb-community` (macOS Homebrew), then restart the backend.
- **`http proxy error: /api/... ECONNREFUSED 127.0.0.1:5001`:** The backend is not running (often because MongoDB failed first). Fix MongoDB, then run `npm run dev` in `backend/`.

## Push-ready cleanup guidance

Local development artifacts should not be committed to GitHub:

- `backend/node_modules/`
- `frontend/node_modules/`
- `ai-service/.venv/`
- `ai-service/__pycache__/`
- `ai-service/chroma_db/*` (except `.gitkeep`)
- `backend/uploads/*` (except `.gitkeep`)
- any `.env` file in the repository
- local logs such as `backend/debug_risk.log`

## Security note

This repo is configured for local development. Before deploying publicly, secure secrets, tighten CORS, add rate limiting, and use managed storage for uploads.
