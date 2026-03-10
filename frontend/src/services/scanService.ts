/**
 * scanService.ts
 * ---------------
 * Service layer for posting meal images to the EviNourish backend.
 * Sends multipart/form-data to POST /meals/scan and returns a typed result.
 *
 * Usage:
 *   import { scanMeal } from './scanService';
 *   const result = await scanMeal(file);
 *   if (result.status === 'success') { ... }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single food item returned by the backend after USDA enrichment. */
export interface ScannedFood {
  food_name: string;
  confidence_score: number;
  portion_size_grams: number | null;
  glycemic_index: number | null;
  nutrition_data_available: boolean;
  nutrition: {
    usda_food_id: number | null;
    usda_description: string | null;
    calories: number | null;
    carbohydrates_g: number | null;
    protein_g: number | null;
    /** USDA does not provide GI — will be null until a GI DB is integrated */
    glycemic_index: number | null;
  } | null;
}

/** Successful scan response from the backend */
export interface ScanSuccessResult {
  status: 'success';
  meal_id: string | null;
  foods_identified: number;
  foods: ScannedFood[];
}

/** Backend returned low_confidence — food couldn't be clearly identified */
export interface ScanLowConfidenceResult {
  status: 'low_confidence';
  message: string;
}

/** Backend returned out_of_scope — image is not food */
export interface ScanOutOfScopeResult {
  status: 'out_of_scope';
  message: string;
}

/** Network or HTTP error; we surface a friendly message */
export interface ScanErrorResult {
  status: 'error';
  message: string;
}

export type ScanResult =
  | ScanSuccessResult
  | ScanLowConfidenceResult
  | ScanOutOfScopeResult
  | ScanErrorResult;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Base URL of the FastAPI backend. Never change to an env variable without
 *  re-testing the multipart boundary handling on the server. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// ---------------------------------------------------------------------------
// Public API: scanMeal
// ---------------------------------------------------------------------------

/**
 * Sends an image file to POST /meals/scan as multipart/form-data.
 * Returns a typed ScanResult union — callers must check `status`.
 *
 * @param imageFile  - The image File object selected by the user
 * @param userId     - Optional authenticated user UUID
 * @param timeoutMs  - Max milliseconds to wait (default 60s — GPT vision is slow)
 */
export async function scanMeal(
  imageFile: File,
  userId?: string,
  timeoutMs = 60_000,
): Promise<ScanResult> {
  // Build the multipart form body — do NOT set Content-Type manually;
  // the browser must set it with the correct boundary string automatically.
  const form = new FormData();
  form.append('image', imageFile);
  if (userId) form.append('user_id', userId);

  // Use AbortController so we can enforce a timeout on the fetch.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/meals/scan`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
      // Do NOT set Content-Type — browser handles multipart boundary automatically
    });

    clearTimeout(timer);

    // Parse JSON body regardless of status code so we can surface backend errors
    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      return {
        status: 'error',
        message: 'Server returned an unreadable response. Please try again.',
      };
    }

    // Non-2xx HTTP responses
    if (!response.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : `HTTP ${response.status}`;
      return { status: 'error', message: detail };
    }

    // Typed status routing — forward backend statuses directly
    const backendStatus = data.status as string;

    if (backendStatus === 'success') {
      return data as unknown as ScanSuccessResult;
    }
    if (backendStatus === 'low_confidence') {
      return data as unknown as ScanLowConfidenceResult;
    }
    if (backendStatus === 'out_of_scope') {
      return data as unknown as ScanOutOfScopeResult;
    }

    // Unknown status — treat as error
    return {
      status: 'error',
      message: `Unexpected response from server (status: "${backendStatus}"). Please try again.`,
    };

  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 'error',
        message: `Analysis timed out after ${timeoutMs / 1000}s. The server may be busy — please try again.`,
      };
    }

    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      message: `Could not analyze this image. Please try again. (${msg})`,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API: scanMealByName
// ---------------------------------------------------------------------------

/**
 * Calls GET /meals/scan-by-name?food_name={foodName}.
 * Used by the manual entry flow when Groq returns low_confidence and the
 * user types the food name themselves. Bypasses vision entirely.
 */
export async function scanMealByName(
  foodName: string,
  timeoutMs = 30_000,
): Promise<ScanResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${API_BASE_URL}/meals/scan-by-name?food_name=${encodeURIComponent(foodName)}`;
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);

    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      return { status: 'error', message: 'Server returned an unreadable response.' };
    }

    if (!response.ok) {
      const detail = typeof data.detail === 'string' ? data.detail : `HTTP ${response.status}`;
      return { status: 'error', message: detail };
    }

    if (data.status === 'success') return data as unknown as ScanResult;

    return { status: 'error', message: `Unexpected response status: "${data.status}".` };

  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      return { status: 'error', message: `Request timed out after ${timeoutMs / 1000}s.` };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'error', message: `Could not reach the server. (${msg})` };
  }
}


// ---------------------------------------------------------------------------
// Helper: giColour
// ---------------------------------------------------------------------------

/**
 * Returns Tailwind colour classes for a glycemic index value.
 *   GI < 55  → green (low)
 *   GI 55-70 → yellow (medium)
 *   GI > 70  → red (high)
 *   null     → slate grey (unknown)
 */
export function giColour(gi: number | null): { bg: string; text: string } {
  if (gi === null) return { bg: 'bg-slate-100', text: 'text-slate-600' };
  if (gi < 55)    return { bg: 'bg-green-100',  text: 'text-green-800'  };
  if (gi <= 70)   return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
  return               { bg: 'bg-red-100',    text: 'text-red-800'    };
}
