# 🥗 EviNourish

**EviNourish** is an AI-powered diabetes nutrition assistant that helps users scan meals, log blood glucose readings, and receive personalised dietary recommendations — all through a clean web interface backed by a robust Python API.

---

## 📁 Project Structure

```
Evinourish/
├── main.py              # FastAPI app entry point
├── requirements.txt     # Python dependencies
├── routers/             # API route handlers (meals, glucose, recommendations)
├── services/            # ChromaDB RAG knowledge service
├── scripts/             # Data ingestion scripts
├── data/                # Research documents / local data
├── db/                  # Database helpers
├── tests/               # Unit & integration tests
└── frontend/            # React + Vite + TypeScript web app
    ├── src/
    │   ├── components/  # Reusable UI components
    │   ├── pages/       # Route pages
    │   └── services/    # API and Supabase service clients
    ├── package.json
    └── vite.config.ts
```

---

## 🧰 Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **Python 3.11+** | Core language |
| **FastAPI** | REST API framework with async support |
| **Uvicorn** | ASGI server |
| **Supabase** | Hosted PostgreSQL database + Auth |
| **Google Gemini API** | Vision AI for meal image scanning & food recognition |
| **USDA FoodData API** | Nutritional data lookup |
| **ChromaDB** | Local vector store for RAG |
| **LangChain (text-splitters)** | Document chunking for knowledge ingestion |
| **Tiktoken** | Token counting for AI context management |
| **OpenAI API** | LLM for personalised recommendations |
| **Pydantic** | Data validation and schema enforcement |
| **python-dotenv** | Environment variable management |
| **python-multipart** | Meal image upload support |
| **httpx** | Async HTTP client for external API calls |

### Frontend (`/frontend`)

| Technology | Purpose |
|---|---|
| **React 19** | UI component framework |
| **Vite 7** | Dev server & bundler |
| **TypeScript** | Type-safe JavaScript |
| **Tailwind CSS v3** | Utility-first CSS styling |
| **React Router v7** | Client-side routing |
| **Recharts** | Glucose data visualisation charts |
| **Supabase JS** | Client-side DB queries and auth |

---

## ⚙️ Prerequisites

- **Python 3.11+** — [Download](https://python.org)
- **Node.js 18+** and **npm** — [Download](https://nodejs.org)
- A **Supabase** project — [supabase.com](https://supabase.com)
- A **Google Gemini API** key — [Google AI Studio](https://aistudio.google.com)
- A **USDA FoodData Central API** key — [fdc.nal.usda.gov](https://fdc.nal.usda.gov/api-guide.html)
- An **OpenAI API** key — [platform.openai.com](https://platform.openai.com)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/rohit-356/Evinourish.git
cd Evinourish
```

---

### 2. Backend Setup

```bash
# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate          # macOS / Linux
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt
```

#### Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_KEY=<your-supabase-anon-key>
OPENAI_API_KEY=<your-openai-key>
USDA_API_KEY=<your-usda-key>
GEMINI_API_KEY=<your-gemini-key>
GROQ_API_KEY=<your-groq-key>
```

#### Run the API server

```bash
uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000` · Docs at `http://localhost:8000/docs`

#### (Optional) Load research documents into the vector store

```bash
python scripts/load_research.py
```

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_KEY=<your-supabase-anon-key>
```

#### Run the development server

```bash
npm run dev
```

Web app available at `http://localhost:5173`

---

### 4. Production Build (Full Stack)

Build the frontend and let FastAPI serve it:

```bash
# 1. Build the frontend bundle
cd frontend && npm run build

# 2. Start the backend — serves the built frontend automatically
cd .. && uvicorn main:app --port 8000
```

Everything is available at `http://localhost:8000`.

---

## 🔑 Key Features

- 📸 **Meal Scanning** — Upload a photo; Gemini Vision AI identifies ingredients and computes GI, calories, carbs, and protein
- 🩸 **Glucose Logging** — Log pre/post-meal blood glucose readings and track trends
- 🤖 **AI Recommendations** — Personalised dietary advice powered by RAG + LLM
- 🇮🇳 **Indian Food Database** — Extensive built-in nutritional data for Indian cuisine
- 🛡️ **Scope Guard** — Middleware blocks all non-nutritional (medical) queries at the API level

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/meals/scan` | Upload meal image → get nutritional breakdown |
| `POST` | `/meals/manual` | Manually log a meal by food name |
| `GET` | `/meals/history` | Retrieve meal history |
| `POST` | `/glucose/log` | Log a blood glucose reading |
| `GET` | `/glucose/history` | Get glucose readings history |
| `GET` | `/recommendations` | Get AI-powered dietary recommendations |

Full interactive docs at `/docs` when the server is running.

---

## 🔒 Security Notes

- **Never commit `.env` files.** Use `.env.example` as a template.
- CORS is currently set to `*`. Restrict `allow_origins` before deploying to production.

---

## 📄 License

MIT License — feel free to fork and build on this project.
