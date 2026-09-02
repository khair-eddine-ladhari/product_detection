# Illicit Detection Platform

An e-commerce product listing platform with AI-based content moderation. Every listing (title, description, and image) is automatically screened before it goes live, catching restricted or dangerous items — including sellers who try to hide them behind misleading text (e.g. a listing titled "headphones" whose image actually shows a firearm).

## Overview

The platform is a full moderation pipeline sitting between "seller submits a listing" and "listing goes live in the store." Every create or edit runs through:

1. **Technical image validation** — is the image even usable (reachable/decodable, not corrupted, under a size cap)?
2. **AI classification** — a multimodal LLM agent compares the listing's text against what the image actually shows, and flags weapons, counterfeit goods, or text/image mismatches.
3. **Verification** — code-level (not LLM-level) logic decides the final status: published, held for human review, or rejected.

Only code — never the LLM — decides `requires_human_review`, `review_notes`, or final `status`. The model's job is limited to describing what it sees; the pipeline's guard logic decides what happens as a result.

## Architecture

The system is split into two independently-run services plus a frontend:

```
Browser
  │
  ▼
back_web (Express)   ── product CRUD, MongoDB, calls back_ai for classification
  │  server-to-server only
  ▼
back_ai (FastAPI)    ── image validation → multimodal classification → verification
  │
  ▼
Gemini (multimodal LLM, via CrewAI)
```

- **`back_web`** owns product data and the seller-facing API. On create or edit, it calls `back_ai`'s `/classify` endpoint and stores the returned verdict on the product document.
- **`back_ai`** owns the actual moderation logic — it never talks to the browser directly, only to `back_web`.
- Frontend lets sellers upload/edit listings and lets moderators review flagged items.

## Moderation Pipeline (`back_ai`)

```
Product (id, name, description, image_url)
        │
        ▼
guards/image_check.py   → is_valid(image_url)
        │  (rejects unreachable/empty/corrupted images
        │   before paying for an LLM call; supports both
        │   http(s):// URLs and base64 data: URIs)
        ▼
agents/classification_agent.py   → classify(product)
        │  CrewAI agent + multimodal Gemini call, forced into
        │  a structured schema (flagged, category, confidence,
        │  reasoning, text_image_mismatch) — retries on
        │  transient rate-limit/server errors with backoff
        ▼
guards/verification.py   → sets requires_human_review,
        │                   review_notes, status
        ▼
ClassificationResult → returned to back_web
```

**Categories:** `weapon`, `counterfeit`, `none` (closed set — the LLM must pick one, it cannot invent new categories).

**Review statuses:** `approved`, `flagged_for_review`, `rejected_violation`, `rejected_invalid_image` — deliberately separate values, so "this image is technically broken" is never confused with "this is a genuine policy violation."

## Tech Stack

**`back_ai`** (Python)
- FastAPI, Pydantic (typed contracts between every pipeline stage — JSON only at true boundaries: the LLM call and the DB write)
- CrewAI (multimodal classification agent)
- Gemini (multimodal LLM, called via CrewAI's `LLM` wrapper)
- Pillow (PIL) — image decoding/corruption checks
- httpx — image fetching for URL-based images
- Structured logging to `classification.log`

**`back_web`** (Node.js)
- Express
- MongoDB / Mongoose
- axios (server-to-server calls to `back_ai`)

**Frontend**
- React-based product form / edit / review pages (`ProductForm.jsx`, `edit/[id]/page.jsx`, `review/`, `upload/`)

## Project Structure

```
product_detection/
├── back_ai/
│   ├── agents/
│   │   └── classification_agent.py   # CrewAI + Gemini multimodal classifier
│   ├── eval/
│   │   └── run_experiment.py
│   ├── guards/
│   │   ├── image_check.py            # technical image validation
│   │   └── verification.py           # sets status / review flags
│   ├── models/
│   │   └── schemas.py                # Product, ClassificationResult, enums
│   ├── main.py                       # FastAPI app, /classify route
│   ├── orchestrator.py               # wires guards + agent together
│   ├── requirements.txt
│   └── classification.log
│
└── back_web/
    ├── controllers/
    │   └── productController.js      # create/update/status, calls back_ai
    ├── models/
    ├── routes/
    │   └── products.js
    ├── services/
    │   └── aiService.js              # axios client for back_ai's /classify
    ├── index.js
    └── package.json

frontend/my-app/
└── src/app/
    ├── components/
    │   └── ProductForm.jsx
    ├── edit/[id]/page.jsx
    ├── review/                       # moderator review queue
    └── upload/page.jsx
```

## Notable Engineering Decisions

- **Guard checks run before paying for an LLM call.** `image_check.is_valid()` rejects unusable images (unreachable, empty, corrupted, oversized) up front, so `classification_agent.py` is never invoked on an image that can't be judged anyway.
- **Base64 and hosted-URL images are both supported.** Images can arrive as real `http(s)://` links or as `data:image/...;base64,...` URIs (e.g. inline uploads); both guard and classification stages branch on this rather than assuming one format.
- **The LLM never decides its own consequences.** `flagged`, `category`, `confidence`, `reasoning`, and `text_image_mismatch` come from the model; `requires_human_review`, `review_notes`, and `status` are set exclusively by code in `verification.py`.
- **Retries are scoped to genuinely transient failures.** Rate limits and upstream server errors (e.g. a model temporarily at capacity) are retried with exponential backoff; timeouts and connection errors are logged and surfaced immediately, since retrying won't fix a dead connection.
- **Re-classification triggers on any content change** — title, description, or image — not just the image, since misleading text over a real image is itself the attack this system is built to catch.

## Environment Variables

**`back_ai`**
```
GEMINI_API_KEY=
```

**`back_web`**
```
MONGO_URI=
AI_SERVICE_URL=http://127.0.0.1:8000
PORT=5000
```

## Author

Built by Khair Eddine Ladhari.