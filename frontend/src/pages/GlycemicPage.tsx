import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

interface Reading { id: string; value: number; timestamp: string; }

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const MOCK_READINGS = [
  { id: '1', value: 95,  timestamp: new Date(Date.now() - 1000*60*60*6).toISOString() },
  { id: '2', value: 130, timestamp: new Date(Date.now() - 1000*60*60*5).toISOString() },
  { id: '3', value: 115, timestamp: new Date(Date.now() - 1000*60*60*4).toISOString() },
  { id: '4', value: 145, timestamp: new Date(Date.now() - 1000*60*60*3).toISOString() },
  { id: '5', value: 110, timestamp: new Date(Date.now() - 1000*60*60*2).toISOString() },
  { id: '6', value: 98,  timestamp: new Date(Date.now() - 1000*60*60*1).toISOString() },
];

export default function GlycemicPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchReadings() {
    const { data, error } = await supabase
      .from('glucose_readings')
      .select('id, value, timestamp')
      .order('timestamp', { ascending: true })
      .limit(20);

    if (!error && data && data.length > 0) {
      // Real Supabase data — always use this when available
      setReadings(data as Reading[]);
    } else {
      // Supabase unavailable or empty — use mock for demo only
      setReadings(MOCK_READINGS);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchReadings();
    window.addEventListener('glucose-logged', fetchReadings);
    return () => window.removeEventListener('glucose-logged', fetchReadings);
  }, []);

  const chartData = readings.map(r => ({ time: fmt(r.timestamp), value: r.value }));
  const avg = readings.length ? Math.round(readings.reduce((s, r) => s + r.value, 0) / readings.length) : null;
  const max = readings.length ? Math.max(...readings.map(r => r.value)) : null;
  const min = readings.length ? Math.min(...readings.map(r => r.value)) : null;

  return (
    <div className="font-body bg-[#F8F9FA] min-h-screen">
      <div className="bg-white border-b border-slate-200 py-10 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-4xl mb-3">📈</div>
          <h1 className="font-display text-4xl font-bold text-[#1A1A2E] mb-2">Glycemic Tracking</h1>
          <p className="text-slate-500 text-lg">Visualise how your glucose levels change over time</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {loading && (
          <div className="text-center py-20 text-slate-400">Loading your readings…</div>
        )}

        {!loading && readings.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="text-5xl mb-4">📊</div>
            <p className="font-bold text-[#1A1A2E] text-xl mb-2">No readings yet</p>
            <p className="text-slate-500">Log your first glucose reading to see your chart.</p>
          </div>
        )}

        {!loading && readings.length > 0 && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Average', value: avg + ' mg/dL', color: 'text-[#1B4F8A]' },
                { label: 'Highest', value: max + ' mg/dL', color: 'text-red-500'   },
                { label: 'Lowest',  value: min + ' mg/dL', color: 'text-green-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-slate-500 text-sm mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <p className="font-bold text-[#1A1A2E] mb-4">Glucose Over Time</p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis domain={[60, 400]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => [v + ' mg/dL', 'Glucose']} />
                  <ReferenceLine y={100} stroke="#22C55E" strokeDasharray="4 4" label={{ value: 'Normal', fontSize: 11, fill: '#22C55E' }} />
                  <ReferenceLine y={126} stroke="#EF4444" strokeDasharray="4 4" label={{ value: 'Diabetic', fontSize: 11, fill: '#EF4444' }} />
                  <Line type="monotone" dataKey="value" stroke="#1B4F8A" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 text-xs text-slate-400 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-green-500 inline-block" />Normal ≤100
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-red-500 inline-block" />Diabetic ≥126
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
