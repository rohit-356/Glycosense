#!/usr/bin/env python3
"""
scripts/load_research.py
------------------------
One-time loader: reads PubMed abstracts from data/pubmed_abstracts.json,
chunks them with a 200-token / 20-token-overlap splitter, embeds each chunk
with OpenAI text-embedding-3-small, and stores everything in a local
ChromaDB collection called "diabetes_research".

Run from the project root:
    python scripts/load_research.py

Idempotent: documents whose (pubmed_id + chunk_index) ID already exist in
ChromaDB are skipped, so the script can be re-run safely.
"""

import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Environment setup — must happen before any os.getenv() call
# ---------------------------------------------------------------------------

# Resolve project root (one level above scripts/) and load .env from there
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

import chromadb
import tiktoken
from langchain_text_splitters import RecursiveCharacterTextSplitter
from openai import OpenAI

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Path to the abstracts file (relative to project root)
ABSTRACTS_FILE = PROJECT_ROOT / "data" / "pubmed_abstracts.json"

# ChromaDB persists to disk at this path so embeddings survive server restarts
CHROMA_PERSIST_DIR = str(PROJECT_ROOT / "chroma_db")

# Target collection name — must match the name used in knowledge_service.py
COLLECTION_NAME = "diabetes_research"

# Embedding model — text-embedding-3-small balances cost and quality well
EMBEDDING_MODEL = "text-embedding-3-small"

# Tokenizer used by the text splitter to count tokens accurately
TOKENIZER_MODEL = "cl100k_base"  # matches text-embedding-3-small's tokenizer

# Chunk size in tokens and overlap in tokens
CHUNK_SIZE_TOKENS = 200
CHUNK_OVERLAP_TOKENS = 20

# Required metadata fields; every entry must provide all of these
REQUIRED_FIELDS = {"title", "abstract", "journal", "year", "pubmed_id", "topic_tags"}

# OpenAI rate-limit: pause this many seconds between embedding API calls
# to avoid hitting the requests-per-minute ceiling.  Increase if you see 429s.
EMBED_SLEEP_SECONDS = 0.05


# ---------------------------------------------------------------------------
# Helper: build_tiktoken_len_fn
# ---------------------------------------------------------------------------

# Returns a function that counts tokens in a string using the given tiktoken
# encoding. Used as the `length_function` argument to RecursiveCharacterTextSplitter
# so that chunks are measured in tokens, not characters.
def build_tiktoken_len_fn(encoding_name: str):
    enc = tiktoken.get_encoding(encoding_name)

    def _len(text: str) -> int:
        return len(enc.encode(text))

    return _len


# ---------------------------------------------------------------------------
# Helper: load_abstracts
# ---------------------------------------------------------------------------

