import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Download,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  DollarSign,
  Clock
} from 'lucide-react';
import { analysisApi } from '../services/api';

function ReportView() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const data = await analysisApi.getResult(runId);
        setResult(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to fetch result');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [runId]);

  const handleApprove = async () => {
    setApproving(true);
    try {
      await analysisApi.approveRun(runId, true);
      setResult((prev) => ({ ...prev, status: 'completed' }));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to approve');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!feedback.trim()) {
      setShowFeedback(true);
      return;
    }
    
    setApproving(true);
    try {
      await analysisApi.approveRun(runId, false, feedback);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reject');
    } finally {
      setApproving(false);
    }
  };

  const handleDownload = () => {
    const dataStr = JSON.stringify(result.final_report, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${runId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-900/30 border border-red-700 rounded-xl text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Error</h2>
        <p className="text-red-200">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
        >
          Start New Analysis
        </button>
      </div>
    );
  }

  const report = result?.final_report || {};
  const isPendingReview = result?.status === 'pending_user_review';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Analysis Report</h1>
            {result?.status === 'completed' && (
              <span className="px-3 py-1 bg-green-900 text-green-200 rounded-full text-sm">
                Approved
              </span>
            )}
            {isPendingReview && (
              <span className="px-3 py-1 bg-purple-900 text-purple-200 rounded-full text-sm">
                Pending Review
              </span>
            )}
          </div>
          <p className="text-slate-400">{result?.goal}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* HITL Controls */}
      {isPendingReview && (
        <div className="p-6 bg-purple-900/30 border border-purple-700 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">Review Required</h3>
          <p className="text-slate-300 mb-4">
            Please review the analysis below and approve or reject it.
          </p>

          {showFeedback && (
            <div className="mb-4">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Please provide feedback for rejection..."
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={3}
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={approving}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 rounded-lg text-white flex items-center gap-2"
            >
              {approving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ThumbsUp className="w-4 h-4" />
              )}
              Approve
            </button>
            <button
              onClick={handleReject}
              disabled={approving}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 rounded-lg text-white flex items-center gap-2"
            >
              <ThumbsDown className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Generated</span>
          </div>
          <p className="text-white">
            {report.generated_at 
              ? new Date(report.generated_at).toLocaleString()
              : 'N/A'
            }
          </p>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-sm">Analysis Type</span>
          </div>
          <p className="text-white capitalize">
            {report.goal_type?.replace(/_/g, ' ') || report.summary_type || 'N/A'}
          </p>
        </div>
        <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Total Cost</span>
          </div>
          <p className="text-white">
            ${result?.total_cost?.estimated_cost_usd?.toFixed(4) || '0.0000'}
          </p>
        </div>
      </div>

      {/* Report Sections */}
      <div className="space-y-6">
        {Object.entries(report.sections || {}).map(([taskId, section]) => (
          <div 
            key={taskId}
            className="p-6 bg-slate-800 rounded-xl border border-slate-700"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-900 rounded text-sm text-blue-200">
                  {taskId}
                </span>
                {section.task}
              </h3>
              {section.status === 'completed' && (
                <CheckCircle className="w-5 h-5 text-green-400" />
              )}
            </div>

            {/* Output content */}
            {section.output && (
              <div className="space-y-4">
                {/* Summary */}
                {section.output.summary && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">Summary</h4>
                    <p className="text-slate-200">{section.output.summary}</p>
                  </div>
                )}

                {/* Findings */}
                {section.output.findings && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">Key Findings</h4>
                    <div className="space-y-2">
                      {Object.entries(section.output.findings).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-blue-400">•</span>
                          <div>
                            <span className="text-slate-300 font-medium capitalize">
                              {key.replace(/_/g, ' ')}:
                            </span>{' '}
                            <span className="text-slate-200">{value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Points */}
                {section.output.data_points && section.output.data_points.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">Data Points</h4>
                    <ul className="space-y-1">
                      {section.output.data_points.map((point, idx) => (
                        <li key={idx} className="text-slate-200 flex gap-2">
                          <span className="text-green-400">✓</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Limitations */}
                {section.output.limitations && section.output.limitations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">Limitations</h4>
                    <ul className="space-y-1">
                      {section.output.limitations.map((limitation, idx) => (
                        <li key={idx} className="text-yellow-300 text-sm flex gap-2">
                          <span>⚠</span>
                          {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Confidence */}
                {section.output.confidence !== undefined && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700">
                    <span className="text-sm text-slate-400">Confidence:</span>
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden max-w-xs">
                      <div 
                        className={`h-full ${
                          section.output.confidence >= 0.7 ? 'bg-green-500' :
                          section.output.confidence >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${section.output.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-300">
                      {(section.output.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Task Summary */}
      {result?.tasks && result.tasks.length > 0 && (
        <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Task Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {result.tasks.length}
              </div>
              <div className="text-sm text-slate-400">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {result.tasks.filter(t => t.status === 'completed').length}
              </div>
              <div className="text-sm text-slate-400">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">
                {result.tasks.filter(t => t.status === 'failed').length}
              </div>
              <div className="text-sm text-slate-400">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {result.tasks.reduce((sum, t) => sum + (t.retries || 0), 0)}
              </div>
              <div className="text-sm text-slate-400">Total Retries</div>
            </div>
          </div>
        </div>
      )}

      {/* Back button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
        >
          Start New Analysis
        </button>
      </div>
    </div>
  );
}

export default ReportView;
