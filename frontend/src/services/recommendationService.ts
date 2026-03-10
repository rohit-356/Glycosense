/**
 * recommendationService.ts
 * -------------------------
 * Fetches an AI nutrition recommendation for a given meal_id from the
 * EviNourish FastAPI backend.
 *
 * Usage:
 *   import { getRecommendation } from './recommendationService';
 *   const result = await getRecommendation(mealId);
 *   if (result.status === 'success') { ... }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Research citation included when GPT-4o sourced the recommendation. */
export interface RecommendationResearch {
  pubmed_id: string | null;
  journal: string | null;
  year: number | null;
  similarity: number | null;
}

/** Successful recommendation response from the backend. */
export interface RecommendationSuccess {
  status: 'success';
  meal_id: string;
  /** Full recommendation text with the disclaimer already appended. */
  recommendation: string;
  /** "gpt4o" when a real citation was found, "ada_fallback" otherwise. */
  source: 'gpt4o' | 'ada_fallback';
  glucose_used_mg_dl: number;
  /** Non-null only when source is "gpt4o". */
  research: RecommendationResearch | null;
}

/** Network or API error — surfaces a human-readable message. */
export interface RecommendationError {
  status: 'error';
  message: string;
}

export type RecommendationResult = RecommendationSuccess | RecommendationError;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// ---------------------------------------------------------------------------
// Public API: getRecommendation
// ---------------------------------------------------------------------------

/**
 * Calls GET /recommendations/{meal_id} and returns a typed result union.
 * The backend fetches meal data, the user's most recent glucose reading,
 * queries ChromaDB for relevant research, and generates a GPT-4o tip.
 *
 * @param mealId     - UUID of the meal returned from POST /meals/scan
 * @param timeoutMs  - Max milliseconds to wait (default 90s — GPT + ChromaDB is slow)
 */
export async function getRecommendation(
  mealId: string,
  timeoutMs = 90_000,
): Promise<RecommendationResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${API_BASE_URL}/recommendations/${encodeURIComponent(mealId)}`,
      { method: 'GET', signal: controller.signal }
    );

    clearTimeout(timer);

    // Parse JSON regardless of status so we can forward backend error details
    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      return { status: 'error', message: 'Server returned an unreadable response.' };
    }

    if (!response.ok) {
      const detail = typeof data.detail === 'string'
        ? data.detail
        : `HTTP ${response.status}`;
      return { status: 'error', message: detail };
    }

    if (data.status === 'success') {
      return data as unknown as RecommendationSuccess;
    }

    return {
      status: 'error',
      message: `Unexpected response status: "${data.status}".`,
    };

  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 'error',
        message: `Request timed out after ${timeoutMs / 1000}s. The server may be busy — please try again.`,
      };
    }

    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'error', message: `Could not reach the server. (${msg})` };
  }
}

// ---------------------------------------------------------------------------
// Helper: splitRecommendationAndDisclaimer
// ---------------------------------------------------------------------------

/**
 * The backend appends the disclaimer to the recommendation text with "\n\n".
 * This splits them so the UI can style each part independently.
 *
 * Returns { tip, disclaimer } — disclaimer is empty string if not found.
 */
export function splitRecommendationAndDisclaimer(full: string): {
  tip: string;
  disclaimer: string;
} {
  // The disclaimer always starts with the ⚠️ character
  const idx = full.lastIndexOf('\n\n⚠️');
  if (idx === -1) return { tip: full.trim(), disclaimer: '' };
  return {
    tip:        full.slice(0, idx).trim(),
    disclaimer: full.slice(idx + 2).trim(),   // skip the \n\n
  };
}
