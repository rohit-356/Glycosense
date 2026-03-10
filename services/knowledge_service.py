import json
import os
import re

# ---------------------------------------------------------------------------
# Load PubMed abstracts from local JSON file at startup
# ---------------------------------------------------------------------------

_ABSTRACTS = []

def _load_abstracts():
    global _ABSTRACTS
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'pubmed_abstracts.json')
    try:
        with open(data_path, 'r') as f:
            _ABSTRACTS = json.load(f)
        print(f"[knowledge_service] Loaded {len(_ABSTRACTS)} PubMed abstracts")
    except Exception as e:
        print(f"[knowledge_service] WARNING: Could not load abstracts: {e}")
        _ABSTRACTS = []

_load_abstracts()

# ---------------------------------------------------------------------------
# ADA fallback used when no relevant research is found
# ---------------------------------------------------------------------------

ADA_FALLBACK = {
    "abstract_text": (
        "The American Diabetes Association recommends choosing foods with a low "
        "glycemic index, limiting refined carbohydrates, and pairing carbohydrates "
        "with protein or fibre to slow glucose absorption."
    ),
    "journal": "ADA Standards of Medical Care in Diabetes",
    "year": 2024,
    "pubmed_id": None,
    "similarity": 0.0,
    "source": "ada_fallback",
}

FALLBACK_TO_ADA = 0.2

# ---------------------------------------------------------------------------
# query_research — keyword-based search over loaded abstracts
# ---------------------------------------------------------------------------

def query_research(query: str, n_results: int = 1) -> dict:
    """
    Searches PubMed abstracts using keyword matching.
    Returns the most relevant abstract or ADA fallback.
    """
    if not _ABSTRACTS:
        return ADA_FALLBACK

    query_words = set(re.sub(r'[^a-z0-9 ]', '', query.lower()).split())

    best_score = 0.0
    best_abstract = None

    for abstract in _ABSTRACTS:
        text = (
            abstract.get('abstract_text', '') + ' ' +
            abstract.get('title', '') + ' ' +
            ' '.join(abstract.get('topic_tags', []))
        ).lower()
        text_words = set(re.sub(r'[^a-z0-9 ]', '', text).split())

        # Jaccard similarity between query words and abstract words
        if not query_words or not text_words:
            continue
        intersection = query_words & text_words
        union = query_words | text_words
        score = len(intersection) / len(union)

        if score > best_score:
            best_score = score
            best_abstract = abstract

    if best_abstract is None or best_score < FALLBACK_TO_ADA:
        return ADA_FALLBACK

    return {
        "abstract_text": best_abstract.get("abstract_text", ""),
        "journal": best_abstract.get("journal", "Research Journal"),
        "year": best_abstract.get("year"),
        "pubmed_id": best_abstract.get("pubmed_id"),
        "similarity": round(best_score, 3),
        "source": "pubmed",
    }
