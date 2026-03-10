/**
 * glucoseService.ts
 * -----------------
 * TypeScript service for logging glucose readings to the EviNourish backend.
 *
 * Connects to: POST /glucose/log
 * Built to match the endpoint defined in routers/glucose.py (Phase 1).
 *
 * Usage:
 *   import { logGlucoseReading, getRecentReadings } from './glucoseService';
 *
 *   const result = await logGlucoseReading({
 *     userId: 'uuid-here',
 *     value: 142,
 *     isSimulated: false,
 *   });
 *
 *   const history = await getRecentReadings('uuid-here', 3);
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

// ---------------------------------------------------------------------------

// Types
// ---------------------------------------------------------------------------

export interface GlucoseReading {
  id: string;
  value: number;
  timestamp: string;
}

/** Payload sent to POST /glucose/log */
export interface GlucoseLogRequest {
  /** UUID of the authenticated user */
  userId: string;
  /** Blood glucose reading in mg/dL */
  value: number;
  /**
   * True when the reading comes from a simulation or demo mode rather than a
   * real CGM or fingerstick measurement. Stored in the `is_simulated` column.
   */
  isSimulated: boolean;
  /**
   * Diabetes classification selected by the user: 'Pre-Diabetic', 'Type 1', or 'Type 2'.
   */
  diabetesType?: string;
  /**
   * Optional ISO 8601 timestamp of the reading.
   * If omitted the backend defaults to the current UTC time.
   */
  timestamp?: string;
}

/** Successful response from POST /glucose/log */
export interface GlucoseLogResponse {
  status: 'success';
  message: string;
  /** UUID of the newly created glucose_readings row, populated once the
   *  backend stores the record in Supabase. */
  reading_id?: string;
}

/** Error shape returned by the FastAPI backend */
export interface ApiErrorResponse {
  detail: string;
}

/** Union result type — callers should check `success` before using `data` */
export type GlucoseLogResult =
  | { success: true; data: GlucoseLogResponse }
  | { success: false; error: string; statusCode: number };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Reads the API base URL from the Vite environment.
 *
 * Set VITE_API_BASE_URL in a .env file at the project root:
 *   VITE_API_BASE_URL=http://127.0.0.1:8000
 *
 * Vite exposes variables prefixed with VITE_ via import.meta.env.
 * Never hardcode this URL — it breaks staging vs. production builds.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

// ---------------------------------------------------------------------------
// Endpoint constants
// ---------------------------------------------------------------------------

/** Matches the prefix + route defined in routers/glucose.py */
const GLUCOSE_LOG_ENDPOINT = `${API_BASE_URL}/glucose/log`;

// ---------------------------------------------------------------------------
// Helper: buildRequestBody
// ---------------------------------------------------------------------------

/**
 * Transforms the TypeScript request shape (camelCase) into the JSON body that
 * FastAPI expects (snake_case), keeping a single source of truth for the
 * field mapping.
 */
function buildRequestBody(request: GlucoseLogRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    user_id: request.userId,
    value: request.value,
    is_simulated: request.isSimulated,
  };

  if (request.diabetesType !== undefined) {
    body['diabetes_type'] = request.diabetesType;
  }

  if (request.timestamp !== undefined) {
    body['timestamp'] = request.timestamp;
  }

  return body;
}

// ---------------------------------------------------------------------------
// Helper: parseApiError
// ---------------------------------------------------------------------------

/**
 * Extracts a human-readable error message from a failed fetch response.
 * FastAPI errors use the `{ "detail": "..." }` shape; falls back to the
 * HTTP status text if the body cannot be parsed.
 */
async function parseApiError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as ApiErrorResponse;
    return json.detail ?? response.statusText;
  } catch {
    // Response body was not valid JSON (e.g. a 502 HTML error page)
    return response.statusText || `HTTP ${response.status}`;
  }
}

// ---------------------------------------------------------------------------
// Public API: logGlucoseReading
// ---------------------------------------------------------------------------

