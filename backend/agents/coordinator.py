"""Coordinator Agent - Orchestration brain for workflow execution."""

import json
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
import logging
import asyncio

from agents.base_agent import BaseAgent
from agents.planner import PlannerAgent
from agents.executor import ExecutorAgent
from agents.validator import ValidatorAgent
from models.schemas import (
    CoordinatorAction,
    CoordinatorDecision,
    RunStatusEnum,
    TaskStatusEnum,
    GoalType,
)
from services.cost_tracker import get_cost_tracker
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class CoordinatorAgent(BaseAgent):
    """Brain agent that orchestrates the entire workflow."""
    
    def __init__(self, run_id: str):
        super().__init__(run_id, "coordinator")
        self.planner = PlannerAgent(run_id)
        self.executor = ExecutorAgent(run_id)
        self.validator = ValidatorAgent(run_id)
        
        self.max_retries = settings.max_retries
        self.min_validation_score = 7.0  # 70% minimum confidence
        
        # Run state
        self.tasks: List[Dict[str, Any]] = []
        self.task_outputs: Dict[str, Any] = {}
        self.task_statuses: Dict[str, str] = {}
        self.task_retries: Dict[str, int] = {}
        self.current_task_id: Optional[str] = None
        self.status = RunStatusEnum.PENDING
        self.goal: str = ""
        self.goal_type: Optional[str] = None
        self.classification: Dict[str, Any] = {}  # v2: full classification
        
        # Callbacks for state persistence
        self.on_state_change: Optional[callable] = None
        self.on_log: Optional[callable] = None
    
    def set_callbacks(
        self,
        on_state_change: Optional[callable] = None,
        on_log: Optional[callable] = None,
    ):
        """Set callbacks for state updates."""
        self.on_state_change = on_state_change
        self.on_log = on_log
    
    async def _emit_state_change(self):
        """Emit state change event."""
        if self.on_state_change:
            await self.on_state_change(self.get_state())
    
    async def _emit_log(self, message: str, level: str = "info", task_id: Optional[str] = None):
        """Emit log event."""
        self.log(message, level=level, task_id=task_id)
        if self.on_log:
            await self.on_log({
                "agent": self.name,
                "level": level,
                "message": message,
                "task_id": task_id,
                "timestamp": datetime.utcnow().isoformat(),
            })
    
    def get_state(self) -> Dict[str, Any]:
        """Get current state for persistence."""
        return {
            "run_id": self.run_id,
            "status": self.status.value if isinstance(self.status, RunStatusEnum) else self.status,
            "goal": self.goal,
            "goal_type": self.goal_type,
            "classification": self.classification,
            "current_task_id": self.current_task_id,
            "tasks": self.tasks,
            "task_outputs": self.task_outputs,
            "task_statuses": self.task_statuses,
            "task_retries": self.task_retries,
            "cost": self.cost_tracker.get_stats(),
        }
    
    def load_state(self, state: Dict[str, Any]):
        """Load state from persistence."""
        self.goal = state.get("goal", "")
        self.goal_type = state.get("goal_type")
        self.classification = state.get("classification", {})
        self.current_task_id = state.get("current_task_id")
        self.tasks = state.get("tasks", [])
        self.task_outputs = state.get("task_outputs", {})
        self.task_statuses = state.get("task_statuses", {})
        self.task_retries = state.get("task_retries", {})
        status = state.get("status", "pending")
        self.status = RunStatusEnum(status) if isinstance(status, str) else status
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Main execution entry point."""
        self.goal = context.get("goal", "")
        resume = context.get("resume", False)
        
        if not self.goal:
            return {"success": False, "error": "No goal provided"}
        
        await self._emit_log(f"Starting analysis: {self.goal}")
        
        try:
            if not resume:
                # Phase 1: Planning
                self.status = RunStatusEnum.PLANNING
                await self._emit_state_change()
                
                plan_result = await self._plan()
                if not plan_result["success"]:
                    return plan_result
            
            # Phase 2: Execution
            self.status = RunStatusEnum.EXECUTING
            await self._emit_state_change()
            
            execution_result = await self._execute_tasks()
            
            # Phase 3: Final Report
            if execution_result["success"]:
                self.status = RunStatusEnum.PENDING_USER_REVIEW
                await self._emit_state_change()
                
                final_report = self._generate_final_report()
                
                return {
                    "success": True,
                    "status": self.status.value,
                    "report": final_report,
                    "tasks": self.tasks,
                    "outputs": self.task_outputs,
                    "cost": self.cost_tracker.get_stats(),
                }
            else:
                self.status = RunStatusEnum.FAILED
                await self._emit_state_change()
                return execution_result
                
        except Exception as e:
            self.status = RunStatusEnum.FAILED
            await self._emit_state_change()
            await self._emit_log(f"Execution failed: {e}", level="error")
            return {"success": False, "error": str(e)}
    
    async def _plan(self) -> Dict[str, Any]:
        """Execute planning phase."""
        await self._emit_log("Starting task planning...")
        
        plan_result = await self.planner.execute({"goal": self.goal})
        
        if not plan_result["success"]:
            await self._emit_log("Planning failed", level="error")
            return plan_result
        
        plan = plan_result["plan"]
        self.goal_type = plan_result.get("goal_type", plan.get("goal_type"))
        self.classification = plan_result.get("classification", plan.get("classification", {}))
        self.tasks = plan.get("tasks", [])
        
        # Initialize task statuses
        for task in self.tasks:
            task_id = task["id"]
            self.task_statuses[task_id] = TaskStatusEnum.PENDING.value
            self.task_retries[task_id] = 0
        
        await self._emit_log(f"Created {len(self.tasks)} tasks (method: {plan_result.get('method', 'unknown')})")
        await self._emit_log(f"Classification: type={self.goal_type}, domain={self.classification.get('domain', 'unknown')}")
        await self._emit_state_change()
        
        return {"success": True}
    
    async def _execute_tasks(self) -> Dict[str, Any]:
        """Execute all tasks in order."""
        
        while True:
            # Find next executable task
            next_task = self._get_next_task()
            
            if next_task is None:
                # Check if all tasks are done
                completed = all(
                    s in [TaskStatusEnum.COMPLETED.value, TaskStatusEnum.FAILED.value, TaskStatusEnum.SKIPPED.value, TaskStatusEnum.BLOCKED.value]
                    for s in self.task_statuses.values()
                )
                
                if completed:
                    await self._emit_log("All tasks completed")
                    return {"success": True}
                else:
                    await self._emit_log("No executable tasks found", level="warning")
                    return {"success": False, "error": "Deadlock: no executable tasks"}
            
            # Execute the task
            task_id = next_task["id"]
            self.current_task_id = task_id
            self.task_statuses[task_id] = TaskStatusEnum.IN_PROGRESS.value
            await self._emit_state_change()
            
            result = await self._execute_single_task(next_task)
            
            # Process result
            decision = await self._make_decision(task_id, result)
            
            if decision.action == CoordinatorAction.PROCEED:
                self.task_statuses[task_id] = TaskStatusEnum.COMPLETED.value
                self.task_outputs[task_id] = result.get("output", {})
                await self._emit_log(f"Task {task_id} completed", task_id=task_id)
                
            elif decision.action == CoordinatorAction.RETRY:
                self.task_retries[task_id] = self.task_retries.get(task_id, 0) + 1
                self.task_statuses[task_id] = TaskStatusEnum.PENDING.value
                await self._emit_log(
                    f"Task {task_id} retry {self.task_retries[task_id]}/{self.max_retries}: {decision.reason}",
                    level="warning",
                    task_id=task_id,
                )
                
            elif decision.action == CoordinatorAction.SKIP:
                self.task_statuses[task_id] = TaskStatusEnum.SKIPPED.value
                await self._emit_log(f"Task {task_id} skipped: {decision.reason}", level="warning", task_id=task_id)
                
            elif decision.action == CoordinatorAction.FAIL:
                self.task_statuses[task_id] = TaskStatusEnum.FAILED.value
                self._block_dependent_tasks(task_id)
                await self._emit_log(f"Task {task_id} failed: {decision.reason}", level="error", task_id=task_id)
            
            await self._emit_state_change()
            
            # Check cost limit
            if self.cost_tracker.is_over_limit():
                await self._emit_log("Cost limit exceeded", level="warning")
                # Complete remaining tasks with minimal processing
                self._skip_remaining_tasks()
                return {"success": True, "warning": "Cost limit reached"}
    
    async def _execute_single_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single task with validation (v2: pass classification)."""
        task_id = task["id"]
        
        # Check if should use summarization mode
        use_summarization = self.cost_tracker.should_use_summarization()
        
        # Execute with classification context
        exec_result = await self.executor.execute({
            "task": task,
            "previous_outputs": self.task_outputs,
            "use_summarization": use_summarization,
            "classification": self.classification,  # v2: pass classification
        })
        
        if not exec_result.get("success"):
            return exec_result
        
        # Validate with classification context
        self.task_statuses[task_id] = TaskStatusEnum.VALIDATING.value
        await self._emit_state_change()
        
        val_result = await self.validator.execute({
            "task_id": task_id,
            "task_description": task.get("task", ""),
            "output": exec_result.get("output", {}),
            "sources": exec_result.get("sources", []),
            "previous_outputs": self.task_outputs,
            "classification": self.classification,  # v2: pass classification
        })
        
        exec_result["validation"] = val_result.get("validation", {})
        return exec_result
    
    async def _make_decision(self, task_id: str, result: Dict[str, Any]) -> CoordinatorDecision:
        """Make a decision based on task result - biased toward proceeding."""
        
        # Check for execution failure
        if not result.get("success"):
            error = result.get("error", "Unknown error")
            retries = self.task_retries.get(task_id, 0)
            
            if retries < self.max_retries:
                return CoordinatorDecision(
                    action=CoordinatorAction.RETRY,
                    reason=f"Execution failed: {error}",
                    retry_count=retries + 1,
                )
            else:
                return CoordinatorDecision(
                    action=CoordinatorAction.FAIL,
                    reason=f"Max retries exceeded. Last error: {error}",
                )
        
        # Check validation result - BE LENIENT
        validation = result.get("validation", {})
        score = validation.get("score", 8)  # Default to good score
        is_valid = validation.get("valid", True)
        
        # If output exists and has content, proceed on first try
        output = result.get("output", {})
        has_content = output and (
            output.get("summary") or 
            output.get("key_findings") or 
            len(str(output)) > 100
        )
        
        # First attempt with reasonable content -> proceed immediately
        retries = self.task_retries.get(task_id, 0)
        if retries == 0 and has_content and score >= 6.9:
            return CoordinatorDecision(
                action=CoordinatorAction.PROCEED,
                reason=f"First attempt with content (score: {score:.1f})",
            )
        
        # Standard validation check
        if is_valid and score >= self.min_validation_score:
            return CoordinatorDecision(
                action=CoordinatorAction.PROCEED,
                reason="Validation passed",
            )
        
        # Only retry if score is below threshold
        if retries < self.max_retries and score < 7:
            issues = validation.get("issues", [])
            return CoordinatorDecision(
                action=CoordinatorAction.RETRY,
                reason=f"Low validation score ({score:.1f})",
                retry_count=retries + 1,
                prompt_update=f"Improve: {'; '.join(issues[:2])}" if issues else None,
            )
        
        # Accept with any score if there's content
        if has_content:
            return CoordinatorDecision(
                action=CoordinatorAction.PROCEED,
                reason=f"Accepting content (score: {score:.1f})",
            )
        
        # Retry if no content
        if retries < self.max_retries:
            return CoordinatorDecision(
                action=CoordinatorAction.RETRY,
                reason="No content generated",
                retry_count=retries + 1,
            )
        
        return CoordinatorDecision(
            action=CoordinatorAction.FAIL,
            reason=f"Failed after {self.max_retries} retries",
        )
    
    def _get_next_task(self) -> Optional[Dict[str, Any]]:
        """Get the next task that can be executed."""
        for task in self.tasks:
            task_id = task["id"]
            status = self.task_statuses.get(task_id)
            
            if status != TaskStatusEnum.PENDING.value:
                continue
            
            # Check dependencies
            deps = task.get("depends_on", [])
            deps_satisfied = all(
                self.task_statuses.get(dep) == TaskStatusEnum.COMPLETED.value
                for dep in deps
            )
            
            # Check if any dependency failed
            deps_failed = any(
                self.task_statuses.get(dep) in [
                    TaskStatusEnum.FAILED.value,
                    TaskStatusEnum.BLOCKED.value,
                ]
                for dep in deps
            )
            
            if deps_failed:
                self.task_statuses[task_id] = TaskStatusEnum.BLOCKED.value
                continue
            
            if deps_satisfied:
                return task
        
        return None
    
    def _block_dependent_tasks(self, failed_task_id: str):
        """Mark tasks that depend on a failed task as blocked."""
        for task in self.tasks:
            if failed_task_id in task.get("depends_on", []):
                self.task_statuses[task["id"]] = TaskStatusEnum.BLOCKED.value
    
    def _skip_remaining_tasks(self):
        """Skip remaining pending tasks."""
        for task in self.tasks:
            if self.task_statuses.get(task["id"]) == TaskStatusEnum.PENDING.value:
                self.task_statuses[task["id"]] = TaskStatusEnum.SKIPPED.value
    
    def _generate_final_report(self) -> Dict[str, Any]:
        """Generate the final consultancy-grade analysis report."""
        report = {
            "goal": self.goal,
            "goal_type": self.goal_type,
            "classification": self.classification,
            "generated_at": datetime.utcnow().isoformat(),
            "sections": {},
            "executive_summary": "",
            "key_findings": [],
            "feature_matrix": {},
            "swot": {},
            "recommendations": [],
        }
        
        # Organize outputs by task and extract key sections
        all_findings = []
        all_comparisons = []
        all_insights = []
        
        for task in self.tasks:
            task_id = task["id"]
            output = self.task_outputs.get(task_id, {})
            
            if output:
                report["sections"][task_id] = {
                    "task": task.get("task", ""),
                    "output": output,
                    "status": self.task_statuses.get(task_id),
                }
                
                # Extract key findings
                if isinstance(output, dict):
                    all_findings.extend(output.get("key_findings", []))
                    all_comparisons.extend(output.get("comparisons", []))
                    all_insights.extend(output.get("insights", []))
                    
                    # Capture feature matrix if present
                    if output.get("feature_matrix"):
                        report["feature_matrix"].update(output["feature_matrix"])
                    
                    # Capture SWOT if present
                    task_lower = task.get("task", "").lower()
                    if "swot" in task_lower and output.get("key_findings"):
                        report["swot"] = output
        
        # Compile executive summary
        report["key_findings"] = all_findings[:10]  # Top 10 findings
        report["comparisons"] = all_comparisons
        report["strategic_insights"] = all_insights[:8]
        
        # Add summary type based on goal type
        if self.goal_type == "comparison":
            report["summary_type"] = "comparison"
        elif self.goal_type == "single_entity":
            report["summary_type"] = "entity_analysis"
        elif self.goal_type == "idea_analysis":
            report["summary_type"] = "idea_validation"
        else:
            report["summary_type"] = self.goal_type or "analysis"
        
        report["cost"] = self.cost_tracker.get_stats()
        
        return report
    
    def get_all_logs(self) -> List[Dict[str, Any]]:
        """Get logs from all agents."""
        all_logs = []
        all_logs.extend(self.logs)
        all_logs.extend(self.planner.get_logs())
        all_logs.extend(self.executor.get_logs())
        all_logs.extend(self.validator.get_logs())
        
        # Sort by timestamp
        all_logs.sort(key=lambda x: x.get("timestamp", ""))
        
        return all_logs
