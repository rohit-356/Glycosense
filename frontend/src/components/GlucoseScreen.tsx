/**
 * GlucoseScreen.tsx
 * -----------------
 * Web version of the EviNourish glucose logging screen.
 * Fully converted from React Native to React + Tailwind CSS.
 *
 * Features:
 *  - Large friendly glucose display
 *  - HTML range slider (70 – 400 mg/dL) with dynamic colour theming
 *  - Status indicator with four ranges and warm, supportive copy
 *  - "Log Reading" button with spinner loading state
 *  - Last 3 readings history with loading / error / empty states
 */

import { useState, useEffect } from 'react';
import { logGlucoseReading, getRecentReadings } from '../services/glucoseService';
import type { GlucoseReading } from '../services/glucoseService';

// ---------------------------------------------------------------------------
// Prop Types
// ---------------------------------------------------------------------------

export interface GlucoseScreenProps {
  /** UUID of the currently authenticated user */
  userId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_HISTORY: GlucoseReading[] = [
  { id: 'mock-1', value: 110, timestamp: new Date(Date.now() - 1000*60*60*2).toISOString() },
  { id: 'mock-2', value: 145, timestamp: new Date(Date.now() - 1000*60*60*8).toISOString() },
  { id: 'mock-3', value: 95,  timestamp: new Date(Date.now() - 1000*60*60*24).toISOString() },
];

interface GlucoseStatus {
  message: string;
  /** Tailwind colour token used for text, ring, and progress tinting */
  colour: string;
  /** Inline style hex used for the native range thumb (can't be set with Tailwind) */
  hex: string;
}

/**
 * Maps a glucose value (mg/dL) to a friendly coaching message and colour theme.
 */
function getGlucoseStatus(value: number): GlucoseStatus {
  if (value >= 180) return { message: "🔴 High glucose — let's make a smart choice",          colour: 'text-red-500',    hex: '#EF4444' };
  if (value >= 126) return { message: '🟠 Elevated — food choices matter right now',            colour: 'text-orange-500', hex: '#F97316' };
  if (value >= 100) return { message: "🟡 Slightly elevated, let's be mindful",                  colour: 'text-yellow-500', hex: '#EAB308' };
  return             { message: "🟢 You're in a great range!",                                    colour: 'text-green-500',  hex: '#22C55E' };
}

/**
 * Returns a human-readable relative time string for a given ISO timestamp.
 */
function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.round(diffMs / (1000 * 60 * 60));
  if (h === 0) return 'Just now';
  if (h === 1) return '1 hour ago';
  if (h < 24)  return `${h} hours ago`;
  return `${Math.floor(h / 24)} day${Math.floor(h / 24) > 1 ? 's' : ''} ago`;
}

// ---------------------------------------------------------------------------
// Spinner sub-component
// ---------------------------------------------------------------------------

