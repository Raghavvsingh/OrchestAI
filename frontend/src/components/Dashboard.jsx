import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Loader2, 
  RefreshCw,
  ChevronRight,
  Activity,
  DollarSign,
  FileText
} from 'lucide-react';
import { analysisApi, createWebSocket } from '../services/api';
import TaskGraph from './TaskGraph';
import LogViewer from './LogViewer';

const statusIcons = {
  pending: <Clock className="w-4 h-4 text-gray-400" />,
  in_progress: <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />,
  validating: <Activity className="w-4 h-4 text-yellow-400" />,
  completed: <CheckCircle className="w-4 h-4 text-green-400" />,
  failed: <XCircle className="w-4 h-4 text-red-400" />,
  blocked_by_failed_dependency: <AlertTriangle className="w-4 h-4 text-orange-400" />,
  skipped: <ChevronRight className="w-4 h-4 text-gray-400" />,
};

const statusColors = {
  pending: 'bg-slate-700',
  planning: 'bg-blue-900',
  executing: 'bg-blue-800',
  validating: 'bg-yellow-900',
  pending_user_review: 'bg-purple-900',
  completed: 'bg-green-900',
  failed: 'bg-red-900',
};

function Dashboard() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const wsRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await analysisApi.getStatus(runId);
      setStatus(data);
      
      // Check if completed
      if (['completed', 'pending_user_review'].includes(data.status)) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch status');
    }
  }, [runId]);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await analysisApi.getLogs(runId);
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }, [runId]);

  useEffect(() => {
    fetchStatus();
    fetchLogs();

    // Set up polling
    pollIntervalRef.current = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 3000);

    // Set up WebSocket
    try {
      const wsConnection = createWebSocket(
        runId,
        (data) => {
          if (data.type === 'state_update') {
            setStatus((prev) => ({
              ...prev,
              ...data.state,
              tasks: data.state.tasks?.map((t, idx) => ({
                id: t.id,
                task_description: t.task,
                status: data.state.task_statuses?.[t.id] || 'pending',
                retries: data.state.task_retries?.[t.id] || 0,
                output: data.state.task_outputs?.[t.id],
              })) || prev?.tasks,
            }));
          } else if (data.type === 'log') {
            setLogs((prev) => [data.log, ...prev].slice(0, 100));
          } else if (data.type === 'completed') {
            fetchStatus();
          }
        },
        (err) => console.error('WebSocket error:', err)
      );
      wsRef.current = wsConnection;
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [runId, fetchStatus, fetchLogs]);

  const handleViewReport = () => {
    navigate(`/report/${runId}`);
  };

  const handleResume = async () => {
    try {
      await analysisApi.resumeRun(runId);
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resume');
    }
  };

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

  if (!status) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const completedTasks = status.tasks?.filter(
    (t) => ['completed', 'failed', 'skipped', 'blocked_by_failed_dependency'].includes(t.status)
  ).length || 0;
  const totalTasks = status.tasks?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-6 rounded-xl ${statusColors[status.status] || 'bg-slate-800'} border border-slate-700`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-slate-800 rounded-full text-sm font-medium text-white capitalize">
                {status.status?.replace(/_/g, ' ')}
              </span>
              {status.goal_type && (
                <span className="px-3 py-1 bg-blue-900 rounded-full text-sm text-blue-200">
                  {status.goal_type}
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-white mb-1">{status.goal}</h2>
            <p className="text-slate-400 text-sm">Run ID: {runId}</p>
          </div>
          
          <div className="flex gap-3">
            {status.status === 'failed' && (
              <button
                onClick={handleResume}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Resume
              </button>
            )}
            {['completed', 'pending_user_review'].includes(status.status) && (
              <button
                onClick={handleViewReport}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                View Report
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Progress</span>
            <span>{completedTasks} / {totalTasks} tasks</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Cost */}
        {status.cost && (
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-slate-400">
              <DollarSign className="w-4 h-4" />
              <span>Cost: ${status.cost.estimated_cost_usd?.toFixed(4) || '0.0000'}</span>
            </div>
            <div className="text-slate-400">
              Tokens: {status.cost.total_tokens?.toLocaleString() || 0}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'tasks'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Tasks
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'graph'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Graph
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'logs'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Logs ({logs.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {status.tasks?.map((task) => (
            <div
              key={task.id}
              className={`p-4 rounded-lg border ${
                task.status === 'in_progress'
                  ? 'border-blue-500 bg-blue-900/20 animate-pulse-glow'
                  : 'border-slate-700 bg-slate-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {statusIcons[task.status] || statusIcons.pending}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{task.id}</span>
                      <span className={`px-2 py-0.5 rounded text-xs status-${task.status}`}>
                        {task.status?.replace(/_/g, ' ')}
                      </span>
                      {task.retries > 0 && (
                        <span className="text-xs text-yellow-400">
                          ({task.retries} retries)
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 mt-1">{task.task_description}</p>
                    
                    {task.error && (
                      <p className="text-red-400 text-sm mt-2">{task.error}</p>
                    )}
                    
                    {task.confidence && (
                      <div className="mt-2 text-sm text-slate-400">
                        Confidence: {(task.confidence * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {(!status.tasks || status.tasks.length === 0) && (
            <div className="text-center py-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Planning tasks...</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'graph' && (
        <TaskGraph tasks={status.tasks || []} currentTaskId={status.current_task_id} />
      )}

      {activeTab === 'logs' && (
        <LogViewer logs={logs} />
      )}
    </div>
  );
}

export default Dashboard;
