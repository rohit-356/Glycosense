import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const FOOD_DB: Record<string, {gi: number, calories: number, carbs: number, protein: number}> = {
  'basmati rice':    { gi: 58, calories: 130, carbs: 28, protein: 3  },
  'brown rice':      { gi: 55, calories: 112, carbs: 24, protein: 2  },
  'chapati':         { gi: 52, calories: 104, carbs: 18, protein: 3  },
  'dal tadka':       { gi: 22, calories: 105, carbs: 14, protein: 6  },
  'dal makhani':     { gi: 30, calories: 150, carbs: 16, protein: 8  },
  'idli':            { gi: 46, calories: 58,  carbs: 12, protein: 2  },
  'dosa':            { gi: 51, calories: 120, carbs: 22, protein: 3  },
  'poha':            { gi: 70, calories: 130, carbs: 24, protein: 3  },
  'upma':            { gi: 65, calories: 145, carbs: 22, protein: 4  },
  'banana':          { gi: 51, calories: 89,  carbs: 23, protein: 1  },
  'apple':           { gi: 36, calories: 52,  carbs: 14, protein: 0  },
  'mango':           { gi: 51, calories: 60,  carbs: 15, protein: 1  },
  'paneer':          { gi: 27, calories: 265, carbs: 4,  protein: 18 },
  'chicken curry':   { gi: 45, calories: 150, carbs: 5,  protein: 18 },
  'rajma':           { gi: 29, calories: 144, carbs: 26, protein: 9  },
  'chole':           { gi: 33, calories: 164, carbs: 27, protein: 9  },
  'aloo gobi':       { gi: 62, calories: 95,  carbs: 14, protein: 3  },
  'biryani':         { gi: 65, calories: 200, carbs: 28, protein: 14 },
  'naan':            { gi: 71, calories: 260, carbs: 45, protein: 8  },
  'samosa':          { gi: 65, calories: 260, carbs: 28, protein: 5  },
  'dhokla':          { gi: 35, calories: 160, carbs: 25, protein: 7  },
  'khichdi':         { gi: 50, calories: 130, carbs: 22, protein: 5  },
  'palak paneer':    { gi: 30, calories: 180, carbs: 8,  protein: 9  },
  'butter chicken':  { gi: 45, calories: 165, carbs: 7,  protein: 18 },
  'gulab jamun':     { gi: 76, calories: 175, carbs: 30, protein: 3  },
  'oats':            { gi: 55, calories: 68,  carbs: 12, protein: 2  },
  'white bread':     { gi: 75, calories: 265, carbs: 49, protein: 9  },
  'sweet potato':    { gi: 63, calories: 86,  carbs: 20, protein: 2  },
  'potato':          { gi: 78, calories: 77,  carbs: 17, protein: 2  },
  'watermelon':      { gi: 72, calories: 30,  carbs: 8,  protein: 1  },
};

const FOOD_KEYS = Object.keys(FOOD_DB);

