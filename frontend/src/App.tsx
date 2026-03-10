/**
 * App component
 * Root component that sets up React Router and the global NavBar.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import NavBar from './components/NavBar';
import DashboardPage from './pages/DashboardPage';
import ScanPage from './pages/ScanPage';
import GlucosePage from './pages/GlucosePage';
import GlycemicPage from './pages/GlycemicPage';
import RecommendationsPage from './pages/RecommendationsPage';
import ComparePage from './pages/ComparePage';

export default function App() {
  return (
    <BrowserRouter>
      {/* NavBar wraps the whole app view above the routed pages */}
      <NavBar />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/glucose" element={<GlucosePage />} />
        <Route path="/glycemic" element={<GlycemicPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/compare" element={<ComparePage />} />
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