/**
 * Logs a single glucose reading for a user via POST /glucose/log.
 *
 * Returns a discriminated union so callers are forced to handle both outcomes:
 *
 *   const result = await logGlucoseReading({ userId, value, isSimulated });
 *   if (!result.success) {
 *     console.error(result.error);
 *     return;
 *   }
 *   console.log('Logged:', result.data.reading_id);
 *
 * @param request - Glucose log payload
 * @param timeoutMs - Maximum milliseconds to wait for a response (default 10 s)
 */
export async function logGlucoseReading(
  request: GlucoseLogRequest,
  timeoutMs = 10_000,
): Promise<GlucoseLogResult> {
  // ── Input validation ────────────────────────────────────────────────────

  // Reject clearly invalid glucose values before hitting the network.
  // Physiologically plausible range: 20–600 mg/dL. Outside this range almost
  // certainly indicates a UI bug or unit mismatch (e.g. mmol/L passed as mg/dL).
  if (typeof request.value !== 'number' || !Number.isFinite(request.value)) {
    return {
      success: false,
      error: `'value' must be a finite number, got: ${request.value}`,
      statusCode: 400,
    };
  }

  if (request.value < 20 || request.value > 600) {
    return {
      success: false,
      error: `Glucose value ${request.value} mg/dL is outside the physiologically valid range (20–600).`,
      statusCode: 400,
    };
  }

  if (!request.userId || typeof request.userId !== 'string') {
    return {
      success: false,
      error: "'userId' must be a non-empty string.",
      statusCode: 400,
    };
  }

  // Validate optional ISO 8601 timestamp if provided
  if (request.timestamp !== undefined) {
    const tsDate = new Date(request.timestamp);
    if (isNaN(tsDate.getTime())) {
      return {
        success: false,
        error: `'timestamp' is not a valid ISO 8601 date string: "${request.timestamp}"`,
        statusCode: 400,
      };
    }
  }

  // ── Network call ─────────────────────────────────────────────────────────

  // AbortController lets us cancel the fetch if it exceeds timeoutMs,
  // preventing hung promises when the backend is unreachable.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GLUCOSE_LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: Add Authorization header here once JWT auth is implemented
        // 'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(buildRequestBody(request)),
      signal: controller.signal,
    });

    clearTimeout(timer);

    // ── Error responses ───────────────────────────────────────────────────

    if (!response.ok) {
      const errorMessage = await parseApiError(response);
      return {
        success: false,
        error: errorMessage,
        statusCode: response.status,
      };
    }

    // ── Success response ──────────────────────────────────────────────────

    let data: GlucoseLogResponse;
    try {
      data = (await response.json()) as GlucoseLogResponse;
    } catch {
      // Backend returned 2xx but with non-JSON body — treat as unexpected error
      return {
        success: false,
        error: 'Server returned a non-JSON success response.',
        statusCode: response.status,
      };
    }

    return { success: true, data };

  } catch (err: unknown) {
    clearTimeout(timer);

    // AbortError means the request timed out
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        success: false,
        error: `Request timed out after ${timeoutMs}ms. The server may be unreachable.`,
        statusCode: 408,
      };
    }

    // Network failure (no internet, DNS error, CORS, etc.)
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Network error: ${message}`,
      statusCode: 0, // 0 indicates no HTTP response was received
    };
  }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Public API: getRecentReadings (real Supabase query)
// ---------------------------------------------------------------------------

/**
 * Retrieves the most recent glucose readings for the user from Supabase.
 * Connects to: glucose_readings table (direct Supabase read).
 *
 * @param userId - UUID of the authenticated user
 * @param limit - Maximum number of readings to return (default 3)
 */
export async function getRecentReadings(
  userId: string,
  limit: number = 3,
): Promise<{ success: true; data: GlucoseReading[] } | { success: false; error: string }> {
  if (!userId) {
    return { success: false, error: "'userId' must be a non-empty string." };
  }
  try {
    const { data, error } = await supabase
      .from('glucose_readings')
      .select('id, value, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as GlucoseReading[] };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
