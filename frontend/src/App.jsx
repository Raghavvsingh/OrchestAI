import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import ReportView from './components/ReportView';

// OrchestAI Logo Component
const OrchestAILogo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="8" r="4" fill="#1f1f1f"/>
    <circle cx="8" cy="24" r="4" fill="#1f1f1f"/>
    <circle cx="24" cy="24" r="4" fill="#1f1f1f"/>
    <path d="M16 12V16M16 16L10 21M16 16L22 21" stroke="#1f1f1f" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

function AppContent() {
  const [currentRunId, setCurrentRunId] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleAnalysisStarted = useCallback((runId) => {
    setCurrentRunId(runId);
    navigate(`/dashboard/${runId}`);
  }, [navigate]);

  const isLandingPage = location.pathname === '/';
  const isReportPage = location.pathname.startsWith('/report/');

  // Report page handles its own full layout
  if (isReportPage) {
    return (
      <div className="min-h-screen bg-[#f8f9fb]">
        {/* Header for report page */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div 
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-70 transition-opacity"
              onClick={() => navigate('/')}
            >
              <OrchestAILogo />
              <span className="text-lg font-semibold text-gray-900">OrchestAI</span>
            </div>
          </div>
        </header>
        <Routes>
          <Route path="/report/:runId" element={<ReportView />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isLandingPage ? '' : 'bg-[#f7f7f7]'}`}>
      {/* Minimal header for non-landing pages */}
      {!isLandingPage && (
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center gap-2.5 cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => navigate('/')}
              >
                <OrchestAILogo />
                <span className="text-lg font-semibold text-gray-900">OrchestAI</span>
              </div>
              <span className="text-sm text-gray-500 font-medium">
                Multi-Agent Competitive Analysis
              </span>
            </div>
          </div>
        </header>
      )}

      {isLandingPage ? (
        <Routes>
          <Route 
            path="/" 
            element={<LandingPage onAnalysisStarted={handleAnalysisStarted} />} 
          />
        </Routes>
      ) : (
        <main className="max-w-5xl mx-auto px-6 py-10">
          <Routes>
            <Route 
              path="/dashboard/:runId" 
              element={<Dashboard />} 
            />
          </Routes>
        </main>
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
