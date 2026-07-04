# Phase 5 — Collaborative Legal Learning Platform

Phase 5 is an **additive** layer on top of Phases 1–4. No existing APIs, schemas, or workflows were removed or modified in breaking ways.

## Features

| Feature | Backend | AI Service | Frontend |
|---------|---------|------------|----------|
| AI Study Notes | `POST /api/notes/generate/:documentId` | `/generate-study-notes` | `/learning/notes/:documentId` |
| Beginner Clause Explanation | `POST /api/notes/explain/:documentId` | `/explain-clause` | Document detail + chat explain mode |
| AI Quiz Generator | `POST /api/quiz/generate/:documentId` | `/generate-quiz` | `/learning/quiz/:documentId` |
| Quiz Evaluation | `POST /api/quiz/submit` | `/evaluate-quiz` | Quiz Center |
| Annotations | `POST/GET /api/annotations` | — | `/learning/annotate/:documentId` |
| Discussion Forum | `POST/GET /api/discussions` | — | `/learning/forum` |
| Learning Dashboard | `GET /api/learning/dashboard` | `/suggest-learning-topics` | `/learning` |
| Learning Chat Modes | `POST /api/chat` + `mode` | `/chat` + `mode` | Chat page mode tabs |

## New MongoDB Collections

- **Note** — userId, documentId, title, content, noteType, sections
- **Annotation** — documentId, userId, selectedText, note, resolved
- **Comment** — annotationId, userId, comment, parentCommentId
- **Discussion** — userId, title, content, category, documentId, replies[]
- **Quiz** — documentId, userId, questions[]
- **QuizAttempt** — userId, quizId, score, answers, results

## AI Service Modules

- `services/learning_engine.py` — study notes, clause explanations, topic suggestions
- `services/quiz_engine.py` — quiz generation and auto-evaluation

## Chat Learning Modes (backward compatible)

Default `mode=legal` preserves Phase 3 behavior. Optional modes:

- `explain` — simple clause explanations
- `study` — study note generation from retrieved context
- `quiz` — quiz suggestions from context
- `topics` — learning topic recommendations

## Regression Checklist

- [ ] Upload + OCR + chunking (Phase 1)
- [ ] Summarization + NER + clauses (Phase 2)
- [ ] RAG chat with `mode=legal` (Phase 3)
- [ ] Risk analysis (Phase 4)
- [ ] New learning routes return 401 without auth
- [ ] Notes/quiz require processed documents

## Environment

No new required env vars. Existing `AI_SERVICE_URL`, `RAG_TOP_K` continue to work.

## Export Notes

Notes export as downloadable `.txt` (print-to-PDF via browser). No new npm dependencies added.
