/**
 * ScanPage component
 * Food scanner page with drag-and-drop upload, live analysis via the FastAPI
 * backend, and full result/error/fallback handling.
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { scanMeal, scanMealByName, giColour, type ScanResult, type ScannedFood } from '../services/scanService';

// ── Example cards shown before any scan ───────────────────────────────────────

const EXAMPLES = [
  { name: 'Basmati Rice', weight: '150g', gi: 58, carbs: '35g' },
  { name: 'Dal Tadka',    weight: '200g', gi: 22, carbs: '18g' },
  { name: 'Chapati',      weight: '45g',  gi: 62, carbs: '25g' },
];

// ── Sub-component: FoodCard ────────────────────────────────────────────────────

/** Renders a single identified food with its nutrition details and GI badge. */
function FoodCard({ food }: { food: ScannedFood }) {
  const gi = food.glycemic_index ?? food.nutrition?.glycemic_index ?? null;
  const { bg, text } = giColour(gi);
  const calories = food.nutrition?.calories;
  const carbs    = food.nutrition?.carbohydrates_g;
  const portion  = food.portion_size_grams;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-4 hover:shadow-md transition-shadow duration-200">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[#1A1A2E] text-base leading-snug">{food.food_name}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-sm text-slate-500">
          {portion   != null && <span>{portion}g</span>}
          {calories  != null && <span>· {Math.round(calories)} kcal</span>}
          {carbs     != null && <span>· Carbs {Math.round(carbs)}g</span>}
          {!food.nutrition_data_available && (
            <span className="text-slate-400 italic">· No USDA data</span>
          )}
        </div>
      </div>
      <span className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-full ${bg} ${text}`}>
        {gi !== null ? `GI ${gi}` : 'GI —'}
      </span>
    </div>
  );
}

// ── Sub-component: Spinner ────────────────────────────────────────────────────

/** Simple CSS spinner — no extra library required. */
function Spinner() {
  return (
    <span
      className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"
      role="status"
      aria-label="Loading"
    />
  );
}

// ── Sub-component: GITipCard ───────────────────────────────────────────────────

type DiabetesType = 'Pre-Diabetic' | 'Type 1' | 'Type 2';
type GILevel = 'low' | 'medium' | 'high';

interface GITip {
  emoji: string;
  label: string;
  bg: string;
  border: string;
  text: string;
  tip: string;
}

const GI_TIPS: Record<DiabetesType, Record<GILevel, GITip>> = {
  'Pre-Diabetic': {
    low:    { emoji: '🟢', label: 'Low GI',    bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  tip: 'Safe to eat. Low GI foods are ideal for managing blood sugar.' },
    medium: { emoji: '🟡', label: 'Medium GI', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', tip: 'Eat in moderation. Pair with protein or fibre to slow absorption.' },
    high:   { emoji: '🔴', label: 'High GI',   bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    tip: 'Avoid or reduce portion. High GI foods spike blood sugar quickly.' },
  },
  'Type 1': {
    low:    { emoji: '🟢', label: 'Low GI',    bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  tip: 'Good choice. Predictable glucose response helps with insulin dosing.' },
    medium: { emoji: '🟡', label: 'Medium GI', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', tip: 'Monitor closely. May need insulin adjustment after this meal.' },
    high:   { emoji: '🔴', label: 'High GI',   bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    tip: 'High GI — coordinate with your insulin plan before eating.' },
  },
  'Type 2': {
    low:    { emoji: '🟢', label: 'Low GI',    bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  tip: 'Excellent choice. Low GI foods improve insulin sensitivity over time.' },
    medium: { emoji: '🟡', label: 'Medium GI', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', tip: 'Moderate option. Keep portions controlled and pair with vegetables.' },
    high:   { emoji: '🔴', label: 'High GI',   bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    tip: 'Not recommended. High GI foods worsen insulin resistance.' },
  },
};

function getGILevel(avg: number): GILevel {
  if (avg < 55)  return 'low';
  if (avg <= 70) return 'medium';
  return 'high';
}

/** Reads diabetesType from localStorage + avg GI from foods, renders a coloured tip. */
function GITipCard({ foods, isHighRisk = false, isSugaryDrink = false }: { foods: ScannedFood[]; isHighRisk?: boolean; isSugaryDrink?: boolean }) {
  const rawType = localStorage.getItem('diabetes_type') ?? 'Type 2';
  const diabetesType: DiabetesType =
    rawType === 'Pre-Diabetic' || rawType === 'Type 1' || rawType === 'Type 2'
      ? rawType
      : 'Type 2';

  // Collect non-null GI values across all identified foods
  const giValues = foods
    .map((f) => f.nutrition?.glycemic_index ?? null)
    .filter((g): g is number => g !== null);

  if (giValues.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
        <p className="text-slate-400 text-sm italic">GI data unavailable for these foods</p>
      </div>
    );
  }

  const avg = Math.round(giValues.reduce((a, b) => a + b, 0) / giValues.length);
  const level = getGILevel(avg);
  const { emoji, label, bg, border, text, tip } = GI_TIPS[diabetesType][level];

  // Override with high-risk warning for sugary drinks or high risk meals
  if (isSugaryDrink || isHighRisk) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-red-800">
            ⚠️ Glucose Warning · {diabetesType}
          </span>
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-white border border-red-200 text-red-800">
            🔴 Avg GI {avg} · {label}
          </span>
        </div>
        <p className="text-sm font-medium leading-relaxed text-red-800">
          ⚠️ This drink contains high sugar and will rapidly spike your blood glucose. Diabetics should avoid sugary drinks entirely. Choose water, coconut water, or unsweetened green tea instead.
        </p>
      </div>
    );
  }

  return (
    <div className={`${bg} border ${border} rounded-2xl p-5 space-y-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-widest ${text}`}>
          GI Tip · {diabetesType}
        </span>
        <span className={`text-sm font-bold px-3 py-1 rounded-full bg-white border ${border} ${text}`}>
          {emoji} Avg GI {avg} · {label}
        </span>
      </div>
      <p className={`text-sm font-medium leading-relaxed ${text}`}>{tip}</p>
    </div>
  );
}

function MealRiskScore({ foods }: { foods: ScannedFood[] }) {
  const giValues = foods
    .map(f => f.glycemic_index ?? f.nutrition?.glycemic_index)
    .filter((gi): gi is number => gi != null);
  
  if (giValues.length === 0) return null;

  const avgGI = giValues.reduce((a, b) => a + b, 0) / giValues.length;
  const glucose = parseInt(localStorage.getItem('last_glucose') || '100', 10);
  
  let riskScore = Math.round(((avgGI * 0.6) + (glucose * 0.4)) / 3);

  // Flag sugary drinks — always high risk for diabetics
  const SUGARY_DRINKS = ['coca cola', 'coke', 'pepsi', 'sprite', 'fanta', 'mountain dew', '7up', 'limca', 'thums up', 'red bull', 'energy drink', 'lemonade', 'sugarcane juice'];

  const isSugaryDrink = foods.some(f => 
    SUGARY_DRINKS.some(d => f.food_name?.toLowerCase().includes(d))
  );

  // Sugary drinks are always high risk for diabetics — override score
  if (isSugaryDrink) riskScore = Math.max(riskScore, 75);

  // High glucose makes any meal riskier
  if (glucose > 140) riskScore = Math.min(100, riskScore + 20);
  if (glucose > 180) riskScore = Math.min(100, riskScore + 15);

  let message = '🟢 Low Risk — Good choice for your current glucose';
  let bg = 'bg-green-50';
  let border = 'border-green-200';
  let bar = 'bg-green-500';

  if (riskScore >= 45 && riskScore <= 65) {
    message = '🟡 Moderate Risk — Watch your portions carefully';
    bg = 'bg-yellow-50';
    border = 'border-yellow-200';
    bar = 'bg-yellow-500';
  } else if (riskScore > 65) {
    message = '🔴 High Risk — This will likely spike your glucose. Avoid or limit severely.';
    bg = 'bg-red-50';
    border = 'border-red-200';
    bar = 'bg-red-500';
  }

  const cappedScore = Math.min(riskScore, 100);

  return (
    <div className={`mt-2 ${bg} border ${border} rounded-2xl p-6 space-y-4 shadow-sm`}>
      <div className="flex justify-between items-center">
        <h3 className="font-display font-bold text-slate-800 text-lg">Meal Risk Score</h3>
        <span className="font-display font-bold text-3xl text-slate-900">{riskScore}<span className="text-xl text-slate-400">/100</span></span>
      </div>
      
      <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${bar} transition-all duration-1000 ease-out`} 
          style={{ width: `${cappedScore}%` }} 
        />
      </div>
      
      <p className="font-semibold text-slate-700 text-sm leading-tight">
        {message}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ScanPage() {
  const navigate = useNavigate();

  // Upload / preview state
  const [dragging,    setDragging]    = useState(false);
  const [preview,     setPreview]     = useState<string | null>(null);
  const [selectedFile,setSelectedFile]= useState<File | null>(null);

  // Analysis state
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<ScanResult | null>(null);
  const [manualFood,setManualFood] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  /** Accept a File, show preview, clear any previous result. */
  function handleFile(file: File | null) {
    if (!file || !file.type.startsWith('image/')) return;
    setSelectedFile(file);
    setResult(null);
    setManualFood('');
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  /** Submit the selected image to the backend for analysis. */
  async function handleAnalyse() {
    if (!selectedFile) return;
    setLoading(true);
    setResult(null);
    const res = await scanMeal(selectedFile, 'demo-user-001');
    setLoading(false);
    setResult(res);
  }

  /** Navigate to /recommendations with the meal_id query param. */
  function goToRecommendations(mealId: string | null) {
    const path = mealId
      ? `/recommendations?meal_id=${encodeURIComponent(mealId)}`
      : '/recommendations';
    navigate(path);
  }

  /** Fetch nutrition for a manually typed food name without vision. */
  async function handleManualSubmit() {
    if (!manualFood.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await scanMealByName(manualFood.trim());
    setLoading(false);
    setResult(res);
  }

  // ── Derived display values ─────────────────────────────────────────────────
  const showExamples = !preview && result === null;
  const showAnalyseBtn = !!preview && !loading && (result === null || result.status === 'error');

  return (
    <div className="font-body bg-[#F8F9FA] min-h-screen">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 py-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-4xl mb-3">📷</div>
          <h1 className="font-display text-4xl font-bold text-[#1A1A2E] mb-2">
            Scan Your Meal
          </h1>
          <p className="text-slate-500 text-lg">
            Upload a photo and get instant AI analysis
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* ── Upload zone ─────────────────────────────────────────────────── */}
        <div
          onClick={() => !loading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`relative flex flex-col items-center justify-center w-full h-64 rounded-2xl border-2 border-dashed transition-all duration-200 ${
            loading
              ? 'border-slate-300 bg-slate-50 cursor-default'
              : dragging
              ? 'border-[#1B4F8A] bg-blue-50 scale-[1.01] cursor-pointer'
              : preview
              ? 'border-[#E8820C] bg-orange-50 cursor-pointer'
              : 'border-slate-300 bg-white hover:border-[#1B4F8A] hover:bg-blue-50 cursor-pointer'
          }`}
        >
          {loading ? (
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">🔍</div>
              <p className="font-semibold text-[#1B4F8A] text-lg">Analyzing your meal…</p>
              <p className="text-slate-400 text-sm mt-1">This may take up to 30 seconds</p>
            </div>
          ) : preview ? (
            <img src={preview} alt="Meal preview" className="h-full w-full object-contain rounded-2xl p-2" />
          ) : (
            <>
              <div className="text-5xl mb-3">📷</div>
              <p className="font-semibold text-[#1B4F8A] text-lg">Drop your meal photo here</p>
              <p className="text-slate-400 text-sm mt-1">or click to browse</p>
              <p className="text-xs text-slate-400 mt-3">Accepts JPG, PNG, WEBP</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* ── Analyse button ───────────────────────────────────────────────── */}
        {showAnalyseBtn && (
          <button
            onClick={handleAnalyse}
            className="w-full py-3.5 bg-[#E8820C] hover:bg-orange-600 text-white font-bold rounded-xl transition-colors duration-200 shadow-sm flex items-center justify-center gap-2"
          >
            Analyse This Meal →
          </button>
        )}

        {loading && (
          <div className="w-full py-3.5 bg-[#1B4F8A] text-white font-bold rounded-xl flex items-center justify-center gap-3 opacity-80">
            <Spinner /> Analyzing…
          </div>
        )}

        {/* ── Result rendering ─────────────────────────────────────────────── */}

        {/* SUCCESS */}
        {result?.status === 'success' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#1A1A2E] text-lg">
                {result.foods_identified} food{result.foods_identified !== 1 ? 's' : ''} identified
              </p>
              <button
                onClick={() => { setPreview(null); setSelectedFile(null); setResult(null); }}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                Scan again
              </button>
            </div>
            {result.foods.map((food) => (
              <FoodCard key={food.food_name} food={food} />
            ))}
            <MealRiskScore foods={result.foods} />
            <GITipCard 
              foods={result.foods}
              isSugaryDrink={(() => {
                const SUGARY_DRINKS = ['coca cola', 'coke', 'pepsi', 'sprite', 'fanta', 'mountain dew', '7up', 'limca', 'thums up', 'red bull', 'energy drink', 'lemonade', 'sugarcane juice'];
                return result.foods.some(f => SUGARY_DRINKS.some(d => f.food_name?.toLowerCase().includes(d)));
              })()}
              isHighRisk={(() => {
                const gis = result.foods.map(f => f.glycemic_index ?? f.nutrition?.glycemic_index).filter((gi): gi is number => gi != null);
                if (gis.length === 0) return false;
                const avgGI = gis.reduce((a, b) => a + b, 0) / gis.length;
                const glucose = parseInt(localStorage.getItem('last_glucose') || '100', 10);
                let score = Math.round(((avgGI * 0.6) + (glucose * 0.4)) / 3);
                if (glucose > 140) score = Math.min(100, score + 20);
                if (glucose > 180) score = Math.min(100, score + 15);
                return score > 65;
              })()}
            />
            <button
              onClick={() => goToRecommendations(result.meal_id)}
              className="w-full py-3.5 bg-[#1B4F8A] hover:bg-blue-900 text-white font-bold rounded-xl transition-colors duration-200 shadow-sm mt-2"
            >
              Get AI Recommendation →
            </button>
          </div>
        )}

        {/* LOW CONFIDENCE */}
        {result?.status === 'low_confidence' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 space-y-4">
            <div className="text-3xl text-center">🤔</div>
            <p className="font-bold text-yellow-800 text-center">
              We couldn't clearly identify this food.
            </p>
            <p className="text-yellow-700 text-sm text-center">
              Please type the food name manually.
            </p>
            <input
              type="text"
              value={manualFood}
              onChange={(e) => setManualFood(e.target.value)}
              placeholder="e.g. Dal Makhani, Paneer Tikka…"
              className="w-full border border-yellow-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
              autoFocus
            />
            <button
              disabled={!manualFood.trim()}
              onClick={handleManualSubmit}
              className="w-full py-3 bg-[#E8820C] hover:bg-orange-600 disabled:bg-orange-200 text-white font-bold rounded-xl transition-colors duration-200"
            >
              Continue with "{manualFood || '…'}" →
            </button>
          </div>
        )}

        {/* OUT OF SCOPE */}
        {result?.status === 'out_of_scope' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
            <div className="text-3xl">🚫</div>
            <p className="font-bold text-red-800">
              I can only analyze food items.
            </p>
            <p className="text-red-600 text-sm">
              Please consult a doctor for medical queries.
            </p>
            <button
              onClick={() => { setPreview(null); setSelectedFile(null); setResult(null); }}
              className="mt-2 text-sm font-semibold text-slate-500 hover:text-slate-700 underline"
            >
              Upload a different photo
            </button>
          </div>
        )}

        {/* ERROR */}
        {result?.status === 'error' && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-2">
            <p className="text-slate-600 font-semibold text-sm">⚠️ {result.message}</p>
            <button
              onClick={handleAnalyse}
              className="text-sm font-bold text-[#1B4F8A] hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Example analysis (only shown before any upload) ──────────────── */}
        {showExamples && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Example Analysis
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="space-y-3">
              {EXAMPLES.map(({ name, weight, gi, carbs }) => {
                const { bg, text } = giColour(gi);
                return (
                  <div
                    key={name}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-shadow duration-200"
                  >
                    <div>
                      <p className="font-bold text-[#1A1A2E]">{name}</p>
                      <p className="text-sm text-slate-500 mt-0.5">{weight} · Carbs: {carbs}</p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${bg} ${text}`}>
                      GI {gi}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 text-center mt-3">
              Scan a real meal to see your personalised results
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
