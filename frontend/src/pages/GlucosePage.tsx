/**
 * GlucosePage component
 * Professional layout wrapper around the existing GlucoseScreen component.
 * Adds page header, info banner, and centred card container.
 */
import GlucoseScreen from '../components/GlucoseScreen';

const DEMO_USER_ID = 'demo-user-001';

export default function GlucosePage() {
  return (
    <div className="font-body bg-brand-bg min-h-screen">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 py-10 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-4xl mb-3">📈</div>
          <h1 className="font-display text-4xl font-bold text-brand-charcoal mb-2">
            Glucose Tracker
          </h1>
          <p className="text-slate-500 text-lg">
            Monitor your blood glucose and track trends over time
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* ── Info banner ───────────────────────────────────────────────── */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-xl shrink-0">💡</span>
          <p className="text-sm text-blue-800 font-medium leading-relaxed">
            <span className="font-bold">Normal fasting glucose: 70–99 mg/dL</span>
            <span className="text-blue-600"> (American Diabetes Association)</span>
          </p>
        </div>

        {/* ── GlucoseScreen card ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <GlucoseScreen userId={DEMO_USER_ID} />
        </div>

      </div>
    </div>
  );
}
