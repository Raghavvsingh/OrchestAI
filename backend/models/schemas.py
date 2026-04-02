"""Pydantic schemas for request/response validation and agent communication."""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum


# ============== Enums ==============

class GoalType(str, Enum):
    COMPARISON = "comparison"
    SINGLE_ENTITY = "single_entity"
    IDEA_ANALYSIS = "idea_analysis"
    MARKET_ANALYSIS = "market_analysis"
    FEATURE_COMPARISON = "feature_comparison"
    PRICING_ANALYSIS = "pricing_analysis"
    POSITIONING_ANALYSIS = "positioning_analysis"
    GAP_ANALYSIS = "gap_analysis"
    FEASIBILITY_ANALYSIS = "feasibility_analysis"
    TREND_ANALYSIS = "trend_analysis"
    USER_ANALYSIS = "user_analysis"
    GTM_STRATEGY = "gtm_strategy"
    INVESTMENT_ANALYSIS = "investment_analysis"
    # Legacy alias
    STARTUP_IDEA = "idea_analysis"


class RunStatusEnum(str, Enum):
    PENDING = "pending"
    PLANNING = "planning"
    EXECUTING = "executing"
    VALIDATING = "validating"
    PENDING_USER_REVIEW = "pending_user_review"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskStatusEnum(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    VALIDATING = "validating"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked_by_failed_dependency"
    SKIPPED = "skipped"


class CoordinatorAction(str, Enum):
    PROCEED = "proceed"
    RETRY = "retry"
    SKIP = "skip"
    REPLAN = "replan"
    ESCALATE = "escalate"
    COMPLETE = "complete"
    FAIL = "fail"


# ============== Planner Schemas ==============

class PlannedTask(BaseModel):
    """A single task in the planned DAG."""
    id: str = Field(..., description="Unique task identifier (e.g., T1, T2)")
    task: str = Field(..., description="Clear task description")
    depends_on: List[str] = Field(default_factory=list, description="List of task IDs this depends on")
    reason: str = Field(..., description="Why this task is needed")
    
    @validator('task')
    def task_not_vague(cls, v):
        vague_words = ['analyze', 'study', 'look at', 'check', 'review']
        if len(v.split()) < 4:
            raise ValueError("Task description too vague - needs more detail")
        return v


class GoalClassification(BaseModel):
    """Goal classification result."""
    type: GoalType
    domain: str = Field(..., description="Domain like fitness, fintech, SaaS, etc.")
    entities: List[str] = Field(default_factory=list, description="Extracted entities")
    focus: str = Field(..., description="Main focus of analysis")
    has_ai_component: bool = Field(default=False, description="Whether AI/tech differentiation exists")
    target_users: Optional[str] = Field(default=None, description="Target user segment if detected")


class TaskPlan(BaseModel):
    """Complete task plan from planner agent."""
    tasks: List[PlannedTask] = Field(..., min_length=5, max_length=12)
    goal_type: GoalType
    classification: Optional[GoalClassification] = None
    
    @validator('tasks')
    def validate_dag(cls, tasks):
        task_ids = {t.id for t in tasks}
        for task in tasks:
            for dep in task.depends_on:
                if dep not in task_ids:
                    raise ValueError(f"Task {task.id} depends on unknown task {dep}")
        # Check for cycles using DFS
        def has_cycle(task_id, visited, rec_stack, adj):
            visited.add(task_id)
            rec_stack.add(task_id)
            for neighbor in adj.get(task_id, []):
                if neighbor not in visited:
                    if has_cycle(neighbor, visited, rec_stack, adj):
                        return True
                elif neighbor in rec_stack:
                    return True
            rec_stack.remove(task_id)
            return False
        
        adj = {t.id: [] for t in tasks}
        for task in tasks:
            for dep in task.depends_on:
                adj[dep].append(task.id)
        
        visited = set()
        for task in tasks:
            if task.id not in visited:
                if has_cycle(task.id, visited, set(), adj):
                    raise ValueError("Task plan contains cycles")
        return tasks


# ============== Executor Schemas ==============

class SearchQuery(BaseModel):
    """Search query for Tavily."""
    query: str
    search_depth: Literal["basic", "advanced"] = "basic"
    max_results: int = 5


class SearchResult(BaseModel):
    """A single search result."""
    title: str
    url: str
    content: str
    score: float = 0.0


class ExecutorOutput(BaseModel):
    """Output from executor agent - consultancy grade."""
    task_id: str
    summary: str = Field(..., description="2-3 sentence executive summary")
    key_findings: List[str] = Field(default_factory=list, description="Key findings with data")
    comparisons: List[Dict[str, Any]] = Field(default_factory=list, description="Explicit comparisons")
    insights: List[str] = Field(default_factory=list, description="Strategic insights with WHY and SO WHAT")
    data_points: List[str] = Field(default_factory=list, description="Specific facts and figures")
    limitations: List[str] = Field(default_factory=list, description="Data gaps or uncertainties")
    sources: List[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    feature_matrix: Optional[Dict[str, Any]] = Field(default=None, description="Feature parity matrix if applicable")
    raw_data: Optional[Dict[str, Any]] = None


# ============== Validator Schemas ==============

class ValidationResult(BaseModel):
    """Output from validator agent."""
    valid: bool
    score: float = Field(ge=0, le=10)
    issues: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    critique: Optional[str] = None


# ============== Coordinator Schemas ==============

class CoordinatorDecision(BaseModel):
    """Decision made by coordinator."""
    action: CoordinatorAction
    reason: str
    retry_count: int = 0
    prompt_update: Optional[str] = None
    task_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ============== API Request/Response Schemas ==============

class AnalysisRequest(BaseModel):
    """Request to start analysis."""
    goal: str = Field(..., min_length=5, max_length=500)
    
    @validator('goal')
    def goal_not_too_vague(cls, v):
        if len(v.split()) < 2:
            raise ValueError("Goal is too vague. Please provide more detail.")
        return v


class AnalysisResponse(BaseModel):
    """Response after starting analysis."""
    run_id: str
    status: str
    message: str


class TaskResponse(BaseModel):
    """Task information for API responses."""
    id: str
    task_description: str
    status: str
    retries: int
    output: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    validation_score: Optional[float] = None
    error: Optional[str] = None


class RunStatusResponse(BaseModel):
    """Full run status response."""
    run_id: str
    goal: str
    goal_type: Optional[str] = None
    status: str
    current_task_id: Optional[str] = None
    tasks: List[TaskResponse] = Field(default_factory=list)
    progress: float = 0.0
    cost: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class RunResultResponse(BaseModel):
    """Final result response."""
    run_id: str
    goal: str
    status: str
    final_report: Optional[Dict[str, Any]] = None
    tasks: List[TaskResponse] = Field(default_factory=list)
    total_cost: Optional[Dict[str, Any]] = None


class ApprovalRequest(BaseModel):
    """Request to approve/reject a run."""
    approved: bool
    feedback: Optional[str] = None
    edits: Optional[Dict[str, Any]] = None


class LogEntry(BaseModel):
    """Log entry for frontend display."""
    id: int
    agent: str
    level: str
    message: str
    task_id: Optional[str] = None
    latency_ms: Optional[int] = None
    created_at: datetime


class LogsResponse(BaseModel):
    """Logs response."""
    run_id: str
    logs: List[LogEntry]


# ============== Agent Communication Schemas ==============

class AgentMessage(BaseModel):
    """Message passed between agents."""
    from_agent: str
    to_agent: str
    message_type: str
    payload: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AgentContext(BaseModel):
    """Context passed to agents."""
    run_id: str
    goal: str
    goal_type: Optional[GoalType] = None
    current_task: Optional[PlannedTask] = None
    completed_tasks: List[str] = Field(default_factory=list)
    task_outputs: Dict[str, Any] = Field(default_factory=dict)
    retry_count: int = 0
    total_cost: float = 0.0