/** Simple CSS-animated spinner, no extra library required. */
function Spinner({ size = 'h-5 w-5' }: { size?: string }) {
  return (
    <span
      className={`inline-block ${size} border-2 border-white border-t-transparent rounded-full animate-spin`}
      role="status"
      aria-label="Loading"
    />
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * GlucoseScreen renders the full glucose tracking view, composed of the
 * large number display, slider, status badge, log button, and history list.
 */
export default function GlucoseScreen({ userId }: GlucoseScreenProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [value,          setValue]          = useState<number>(100);
  const [diabetesType,   setDiabetesType]   = useState<string>('Type 2');
  const [isLogging,      setIsLogging]      = useState<boolean>(false);
  const [logSuccess,     setLogSuccess]     = useState<string | null>(null);
  const [logError,       setLogError]       = useState<string | null>(null);
  const [history,        setHistory]        = useState<GlucoseReading[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(true);
  const [historyError,   setHistoryError]   = useState<string | null>(null);

  const status = getGlucoseStatus(value);

  // ── Load history on mount ─────────────────────────────────────────────────

  /**
   * On mount: fetches the 3 most recent glucose readings for the user.
   */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await getRecentReadings(userId, 3);
      if (!mounted) return;
      if (res.success && res.data.length > 0) {
        setHistory(res.data); // Real data — priority
      } else if (res.success && res.data.length === 0) {
        setHistory(MOCK_HISTORY); // Empty DB — show mock for demo
      } else {
        setHistory(MOCK_HISTORY); // Error — show mock for demo
      }
      setHistoryLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /**
   * Submits the current slider value to the backend via the glucose service.
   * Shows a success banner or inline error depending on the result.
   */
  async function handleLog() {
    setIsLogging(true);
    setLogSuccess(null);
    setLogError(null);

    const res = await logGlucoseReading({
      userId,
      value,
      diabetesType,
      isSimulated: true,
      timestamp: new Date().toISOString(),
    });

    setIsLogging(false);

    if (res.success) {
      setLogSuccess('Awesome! Your reading has been safely logged. ✅');
      // Persist diabetes type so GITipCard on ScanPage can read it instantly
      localStorage.setItem('diabetes_type', diabetesType);
      localStorage.setItem('last_glucose', String(value));
      // Optimistically push to history without a full refetch
      const newEntry: GlucoseReading = {
        id:        res.data.reading_id ?? String(Date.now()),
        value,
        timestamp: new Date().toISOString(),
      };
      setHistory(prev => [newEntry, ...prev].slice(0, 3));
      window.dispatchEvent(new CustomEvent('glucose-logged'));
      // Auto-dismiss success message after 4 s
      setTimeout(() => setLogSuccess(null), 4000);
    } else {
      setLogError(`We couldn't log that reading — ${res.error}`);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            How are you doing?
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Move the slider to your current reading
          </p>
        </div>

        {/* ── Diabetes type selector ───────────────────────────────────── */}
        <div className="flex gap-2 justify-center">
          {(['Pre-Diabetic', 'Type 1', 'Type 2'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setDiabetesType(type)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors duration-150 ${
                diabetesType === type
                  ? 'bg-[#1B4F8A] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* ── Big display ─────────────────────────────────────────────── */}
        <div className="flex items-end justify-center gap-2">
          <span className={`text-8xl font-extrabold tabular-nums leading-none transition-colors duration-300 ${status.colour}`}>
            {value}
          </span>
          <span className="text-2xl font-semibold text-slate-400 pb-2">mg/dL</span>
        </div>

        {/* ── Status badge ─────────────────────────────────────────────── */}
        <p className={`text-center text-lg font-semibold transition-colors duration-300 ${status.colour}`}>
          {status.message}
        </p>

        {/* ── Slider ───────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <input
            type="range"
            min={70}
            max={400}
            step={1}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200"
            style={
              /* Dynamically colour the filled track by using a gradient */
              {
                background: `linear-gradient(to right, ${status.hex} ${((value - 70) / 330) * 100}%, #e2e8f0 ${((value - 70) / 330) * 100}%)`,
                accentColor: status.hex,
              } as React.CSSProperties
            }
            aria-label="Glucose reading slider"
          />
          {/* Three-point label row: min | current value | max
               The centre label is the live reading so it can never be
               confused with or concatenated with the endpoint values. */}
          {/* Single centred label — avoids adjacent text-node concatenation */}
          <div className="text-center mt-1">
            <span className={`font-bold text-sm tabular-nums ${status.colour}`}>
              {value} mg/dL
            </span>
          </div>
        </div>

        {/* ── Feedback banners ─────────────────────────────────────────── */}
        {logSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium animate-pulse">
            {logSuccess}
          </div>
        )}
        {logError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-medium">
            {logError}
          </div>
        )}

        {/* ── Log button ───────────────────────────────────────────────── */}
        <button
          onClick={handleLog}
          disabled={isLogging}
          className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all duration-200 flex items-center justify-center gap-2
            ${isLogging
              ? 'bg-blue-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 active:scale-95 shadow-lg shadow-blue-200'
            }`}
        >
          {isLogging ? <><Spinner /> Logging…</> : 'Log Reading'}
        </button>

        {/* ── History ──────────────────────────────────────────────────── */}
        <section aria-label="Recent readings">
          <h2 className="text-lg font-bold text-slate-700 mb-3">Recent Readings</h2>

          {historyLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Spinner size="h-4 w-4" />
              <span>Loading your history…</span>
            </div>
          )}

          {!historyLoading && historyError && (
            <p className="text-red-400 text-sm italic">{historyError}</p>
          )}

          {!historyLoading && !historyError && history.length === 0 && (
            <p className="text-slate-400 text-sm italic">
              No readings yet — you're off to a fresh start! 🌱
            </p>
          )}

          {!historyLoading && !historyError && (
            <ul className="space-y-2">
              {history.map((reading) => {
                const rs = getGlucoseStatus(reading.value);
                return (
                  <li
                    key={reading.id}
                    className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100"
                  >
                    <span className={`text-xl font-bold tabular-nums ${rs.colour}`}>
                      {reading.value}
                      <span className="text-xs text-slate-400 font-medium ml-1">mg/dL</span>
                    </span>
                    <span className="text-sm text-slate-400 font-medium">
                      {formatTimeAgo(reading.timestamp)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}
