/**
 * RecommendationsPage component
 * Reads meal_id from URL search params, fetches an AI recommendation from
 * the backend, and renders the full result card — or an empty state if
 * no meal_id is present.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getRecommendation,
  splitRecommendationAndDisclaimer,
  type RecommendationSuccess,
} from '../services/recommendationService';

// ── Sub-component: Spinner ────────────────────────────────────────────────────

/** Simple CSS-animated spinner — no external library required. */
function Spinner() {
  return (
    <span
      className="inline-block h-5 w-5 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin"
      role="status"
      aria-label="Loading"
    />
  );
}

// ── Sub-component: RecommendationCard ─────────────────────────────────────────

/**
 * Renders the full AI recommendation card from a successful API response.
 * Includes glucose badge, food pills, tip text, citation box, and disclaimer.
 */
function RecommendationCard({ data }: { data: RecommendationSuccess }) {
  const { tip, disclaimer } = splitRecommendationAndDisclaimer(data.recommendation);

  // Extract food names from the disclaimer-stripped tip text is tricky —
  // the backend embeds them in the recommendation prose. We don't have the
  // foods list separately on this endpoint, so we show what we have.
  const isAda = data.source === 'ada_fallback';

  return (
    <div className="space-y-4">

      {/* Glucose badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="bg-blue-50 text-[#1B4F8A] text-sm font-bold px-3 py-1.5 rounded-full">
          📊 {data.glucose_used_mg_dl} mg/dL at time of scan
        </span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          isAda
            ? 'bg-slate-100 text-slate-600'
            : 'bg-green-50 text-green-700'
        }`}>
          {isAda ? 'ADA Guidelines' : 'GPT-4o · Peer-reviewed source'}
        </span>
      </div>

      {/* AI Tip card — blue left border */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex">
          <div className="w-1 bg-[#1B4F8A] shrink-0" />
          <div className="flex-1 p-6 space-y-5">

            {/* Tip heading */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                AI Nutrition Tip
              </p>
              <p className="text-[#1A1A2E] text-sm leading-relaxed whitespace-pre-line">
                {tip}
              </p>
            </div>

            {/* Citation box — only when GPT sourced */}
            {data.research && !isAda && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                <p className="text-sm text-slate-600">
                  📚{' '}
                  <span className="font-semibold">Source:</span>{' '}
                  {data.research.journal ?? 'Research Journal'}
                  {data.research.year ? `, ${data.research.year}` : ''}
                  {data.research.pubmed_id && (
                    <a
                      href={`https://pubmed.ncbi.nlm.nih.gov/${data.research.pubmed_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-[#1B4F8A] font-semibold underline hover:text-blue-800 text-xs"
                    >
                      PubMed →
                    </a>
                  )}
                </p>
                {data.research.similarity != null && (
                  <p className="text-xs text-slate-400 mt-1">
                    Research relevance score: {(data.research.similarity * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            )}

            {/* ADA citation box */}
            {isAda && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
                <p className="text-sm text-slate-600">
                  📚 <span className="font-semibold">Source:</span> ADA Standards of Care
                </p>
              </div>
            )}

            {/* Disclaimer */}
            {disclaimer && (
              <p className="text-xs text-slate-400 text-center border-t border-slate-100 pt-4">
                {disclaimer}
              </p>
            )}

          </div>
        </div>
      </div>

      {/* Scan another meal CTA */}
      <Link
        to="/scan"
        className="block w-full text-center bg-[#E8820C] hover:bg-orange-600 text-white font-bold py-3.5 rounded-xl transition-colors duration-200 shadow-sm no-underline"
      >
        Scan Another Meal →
      </Link>

    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [searchParams] = useSearchParams();
  const mealId = searchParams.get('meal_id');

  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<RecommendationSuccess | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  /** Fetch recommendation whenever mealId changes (including on first mount). */
  useEffect(() => {
    if (!mealId) return;

    let cancelled = false;

    async function fetchRecommendation() {
      setLoading(true);
      setResult(null);
      setError(null);

      const res = await getRecommendation(mealId!);

      if (cancelled) return;

      if (res.status === 'success') {
        setResult(res);
      } else {
        setError(res.message);
      }
      setLoading(false);
    }

    fetchRecommendation();

    return () => { cancelled = true; };
  }, [mealId]);

  return (
    <div className="font-body bg-[#F8F9FA] min-h-screen">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 py-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-4xl mb-3">✨</div>
          <h1 className="font-display text-4xl font-bold text-[#1A1A2E] mb-2">
            Your AI Recommendation
          </h1>
          <p className="text-slate-500 text-lg">
            Evidence-based nutrition tips tailored to your glucose level
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* ── Loading state ─────────────────────────────────────────────── */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
            <div className="flex justify-center">
              <Spinner />
            </div>
            <div className="text-4xl animate-pulse">🧠</div>
            <p className="font-bold text-[#1B4F8A] text-lg">
              Generating your personalised tip…
            </p>
            <p className="text-slate-400 text-sm">
              Searching research database and consulting GPT-4o. This may take up to 30 seconds.
            </p>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-3">
            <div className="text-3xl">⚠️</div>
            <p className="font-bold text-red-800">Something went wrong</p>
            <p className="text-red-600 text-sm">{error}</p>
            <Link
              to="/scan"
              className="inline-block mt-2 bg-[#E8820C] hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-xl transition-colors no-underline text-sm"
            >
              Try scanning again →
            </Link>
          </div>
        )}

        {/* ── Success: recommendation card ──────────────────────────────── */}
        {!loading && result && (
          <RecommendationCard data={result} />
        )}

        {/* ── Empty state (no meal_id in URL) ──────────────────────────── */}
        {!mealId && !loading && (
          <div className="space-y-8">
            {/* Empty state card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
              <div className="text-7xl mb-5">🍽️</div>
              <h2 className="font-display text-2xl font-bold text-[#1A1A2E] mb-2">
                No recommendations yet
              </h2>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                Scan a meal first to get personalised AI-powered nutrition tips
                based on your glucose level.
              </p>
              <Link
                to="/scan"
                className="inline-block bg-[#E8820C] hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md no-underline"
              >
                Scan a Meal →
              </Link>
            </div>

            {/* Preview card divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Preview — Example Recommendation
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Example preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden opacity-75">
              <div className="flex">
                <div className="w-1 bg-[#1B4F8A] shrink-0" />
                <div className="flex-1 p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-50 text-[#1B4F8A] text-sm font-bold px-3 py-1.5 rounded-full">
                      📊 130 mg/dL at time of scan
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Foods Identified</p>
                    <div className="flex flex-wrap gap-2">
                      {['Basmati Rice', 'Dal Tadka', 'Chapati'].map(f => (
                        <span key={f} className="bg-slate-100 text-slate-700 text-sm font-medium px-3 py-1 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">AI Nutrition Tip</p>
                    <p className="text-[#1A1A2E] text-sm leading-relaxed">
                      Your glucose is slightly elevated. The lentils in your dal are an excellent choice — their low GI (22) and high fibre content help slow glucose absorption. Consider reducing your rice portion and adding more dal or leafy greens.
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <p className="text-sm text-slate-600">📚 <span className="font-semibold">Source:</span> Journal of Diabetes Care, 2024</p>
                  </div>
                  <p className="text-xs text-slate-400 text-center pt-1 border-t border-slate-100">
                    ⚠️ AI-generated from recent literature. Not medical advice.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
