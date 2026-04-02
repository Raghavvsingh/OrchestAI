import React, { useState } from 'react';
import { Search, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { analysisApi } from '../services/api';

const examples = [
  { text: "Compare Notion vs Obsidian", type: "comparison" },
  { text: "Analyze Swiggy", type: "single_entity" },
  { text: "Analyze startup idea: AI fitness app for students", type: "startup_idea" },
];

function InputPage({ onAnalysisStarted }) {
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!goal.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await analysisApi.startAnalysis(goal.trim());
      onAnalysisStarted(response.run_id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start analysis');
      setLoading(false);
    }
  };

  const handleExampleClick = (example) => {
    setGoal(example.text);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="w-8 h-8 text-blue-400" />
          <h2 className="text-3xl font-bold text-white">
            What would you like to analyze?
          </h2>
        </div>
        <p className="text-slate-400 max-w-xl">
          Enter a competitive analysis goal and our multi-agent system will
          research, analyze, and generate consultancy-grade insights.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g., Compare Notion vs Obsidian"
            className="w-full pl-12 pr-24 py-4 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !goal.trim()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-white font-medium flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Analyze
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}
      </form>

      <div className="mt-8">
        <p className="text-slate-500 text-sm mb-3">Try an example:</p>
        <div className="flex flex-wrap gap-3 justify-center">
          {examples.map((example, idx) => (
            <button
              key={idx}
              onClick={() => handleExampleClick(example)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 text-sm transition-colors"
            >
              {example.text}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
          <div className="text-2xl mb-3">🎯</div>
          <h3 className="text-lg font-semibold text-white mb-2">Dynamic Planning</h3>
          <p className="text-slate-400 text-sm">
            AI planner creates a custom task DAG based on your specific goal.
          </p>
        </div>
        <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
          <div className="text-2xl mb-3">🔍</div>
          <h3 className="text-lg font-semibold text-white mb-2">Real-Time Research</h3>
          <p className="text-slate-400 text-sm">
            Searches the web using Tavily to gather up-to-date information.
          </p>
        </div>
        <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
          <div className="text-2xl mb-3">✅</div>
          <h3 className="text-lg font-semibold text-white mb-2">Quality Validation</h3>
          <p className="text-slate-400 text-sm">
            Multi-layer validation ensures high-quality, data-backed outputs.
          </p>
        </div>
      </div>
    </div>
  );
}

export default InputPage;
