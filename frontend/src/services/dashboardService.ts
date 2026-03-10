/**
 * dashboardService.ts
 * -------------------
 * Fetches live stats for the DashboardPage stats row from Supabase.
 * Uses VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the frontend .env.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

const DEMO_USER = 'demo-user-001';

export interface DashboardStats {
  todayReadings: string;
  mealsLogged: string;
  lastRecommendation: string;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  // Today's glucose readings count
  const { count: readingCount } = await supabase
    .from('glucose_readings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', DEMO_USER)
    .gte('timestamp', todayISO);

  // Today's meals logged count (no user_id filter — user_id may be null on scan)
  const { count: mealCount } = await supabase
    .from('meals')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', todayISO);

  // Last recommendation timestamp
  const { data: recData } = await supabase
    .from('recommendations')
    .select('timestamp')
    .eq('user_id', DEMO_USER)
    .order('timestamp', { ascending: false })
    .limit(1);

  let lastRec = '—';
  if (recData && recData.length > 0) {
    const date = new Date(recData[0].timestamp);
    const hours = Math.floor((Date.now() - date.getTime()) / 3_600_000);
    lastRec =
      hours < 1
        ? 'Just now'
        : hours < 24
        ? `${hours}h ago`
        : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  return {
    todayReadings:      readingCount != null ? String(readingCount) : '—',
    mealsLogged:        mealCount    != null ? String(mealCount)    : '—',
    lastRecommendation: lastRec,
  };
}
