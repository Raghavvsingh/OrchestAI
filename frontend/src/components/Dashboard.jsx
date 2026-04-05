import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, FileText, AlertCircle } from 'lucide-react';
import { analysisApi, createWebSocket } from '../services/api';
import TaskGraph from './TaskGraph';
import LogViewer from './LogViewer';

// Helper to extract task name from description
const getTaskName = (task) => {
  if (task.name) return task.name;
  // Try to extract a short name from description
  const desc = task.task_description || '';
  const words = desc.split(' ').slice(0, 3).join(' ');
  return words.length > 25 ? words.slice(0, 25) + '...' : words || 'Task';
};

// Status pill component
const StatusPill = ({ status }) => {
  const statusLabels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    validating: 'Validating',
    completed: 'Completed',
    failed: 'Failed',
    blocked_by_failed_dependency: 'Blocked',
    skipped: 'Skipped',
  };

  return (
    <span className={`status-pill status-pill-${status}`}>
      {statusLabels[status] || status?.replace(/_/g, ' ')}
    </span>
  );
};

// Status dot component
const StatusDot = ({ status }) => (
  <div className={`status-dot status-dot-${status}`} />
);

// Task item component
const TaskItem = ({ task, isActive }) => {
  return (
    <div
      className={`task-item p-5 bg-white rounded-xl border transition-all duration-200 ${
        isActive 
          ? 'task-item-active border-amber-200 shadow-sm' 
          : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Status indicator */}
        <div className="mt-1.5">
          <StatusDot status={task.status} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900">{task.id}</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            {task.task_description}
          </p>
          
          {task.error && (
            <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {task.error}
            </p>
          )}
        </div>

        {/* Status pill */}
        <div className="flex-shrink-0">
          <StatusPill status={task.status} />
        </div>
      </div>
    </div>
  );
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
      // Only set logs if we don't have any (initial load), otherwise accumulate via websocket
      if (logs.length === 0) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }, [runId, logs.length]);

  useEffect(() => {
    fetchStatus();
    fetchLogs();

    pollIntervalRef.current = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 2000);

    try {
      const wsConnection = createWebSocket(
        runId,
        (data) => {
          if (data.type === 'state_update') {
            setStatus((prev) => ({
              ...prev,
              ...data.state,
              tasks: data.state.tasks?.map((t) => ({
                id: t.id,
                task_description: t.task,
                depends_on: t.depends_on || [],
                status: data.state.task_statuses?.[t.id] || 'pending',
                retries: data.state.task_retries?.[t.id] || 0,
                output: data.state.task_outputs?.[t.id],
              })) || prev?.tasks,
            }));
          } else if (data.type === 'log') {
            // Accumulate all logs, no limit
            setLogs((prev) => [...prev, data.log]);
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

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-10 text-center card-shadow">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 rounded-lg text-white text-sm font-medium transition-colors"
        >
          Start New Analysis
        </button>
      </div>
    );
  }

  // Loading state
  if (!status) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const completedTasks = status.tasks?.filter(
    (t) => ['completed', 'failed', 'skipped', 'blocked_by_failed_dependency'].includes(t.status)
  ).length || 0;
  const totalTasks = status.tasks?.length || 0;

  return (
    <div className="space-y-8">
      {/* Execution Card */}
      <div className="bg-white rounded-xl border border-gray-100 p-8 card-shadow">
        <div className="flex items-start justify-between mb-6">
          <div>
            {/* Status badge */}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 mb-4">
              {status.status === 'executing' || status.status === 'in_progress' ? 'Executing' : 
               status.status?.replace(/_/g, ' ').charAt(0).toUpperCase() + status.status?.replace(/_/g, ' ').slice(1)}
            </span>
            
            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900">
              {status.goal || 'Analysis'}
            </h1>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-3">
            {status.status === 'failed' && (
              <button
                onClick={handleResume}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-700 text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Resume
              </button>
            )}
            {['completed', 'pending_user_review'].includes(status.status) && (
              <button
                onClick={handleViewReport}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <FileText className="w-4 h-4" />
                View Report
              </button>
            )}
          </div>
        </div>

        {/* Progress section */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-500">Progress</span>
            <span className="text-sm text-gray-500">{completedTasks} / {totalTasks} tasks</span>
          </div>
          <div className="progress-bar-track">
            <div 
              className="progress-bar-fill"
              style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-8 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'tasks'
              ? 'text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Tasks
          {activeTab === 'tasks' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'graph'
              ? 'text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Graph
          {activeTab === 'graph' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-sm font-medium transition-colors relative ${
            activeTab === 'logs'
              ? 'text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Logs ({logs.length})
          {activeTab === 'logs' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900" />
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {status.tasks
            ?.sort((a, b) => {
              // Sort by task_id (T1, T2, T3, etc.)
              const getTaskNumber = (id) => parseInt(id.replace('T', '')) || 0;
              return getTaskNumber(a.id) - getTaskNumber(b.id);
            })
            .map((task) => (
            <TaskItem 
              key={task.id} 
              task={task} 
              isActive={task.status === 'in_progress'} 
            />
          ))}

          {(!status.tasks || status.tasks.length === 0) && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Planning tasks...</p>
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
