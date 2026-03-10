from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import os

# Load environment variables from .env as the very first step.
# All downstream modules rely on this having been called before their imports.
load_dotenv()

from routers import meals, glucose, recommendations

# Validate that the critical environment variables are present at startup.
# Failing early with a clear message is far better than mysterious 500 errors
# surfacing only when the first real request hits a missing-credential path.
REQUIRED_ENV_VARS = [
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "OPENAI_API_KEY",
    "USDA_API_KEY",
]

# ---------------------------------------------------------------------------
# Scope-lock middleware
# ---------------------------------------------------------------------------

# Keywords that indicate a non-nutritional / medical query.
# If any appears in the request body the middleware short-circuits immediately
# and returns an out_of_scope response — no router code runs.
_BLOCKED_KEYWORDS: frozenset[str] = frozenset([
    "pill", "medication", "rash", "wound",
    "symptom", "medicine", "tablet", "injection",
])

_OUT_OF_SCOPE_RESPONSE = {
    "status": "out_of_scope",
    "message": (
        "I'm only trained for nutritional analysis. "
        "Please consult a doctor for medical queries."
    ),
}


async def scope_lock_middleware(request: Request, call_next):
    """
    FastAPI middleware that inspects every non-GET request body for blocked
    medical keywords. If any keyword is found (case-insensitive), returns
    a 200 out_of_scope JSON immediately without forwarding to any router.

    The body is fully buffered, checked, then re-injected into the ASGI
    receive channel so downstream handlers can still read it normally.
    """
    # Only check methods that carry a body; skip GET / HEAD / OPTIONS.
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return await call_next(request)

    # Buffer the entire body (safe — our largest expected payload is an image
    # or a short JSON object; nothing that would exhaust memory here).
    raw_body: bytes = await request.body()

    # Attempt to decode as UTF-8 text for keyword scanning.
    # Binary bodies (e.g. multipart image uploads) are decoded with
    # errors="ignore" so non-text bytes are silently skipped.
    body_text = raw_body.decode("utf-8", errors="ignore").lower()

    if any(keyword in body_text for keyword in _BLOCKED_KEYWORDS):
        return JSONResponse(content=_OUT_OF_SCOPE_RESPONSE, status_code=200)

    # Re-inject the buffered body so routers can still call request.body() /
    # request.json() / request.form() — FastAPI only reads the stream once.
    async def _receive():
        return {"type": "http.request", "body": raw_body, "more_body": False}

    request._receive = _receive  # type: ignore[attr-defined]

    return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    missing = [var for var in REQUIRED_ENV_VARS if not os.getenv(var)]
    if missing:
        # Print to stderr so it appears in server logs; do not crash the process
        # so that developers can still reach /docs to inspect the API shape.
        print(
            f"[STARTUP WARNING] The following required environment variables are not set: "
            f"{', '.join(missing)}. "
            f"Copy .env.example to .env and fill in the values."
        )
    yield  # Application runs here
    # TODO: Add cleanup logic here (e.g. close DB connections) when needed.


# Initialize FastAPI app with lifespan for startup/shutdown hooks.
app = FastAPI(
    title="EviNourish API",
    description="Diabetes nutrition API: meal scanning, glucose logging, and personalised recommendations.",
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------

# Allow the Vite dev server to make cross-origin requests to the API.
# Expand allow_origins before deploying to production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Middleware registration
# ---------------------------------------------------------------------------

# scope_lock_middleware must be registered BEFORE include_router so that
# it intercepts every route, including future ones added by other routers.
app.middleware("http")(scope_lock_middleware)

# Register all application routers
app.include_router(meals.router)
app.include_router(glucose.router)
app.include_router(recommendations.router)


# ---------------------------------------------------------------------------
# Serve React frontend
# ---------------------------------------------------------------------------
build_path = "/Users/tech/Documents/Developer/evinourish-web/dist"
if os.path.exists(build_path):
    app.mount("/assets", StaticFiles(directory=f"{build_path}/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(f"{build_path}/index.html")
