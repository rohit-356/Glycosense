/**
 * DashboardPage component
 * Full landing dashboard with hero, stats row, feature grid,
 * and Indian food photo cards — Clinical Warmth design.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboardStats } from '../services/dashboardService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';

// ── Data ─────────────────────────────────────────────────────────────────────

// Static STATS constant removed — replaced with live Supabase data below.


const FEATURES = [
  { icon: '📷', title: 'AI Food Scanner',      desc: 'Upload a photo and identify every ingredient in seconds with Groq vision.',         path: '/scan'            },
  { icon: '📡', title: 'CGM Integration',      desc: 'Sync your continuous glucose monitor data for real-time personalised advice.',       path: '/glucose'         },
  { icon: '📚', title: 'Research-Backed Tips', desc: 'Every recommendation cites a peer-reviewed journal — never speculation.',            path: '/recommendations' },
  { icon: '📈', title: 'Glycemic Tracking',    desc: 'Visualise how each meal affects your blood glucose over time.',                      path: '/glycemic'        },
  { icon: '🔔', title: 'Personalised Alerts',  desc: 'Smart nudges based on your glucose patterns and meal history.',                      path: '/glucose'         },
  { icon: '🛡️', title: 'Medical Guardrails',   desc: 'Built-in scope lock — medication queries are always deferred to your doctor.',       path: '/recommendations' },
];

const FOODS = [
  { name: 'Dal',         gi: 22,  badge: 'bg-green-100 text-green-800',  url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800' },
  { name: 'Roti Sabzi',  gi: 62,  badge: 'bg-yellow-100 text-yellow-800', url: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800' },
  { name: 'Basmati Rice',gi: 73,  badge: 'bg-orange-100 text-orange-800', url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=800' },
  { name: 'Fresh Salad', gi: 15,  badge: 'bg-green-100 text-green-800',  url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800' },
];

// ── Weekly Trend Chart ────────────────────────────────────────────────────────

function WeeklyTrendCard() {
  const WEEKLY_MOCK = [
    { day: 'Mon', avg: 118 },
    { day: 'Tue', avg: 132 },
    { day: 'Wed', avg: 109 },
    { day: 'Thu', avg: 145 },
    { day: 'Fri', avg: 122 },
    { day: 'Sat', avg: 98  },
    { day: 'Sun', avg: 115 },
  ];

  const getColor = (avg: number) => {
    if (avg < 100) return '#22c55e'; // green-500
    if (avg <= 126) return '#eab308'; // yellow-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm col-span-1 sm:col-span-3 mt-6">
      <h3 className="font-display font-bold text-xl text-[#1A1A2E] mb-6">This Week's Glucose Trend</h3>
      
      <div className="h-64 mb-8">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={WEEKLY_MOCK} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 13, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 13, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 160]} />
            <Tooltip 
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
              {WEEKLY_MOCK.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.avg)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl font-medium text-sm text-center">
          📉 Best day: Saturday (98 mg/dL)
        </div>
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl font-medium text-sm text-center">
          📈 Worst day: Thursday (145 mg/dL)
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-xl font-medium text-sm text-center">
          📊 Weekly average: 120 mg/dL
        </div>
      </div>
    </div>
  );
}


// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState({
    todayReadings: '—',
    mealsLogged: '—',
    lastRecommendation: '—',
  });

  useEffect(() => {
    fetchDashboardStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="font-body bg-brand-bg min-h-screen">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#1B4F8A] to-[#2563EB] text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-brand-saffron font-semibold text-sm tracking-widest uppercase mb-4">
            AI-Powered Diabetes Nutrition
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight mb-6">
            Smart Nutrition for<br />Diabetes Management
          </h1>
          <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            AI-powered food analysis backed by peer-reviewed research.
            Built for Indian diets and lifestyles.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/scan"
              className="bg-brand-saffron hover:bg-orange-500 text-white font-bold px-8 py-4 rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl no-underline"
            >
              Scan Your Meal →
            </Link>
            <Link
              to="/glucose"
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold px-8 py-4 rounded-xl text-lg transition-all duration-200 no-underline"
            >
              Log Glucose Reading →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Row ─────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 -mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(() => {
            const STATS_LIVE = [
              { icon: '📊', value: stats.todayReadings,     label: "Today's Readings"    },
              { icon: '🍽️', value: stats.mealsLogged,        label: 'Meals Logged'        },
              { icon: '💡', value: stats.lastRecommendation, label: 'Last Recommendation' },
            ];
            return STATS_LIVE.map(({ icon, value, label }) => (
              <div key={label} className="bg-white rounded-2xl shadow-md p-6 flex items-center gap-4 hover:shadow-lg transition-shadow duration-200">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
                  {icon}
                </div>
                <div>
                  <div className="text-3xl font-display font-bold text-brand-blue">{value}</div>
                  <div className="text-sm text-slate-500 font-medium mt-0.5">{label}</div>
                </div>
              </div>
            ));
          })()}
          <WeeklyTrendCard />
        </div>
      </section>

      {/* ── Feature Grid ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl font-bold text-brand-charcoal mb-3">Our Expertise</h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            A complete clinical nutrition platform designed for people managing diabetes.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon, title, desc, path }) => (
            <Link
              key={title}
              to={path}
              className="no-underline bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#1B4F8A] hover:shadow-md transition-all duration-200 group cursor-pointer block"
            >
              <div className="text-3xl mb-4">{icon}</div>
              <h3 className="font-display text-lg font-bold text-[#1A1A2E] mb-2 group-hover:text-[#1B4F8A] transition-colors">
                {title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Indian Foods ──────────────────────────────────────────────────── */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-bold text-brand-charcoal mb-3">
              Built for Indian Diets
            </h2>
            <p className="text-slate-500">
              Glycemic index data for traditional Indian foods — so your advice fits your plate.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {FOODS.map(({ name, gi, badge, url }) => (
              <div
                key={name}
                className="rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 group"
              >
                <div className="h-44 overflow-hidden">
                  <img
                    src={url}
                    alt={name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-4 bg-white">
                  <p className="font-bold text-brand-charcoal text-sm mb-2">{name}</p>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge}`}>
                    GI {gi}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