function getGIBadge(gi: number) {
  if (gi <= 55) return { color: 'bg-green-100 text-green-800 border-green-200', label: 'Low GI' };
  if (gi <= 69) return { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Med GI' };
  return { color: 'bg-red-100 text-red-800 border-red-200', label: 'High GI' };
}

export default function ComparePage() {
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [foodA, setFoodA] = useState<string | null>(null);
  const [foodB, setFoodB] = useState<string | null>(null);

  const suggestionsA = useMemo(() => 
    searchA.trim() && !foodA ? FOOD_KEYS.filter(k => k.includes(searchA.toLowerCase())) : [],
  [searchA, foodA]);

  const suggestionsB = useMemo(() => 
    searchB.trim() && !foodB ? FOOD_KEYS.filter(k => k.includes(searchB.toLowerCase())) : [],
  [searchB, foodB]);

  const dataA = foodA ? FOOD_DB[foodA] : null;
  const dataB = foodB ? FOOD_DB[foodB] : null;

  const chartData = useMemo(() => {
    if (!dataA || !dataB) return [];
    return [
      { name: 'Calories', [foodA as string]: dataA.calories, [foodB as string]: dataB.calories },
      { name: 'Carbs (g)', [foodA as string]: dataA.carbs, [foodB as string]: dataB.carbs },
      { name: 'Protein (g)', [foodA as string]: dataA.protein, [foodB as string]: dataB.protein },
    ];
  }, [foodA, foodB, dataA, dataB]);

  return (
    <div className="font-body bg-[#F8F9FA] min-h-screen">
      <div className="bg-white border-b border-slate-200 py-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-4xl mb-3">🥗</div>
          <h1 className="font-display text-4xl font-bold text-[#1A1A2E] mb-2">
            Compare Foods
          </h1>
          <p className="text-slate-500 text-lg">
            See which option is healthier for your glucose
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        
        {/* Search row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          
          {/* Box A */}
          <div className="relative">
            <label className="block text-sm font-bold text-slate-700 mb-2">Food A</label>
            <input 
              value={searchA}
              onChange={(e) => { setSearchA(e.target.value); setFoodA(null); }}
              placeholder="e.g. brown rice"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A] bg-white"
            />
            {suggestionsA.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {suggestionsA.map(s => (
                  <li 
                    key={s} 
                    className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm capitalize"
                    onClick={() => { setFoodA(s); setSearchA(s); }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Box B */}
          <div className="relative">
            <label className="block text-sm font-bold text-slate-700 mb-2">Food B</label>
            <input 
              value={searchB}
              onChange={(e) => { setSearchB(e.target.value); setFoodB(null); }}
              placeholder="e.g. white bread"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8820C] bg-white"
            />
            {suggestionsB.length > 0 && (
              <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {suggestionsB.map(s => (
                  <li 
                    key={s} 
                    className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm capitalize"
                    onClick={() => { setFoodB(s); setSearchB(s); }}
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

        {/* Comparison Result Card */}
        {foodA && foodB && dataA && dataB && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-8 animate-fade-in">
            
            <div className="flex justify-between items-center bg-slate-50 p-6 rounded-xl border border-slate-100">
              <div className="text-center w-1/3">
                <p className="font-display font-bold text-xl capitalize mb-2">{foodA}</p>
                <div className="flex justify-center flex-col items-center gap-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getGIBadge(dataA.gi).color}`}>
                    GI {dataA.gi} · {getGIBadge(dataA.gi).label}
                  </span>
                </div>
              </div>

              <div className="text-2xl font-bold text-slate-300">VS</div>

              <div className="text-center w-1/3">
                <p className="font-display font-bold text-xl capitalize mb-2">{foodB}</p>
                <div className="flex justify-center flex-col items-center gap-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getGIBadge(dataB.gi).color}`}>
                    GI {dataB.gi} · {getGIBadge(dataB.gi).label}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 13, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }}/>
                  <Bar dataKey={foodA} fill="#1B4F8A" radius={[4, 4, 0, 0]} name={foodA} />
                  <Bar dataKey={foodB} fill="#E8820C" radius={[4, 4, 0, 0]} name={foodB} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="font-bold text-green-800 text-lg mb-1">
                  ✅ Healthier for diabetes: <span className="capitalize">{dataA.gi < dataB.gi ? foodA : foodB}</span>
                </p>
                <p className="text-green-700 text-sm">
                  Because it has a lower Glycemic Index ({dataA.gi < dataB.gi ? dataA.gi : dataB.gi} vs {dataA.gi < dataB.gi ? dataB.gi : dataA.gi}), causing a slower, safer rise in your blood sugar.
                </p>
              </div>
            </div>
            
            <div className="text-center pt-2">
              <button 
                onClick={() => { setFoodA(null); setFoodB(null); setSearchA(''); setSearchB(''); }}
                className="text-sm font-semibold text-slate-400 hover:text-slate-600 border border-slate-200 px-4 py-2 rounded-lg"
              >
                Clear comparison
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