# Reads and validates the JSON file at ABSTRACTS_FILE.
# Returns a list of abstract dicts. Raises SystemExit with a clear message
# if the file is missing, malformed, or contains entries with absent fields.
def load_abstracts() -> list[dict]:
    if not ABSTRACTS_FILE.exists():
        print(f"[ERROR] Abstracts file not found: {ABSTRACTS_FILE}", file=sys.stderr)
        print("        Create data/pubmed_abstracts.json and populate it with abstracts.", file=sys.stderr)
        sys.exit(1)

    try:
        with open(ABSTRACTS_FILE, encoding="utf-8") as fh:
            records = json.load(fh)
    except json.JSONDecodeError as e:
        print(f"[ERROR] Could not parse {ABSTRACTS_FILE}: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(records, list) or len(records) == 0:
        print("[ERROR] pubmed_abstracts.json must be a non-empty JSON array.", file=sys.stderr)
        sys.exit(1)

    # Validate that every record has the required fields and correct types
    for idx, record in enumerate(records):
        pid = record.get('pubmed_id', 'UNKNOWN')

        missing = REQUIRED_FIELDS - set(record.keys())
        if missing:
            print(
                f"[ERROR] Record at index {idx} (pubmed_id={pid}) "
                f"is missing required fields: {sorted(missing)}",
                file=sys.stderr,
            )
            sys.exit(1)

        # Guard: abstract must be a non-empty string. An empty abstract would
        # produce meaningless chunks and waste OpenAI embedding quota.
        abstract = record.get("abstract", "")
        if not isinstance(abstract, str) or not abstract.strip():
            print(
                f"[ERROR] Record at index {idx} (pubmed_id={pid}) has an empty or non-string abstract.",
                file=sys.stderr,
            )
            sys.exit(1)

        # Guard: year must be castable to int so metadata is not corrupt.
        try:
            int(record["year"])
        except (TypeError, ValueError):
            print(
                f"[ERROR] Record at index {idx} (pubmed_id={pid}) has an invalid 'year': {record['year']!r}",
                file=sys.stderr,
            )
            sys.exit(1)

        # Guard: topic_tags must be a list so ', '.join() works correctly.
        # A bare string like "diabetes" would join individual characters.
        if not isinstance(record["topic_tags"], list):
            print(
                f"[ERROR] Record at index {idx} (pubmed_id={pid}) 'topic_tags' must be a JSON array, "
                f"got: {type(record['topic_tags']).__name__!r}",
                file=sys.stderr,
            )
            sys.exit(1)

    return records


# ---------------------------------------------------------------------------
# Helper: chunk_abstract
# ---------------------------------------------------------------------------

# Splits a single abstract string into a list of text chunks using a
# token-aware RecursiveCharacterTextSplitter.  The original abstract is
# never summarised or paraphrased — only split at natural boundaries.
def chunk_abstract(abstract_text: str, splitter: RecursiveCharacterTextSplitter) -> list[str]:
    return splitter.split_text(abstract_text)


# ---------------------------------------------------------------------------
# Helper: embed_texts
# ---------------------------------------------------------------------------

# Sends a list of text strings to the OpenAI Embeddings API and returns
# a list of float vectors (one per input string).
# Raises SystemExit on API errors so the caller doesn't have to handle it.
def embed_texts(client: OpenAI, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []

    try:
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
        )
    except Exception as e:
        print(f"[ERROR] OpenAI Embeddings API call failed: {e}", file=sys.stderr)
        sys.exit(1)

    embeddings = [item.embedding for item in response.data]

    # Guard: OpenAI must return exactly one embedding per input string.
    # A mismatch here would silently corrupt document-to-embedding alignment.
    if len(embeddings) != len(texts):
        print(
            f"[ERROR] OpenAI returned {len(embeddings)} embedding(s) for {len(texts)} input(s). "
            "Cannot safely align embeddings to chunks.",
            file=sys.stderr,
        )
        sys.exit(1)

    return embeddings


# ---------------------------------------------------------------------------
# Helper: get_or_create_collection
# ---------------------------------------------------------------------------

# Returns the ChromaDB collection, creating it if it does not yet exist.
# Uses cosine distance so that `similarity = 1 - distance`, which maps
# cleanly onto the 0.75 threshold enforced in knowledge_service.py.
def get_or_create_collection(client: chromadb.ClientAPI) -> chromadb.Collection:
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


# ---------------------------------------------------------------------------
# Main loader
# ---------------------------------------------------------------------------

# Orchestrates the full pipeline:
#   1. Load and validate abstracts from JSON
#   2. Chunk each abstract into token-sized pieces
#   3. Embed each chunk via OpenAI
#   4. Upsert into ChromaDB (skipping existing doc IDs automatically)
def main() -> None:
    # ── Validate environment ──────────────────────────────────────────────
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("[ERROR] OPENAI_API_KEY is not set. Copy .env.example to .env and fill it in.", file=sys.stderr)
        sys.exit(1)

    openai_client = OpenAI(api_key=api_key)

    # ── Load abstracts ────────────────────────────────────────────────────
    records = load_abstracts()
    print(f"[INFO] Loaded {len(records)} abstracts from {ABSTRACTS_FILE}")

    # ── Build text splitter ───────────────────────────────────────────────
    tiktoken_len = build_tiktoken_len_fn(TOKENIZER_MODEL)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE_TOKENS,
        chunk_overlap=CHUNK_OVERLAP_TOKENS,
        length_function=tiktoken_len,
        # Prefer splitting on paragraph, sentence, then word boundaries
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    # ── Initialise ChromaDB (persistent on disk) ──────────────────────────
    chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    collection = get_or_create_collection(chroma_client)
    print(f"[INFO] Using ChromaDB collection '{COLLECTION_NAME}' at {CHROMA_PERSIST_DIR}")

    # ── Process each abstract ─────────────────────────────────────────────
    total_chunks_added = 0

    for record in records:
        pubmed_id = str(record["pubmed_id"])
        abstract_text = record["abstract"]  # stored verbatim — never paraphrased

        chunks = chunk_abstract(abstract_text, splitter)
        print(f"[INFO] {pubmed_id}: {len(chunks)} chunk(s)")

        for chunk_idx, chunk_text in enumerate(chunks):
            # Stable, unique ID for each chunk of each paper
            doc_id = f"{pubmed_id}_chunk{chunk_idx}"

            # Skip if already in ChromaDB (idempotency)
            existing = collection.get(ids=[doc_id])
            if existing["ids"]:
                print(f"  [SKIP] {doc_id} already exists in collection")
                continue

            # Embed the chunk. embed_texts guarantees exactly 1 result for 1 input
            # (it exits on mismatch), so index-access is safe here.
            embeddings = embed_texts(openai_client, [chunk_text])
            embedding = embeddings[0]

            # Metadata — all four required fields PLUS chunk provenance
            metadata = {
                "journal": record["journal"],
                "year": int(record["year"]),
                "pubmed_id": pubmed_id,
                # topic_tags is a list; ChromaDB metadata values must be scalar,
                # so we store it as a comma-separated string
                "topic_tags": ", ".join(record["topic_tags"]),
                "chunk_index": chunk_idx,
                "title": record["title"],
            }

            collection.add(
                ids=[doc_id],
                embeddings=[embedding],
                # Store the full, original chunk text — no summarisation
                documents=[chunk_text],
                metadatas=[metadata],
            )

            print(f"  [ADD] {doc_id}")
            total_chunks_added += 1

            # Respect OpenAI rate limits between chunk embeddings
            time.sleep(EMBED_SLEEP_SECONDS)

    print(f"\n[DONE] Added {total_chunks_added} new chunk(s) to '{COLLECTION_NAME}'.")


if __name__ == "__main__":
    main()
