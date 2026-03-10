"""
tests/test_knowledge_service.py
--------------------------------
Unit tests for services/knowledge_service.py.

All tests mock OpenAI and ChromaDB so no network calls or live API keys are
required. Three cases are covered:
  1. Successful match  — similarity 0.90 (distance 0.10) → returns abstract
  2. Low similarity    — similarity 0.40 (distance 0.60) → FALLBACK_TO_ADA
  3. No results        — ChromaDB returns empty lists    → FALLBACK_TO_ADA

Run with:
    python -m pytest tests/test_knowledge_service.py -v
"""

import importlib
import sys
import types
import unittest
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Module bootstrap: stub out heavy optional imports before the service loads
# ---------------------------------------------------------------------------

# Stub `chromadb` so the module can be imported even without the package
_chromadb_stub = types.ModuleType("chromadb")
_chromadb_stub.PersistentClient = MagicMock()
sys.modules.setdefault("chromadb", _chromadb_stub)

# Stub `openai` so the module can be imported without the package
_openai_stub = types.ModuleType("openai")
_openai_stub.OpenAI = MagicMock()
sys.modules.setdefault("openai", _openai_stub)

# Import the service after stubs are in place
import services.knowledge_service as ks

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Builds a fake ChromaDB query result dict with a single result.
# distance — cosine distance value; similarity = 1 - distance
def _make_chroma_result(distance: float, abstract: str = "Abstract text.", metadata: dict | None = None) -> dict:
    meta = metadata or {
        "journal": "Diabetes Care",
        "year": 2021,
        "pubmed_id": "34101234",
        "topic_tags": "glycemic index, HbA1c",
    }
    return {
        "distances": [[distance]],
        "documents": [[abstract]],
        "metadatas": [[meta]],
    }


# Builds an empty ChromaDB query result (no candidates found)
def _make_empty_chroma_result() -> dict:
    return {
        "distances": [[]],
        "documents": [[]],
        "metadatas": [[]],
    }


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class TestQueryResearch(unittest.TestCase):

    # Ensure the module-level collection cache is cleared between every test
    # so collection mocks from one test do not bleed into the next.
    def setUp(self):
        ks._chroma_collection = None

    # Tests that a high-similarity result (distance 0.10 → similarity 0.90)
    # returns all four required fields plus the similarity score.
    @patch.object(ks, "_embed_query", return_value=[0.1] * 1536)
    @patch.object(ks, "_get_chroma_collection")
    def test_successful_match(self, mock_get_collection, _mock_embed):
        """Similarity 0.90 ≥ 0.75 → returns abstract metadata."""
        mock_collection = MagicMock()
        mock_collection.query.return_value = _make_chroma_result(
            distance=0.10,
            abstract="Dietary glycemic index interventions improve HbA1c.",
            metadata={
                "journal": "Diabetes Care",
                "year": 2021,
                "pubmed_id": "34101234",
                "topic_tags": "glycemic index, HbA1c",
            },
        )
        mock_get_collection.return_value = mock_collection

        result = ks.query_research(foods=["brown rice", "lentils"], glucose_level=180)

        # Must contain all four required fields
        self.assertIn("abstract_text", result)
        self.assertIn("journal", result)
        self.assertIn("year", result)
        self.assertIn("pubmed_id", result)

        # Must NOT be a fallback
        self.assertNotEqual(result.get("status"), "FALLBACK_TO_ADA")

        # Similarity should be computed correctly (1 - 0.10 = 0.90)
        self.assertAlmostEqual(result["similarity"], 0.90, places=2)

        # Stored text is returned verbatim — no paraphrase
        self.assertEqual(result["abstract_text"], "Dietary glycemic index interventions improve HbA1c.")

    # Tests that a low-similarity result (distance 0.60 → similarity 0.40)
    # returns the FALLBACK_TO_ADA sentinel, never the abstract.
    @patch.object(ks, "_embed_query", return_value=[0.1] * 1536)
    @patch.object(ks, "_get_chroma_collection")
    def test_fallback_low_similarity(self, mock_get_collection, _mock_embed):
        """Similarity 0.40 < 0.75 → FALLBACK_TO_ADA."""
        mock_collection = MagicMock()
        mock_collection.query.return_value = _make_chroma_result(distance=0.60)
        mock_get_collection.return_value = mock_collection

        result = ks.query_research(foods=["pizza", "soda"], glucose_level=220)

        self.assertEqual(result, {"status": "FALLBACK_TO_ADA"})

    # Tests that an empty result set from ChromaDB (no candidates at all)
    # also returns the FALLBACK_TO_ADA sentinel.
    @patch.object(ks, "_embed_query", return_value=[0.1] * 1536)
    @patch.object(ks, "_get_chroma_collection")
    def test_fallback_no_results(self, mock_get_collection, _mock_embed):
        """Empty ChromaDB result set → FALLBACK_TO_ADA."""
        mock_collection = MagicMock()
        mock_collection.query.return_value = _make_empty_chroma_result()
        mock_get_collection.return_value = mock_collection

        result = ks.query_research(foods=["mystery ingredient"], glucose_level=95)

        self.assertEqual(result, {"status": "FALLBACK_TO_ADA"})

    # Tests that passing a non-list foods argument raises ValueError
    # rather than causing a cryptic downstream crash.
    def test_invalid_foods_type_raises(self):
        """Non-list foods argument → ValueError."""
        with self.assertRaises(ValueError):
            ks.query_research(foods="brown rice", glucose_level=150)  # type: ignore

    # Tests that a negative glucose level is rejected before any API call.
    def test_negative_glucose_raises(self):
        """Negative glucose_level → ValueError."""
        with self.assertRaises(ValueError):
            ks.query_research(foods=["oats"], glucose_level=-5)

    # Tests that individual None or empty-string entries inside the foods list
    # are rejected rather than being silently interpolated as "None" in the query.
    def test_none_food_item_raises(self):
        """None item inside foods list → ValueError."""
        with self.assertRaises(ValueError):
            ks.query_research(foods=["oats", None], glucose_level=120)  # type: ignore

    def test_empty_string_food_item_raises(self):
        """Empty string inside foods list → ValueError."""
        with self.assertRaises(ValueError):
            ks.query_research(foods=["oats", "  "], glucose_level=120)

    # Tests that passing a bool as glucose_level is explicitly rejected.
    # In Python, bool is a subclass of int, so without this guard True (=1)
    # would silently pass the isinstance(glucose_level, int) check.
    def test_bool_glucose_raises(self):
        """Boolean glucose_level → ValueError (bool is a subclass of int)."""
        with self.assertRaises(ValueError):
            ks.query_research(foods=["oats"], glucose_level=True)  # type: ignore


if __name__ == "__main__":
    unittest.main()
