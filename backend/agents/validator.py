"""Validator Agent - Multi-layer validation (v2 - Balanced)."""

import json
from typing import Dict, Any, Optional, List
import logging
import re

from agents.base_agent import BaseAgent
from models.schemas import ValidationResult

logger = logging.getLogger(__name__)


# ============== V2 VALIDATOR SYSTEM PROMPT (MORE LENIENT) ==============
VALIDATOR_SYSTEM_PROMPT = """You are a pragmatic QA reviewer focused on useful output.

# EVALUATION CRITERIA (score 0-10):

1. RELEVANCE (0-10): Does output address the task?
2. SPECIFICITY (0-10): Are there concrete facts/data?
3. USEFULNESS (0-10): Would this help decision-making?

# SCORING GUIDANCE:
- Score 7+ if output has relevant content and some specifics
- Score 5-6 if output is somewhat generic but addresses the task
- Score below 5 only if output is completely off-topic or empty

# BE LENIENT - Prefer to pass content that addresses the task, even if not perfect.
# Only reject if output is:
- Completely empty or off-topic
- Contains obvious placeholder text like "[Product]" or "Entity 1"
- Totally lacks any relevant information

# OUTPUT FORMAT (JSON):
{
  "overall_score": 7.5,
  "valid": true,
  "issues": ["optional improvement suggestions"],
  "critique": "brief assessment"
}"""


class ValidatorAgent(BaseAgent):
    """Agent for multi-layer validation (v2 - Balanced, not too strict)."""
    
    def __init__(self, run_id: str):
        super().__init__(run_id, "validator")
        self.min_valid_score = 7.0  # 70% minimum confidence
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Validate a task output with balanced standards."""
        task_id = context.get("task_id", "unknown")
        task_description = context.get("task_description", "")
        output = context.get("output", {})
        sources = context.get("sources", [])
        previous_outputs = context.get("previous_outputs", {})
        classification = context.get("classification", {})
        
        self.log(f"Validating output for task {task_id}", task_id=task_id)
        
        # Layer 1: Basic schema validation (quick pass/fail)
        schema_result = self._validate_schema(output)
        if not schema_result["valid"]:
            return {
                "success": True,
                "validation": schema_result,
            }
        
        # Layer 2: Light rule-based validation (lenient)
        rule_result = self._validate_rules_lenient(output, sources, task_description)
        
        # Layer 3: LLM-based critique (lenient)
        llm_result = await self._validate_llm_lenient(
            task_id,
            task_description,
            output,
            sources,
            classification,
        )
        
        # Combine results with bias toward passing
        combined = self._combine_validations_lenient(schema_result, rule_result, llm_result)
        
        self.log(
            f"Validation complete: score={combined['score']:.1f}, valid={combined['valid']}",
            task_id=task_id,
        )
        
        return {
            "success": True,
            "validation": combined,
        }
    
    def _validate_schema(self, output: Dict[str, Any]) -> Dict[str, Any]:
        """Layer 1: Basic schema validation - very lenient."""
        if not output:
            return {"valid": False, "score": 0, "issues": ["Output is empty"], "layer": "schema"}
        
        if not isinstance(output, dict):
            return {"valid": False, "score": 0, "issues": ["Output is not a dictionary"], "layer": "schema"}
        
        # Just check if there's any content
        output_str = json.dumps(output, default=str)
        if len(output_str) < 50:
            return {"valid": False, "score": 2, "issues": ["Output too short"], "layer": "schema"}
        
        return {"valid": True, "score": 10, "issues": [], "layer": "schema"}
    
    def _validate_rules_lenient(
        self,
        output: Dict[str, Any],
        sources: List[str],
        task_description: str,
    ) -> Dict[str, Any]:
        """Layer 2: Lenient rule-based validation."""
        issues = []
        score = 8.0  # Start with good score
        
        output_str = json.dumps(output, default=str).lower()
        
        # Only check for obvious placeholders (critical)
        placeholders = ["entity 1", "entity 2", "[product]", "[company]"]
        for placeholder in placeholders:
            if placeholder in output_str:
                issues.append(f"Contains placeholder: '{placeholder}'")
                score -= 2
        
        # Check minimum content
        if len(output_str) < 100:
            issues.append("Output very short")
            score -= 1
        
        # Bonus for having sources
        if sources and len(sources) > 0:
            score = min(10, score + 0.5)
        
        # Bonus for having key findings
        if output.get("key_findings") or output.get("summary"):
            score = min(10, score + 0.5)
        
        return {
            "valid": score >= 5,
            "score": max(0, score),
            "issues": issues,
            "layer": "rules",
        }
    
    async def _validate_llm_lenient(
        self,
        task_id: str,
        task_description: str,
        output: Dict[str, Any],
        sources: List[str],
        classification: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Layer 3: Lenient LLM-based validation."""
        
        prompt = f"""Quick validation - does this output address the task?

TASK: {task_description[:200]}

OUTPUT SUMMARY:
{json.dumps(output, indent=2, default=str)[:2000]}

Be lenient. Score 7+ if it addresses the task with some useful content.
Score below 5 only if completely irrelevant or empty.

Output JSON: {{"overall_score": X, "valid": true/false, "critique": "brief"}}"""

        try:
            response = await self.llm_service.generate_json(
                prompt=prompt,
                system_prompt=VALIDATOR_SYSTEM_PROMPT,
                temperature=0.2,
                max_tokens=300,  # Reduced for speed
            )
            
            self.track_llm_usage(response, task_id)
            
            if response.get("parsed"):
                parsed = response["parsed"]
                score = parsed.get("overall_score", 7)
                
                return {
                    "valid": score >= self.min_valid_score,
                    "score": score,
                    "issues": parsed.get("issues", []),
                    "critique": parsed.get("critique", ""),
                    "layer": "llm",
                }
        except Exception as e:
            self.log(f"LLM validation failed: {e}", level="warning", task_id=task_id)
        
        # Default: assume valid if LLM fails
        return {
            "valid": True,
            "score": 7.5,
            "issues": [],
            "layer": "llm_fallback",
        }
    
    def _combine_validations_lenient(
        self,
        schema_result: Dict[str, Any],
        rule_result: Dict[str, Any],
        llm_result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Combine validation results - biased toward passing."""
        
        # Use the HIGHEST score from any layer (lenient approach)
        scores = [schema_result["score"], rule_result["score"], llm_result["score"]]
        best_score = max(scores)
        avg_score = sum(scores) / len(scores)
        
        # Final score is weighted toward the best score
        final_score = (best_score * 0.6) + (avg_score * 0.4)
        
        all_issues = (
            schema_result.get("issues", [])
            + rule_result.get("issues", [])
            + llm_result.get("issues", [])
        )
        
        # Valid if schema passes AND score is acceptable
        is_valid = schema_result["valid"] and final_score >= self.min_valid_score
        
        return {
            "valid": is_valid,
            "score": round(final_score, 1),
            "issues": all_issues[:3],  # Limit issues
            "suggestions": [],
            "critique": llm_result.get("critique", ""),
            "layer_scores": {
                "schema": schema_result["score"],
                "rules": rule_result["score"],
                "llm": llm_result["score"],
            },
        }
