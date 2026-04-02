"""Executor Agent - RAG pipeline for task execution (v2 - Consultancy Grade)."""

import json
from typing import Dict, Any, Optional, List
import logging

from agents.base_agent import BaseAgent
from services.search_service import get_search_service, SearchService
from models.schemas import ExecutorOutput

logger = logging.getLogger(__name__)


# ============== V2 SYSTEM PROMPT - CONSULTANCY GRADE (COMPACT) ==============
EXECUTOR_SYSTEM_PROMPT = """You are a senior strategy consultant producing insight-rich analysis.

RULES:
- Extract specific data points (numbers, %, $)
- Compare entities explicitly when applicable
- Provide insights with WHY it matters
- Identify strengths vs weaknesses
- Note data gaps in limitations

OUTPUT FORMAT (JSON):
{
  "summary": "2-3 sentence key insight",
  "key_findings": ["Finding with data"],
  "comparisons": [{"dimension": "X", "insight": "Y"}],
  "insights": ["Strategic insight"],
  "data_points": ["Specific fact"],
  "limitations": ["Missing data"],
  "confidence": 0.0-1.0
}"""


class ExecutorAgent(BaseAgent):
    """Agent for executing tasks using RAG pipeline (v2 - Consultancy Grade)."""
    
    def __init__(self, run_id: str):
        super().__init__(run_id, "executor")
        self.search_service: SearchService = get_search_service()
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single task with consultancy-grade output."""
        task = context.get("task", {})
        task_id = task.get("id", "unknown")
        task_description = task.get("task", "")
        previous_outputs = context.get("previous_outputs", {})
        use_summarization = context.get("use_summarization", False)
        goal_classification = context.get("classification", {})
        
        if not task_description:
            return {
                "success": False,
                "task_id": task_id,
                "error": "No task description provided",
            }
        
        self.log(f"Executing task {task_id}: {task_description[:50]}...", task_id=task_id)
        
        try:
            # Step 1: Use task description directly as search query (faster, simpler)
            search_query = task_description[:200]
            self.log(f"Searching: {search_query[:60]}...", task_id=task_id)
            
            # Step 2: Execute single search
            results = await self._search(search_query, task_description)
            all_results = results.get("results", [])
            
            self.log(f"Found {len(all_results)} search results", task_id=task_id)
            
            if not all_results:
                # Try a simpler search if first fails
                entities = goal_classification.get("entities", [])
                if entities:
                    simpler_query = entities[0][:100]
                    results = await self._search(simpler_query, task_description)
                    all_results = results.get("results", [])
                
                if not all_results:
                    return {
                        "success": False,
                        "task_id": task_id,
                        "error": "No search results found",
                        "sources": [],
                    }
            
            # Step 3: Prepare context
            context_text = self._prepare_context({"results": all_results}, use_summarization)
            
            # Step 4: Generate consultancy-grade output
            output = await self._generate_consultancy_output(
                task_description,
                context_text,
                previous_outputs,
                goal_classification,
                task_id,
            )
            
            # Extract sources safely - handle both dict and object types
            sources = []
            for r in all_results[:5]:
                url = getattr(r, 'url', None) if hasattr(r, 'url') else r.get('url', '') if isinstance(r, dict) else ''
                if url:
                    sources.append(str(url))
            sources = list(set(sources))
            
            parsed_output = output.get("parsed", {})
            
            return {
                "success": True,
                "task_id": task_id,
                "output": parsed_output,
                "summary": parsed_output.get("summary", ""),
                "key_findings": parsed_output.get("key_findings", []),
                "comparisons": parsed_output.get("comparisons", []),
                "insights": parsed_output.get("insights", []),
                "data_points": parsed_output.get("data_points", []),
                "feature_matrix": parsed_output.get("feature_matrix"),
                "sources": sources,
                "confidence": parsed_output.get("confidence", 0.5),
                "limitations": parsed_output.get("limitations", []),
                "raw_response": output.get("content", ""),
            }
            
        except Exception as e:
            self.log(f"Task execution failed: {e}", level="error", task_id=task_id)
            return {
                "success": False,
                "task_id": task_id,
                "error": str(e),
            }
    
    async def _generate_search_queries(
        self,
        task_description: str,
        previous_outputs: Dict[str, Any],
        classification: Dict[str, Any],
    ) -> List[str]:
        """Generate multiple search queries for comprehensive coverage."""
        
        # Build context from previous outputs
        context_summary = ""
        if previous_outputs:
            summaries = []
            for tid, output in list(previous_outputs.items())[:3]:
                if isinstance(output, dict) and output.get("summary"):
                    summaries.append(f"- {tid}: {output['summary'][:100]}")
            if summaries:
                context_summary = "\nPrevious findings:\n" + "\n".join(summaries)
        
        entities = classification.get("entities", [])
        domain = classification.get("domain", "")
        
        prompt = f"""Convert this analysis task into 2-3 effective web search queries.

Task: {task_description}
Domain: {domain}
Entities: {', '.join(entities) if entities else 'Not specified'}
{context_summary}

Generate 2-3 different search queries that together will find comprehensive data.
Each query should target different aspects (features, pricing, market data, etc.)

Output as JSON array of strings only:
["query 1", "query 2", "query 3"]"""

        response = await self.llm_service.generate_json(
            prompt=prompt,
            temperature=0.3,
            max_tokens=200,
        )
        
        self.track_llm_usage(response)
        
        if response.get("parsed") and isinstance(response["parsed"], list):
            return response["parsed"]
        
        # Fallback: use task description as single query
        return [task_description]
    
    async def _search(
        self,
        query: str,
        task_description: str,
    ) -> Dict[str, Any]:
        """Search for information."""
        
        # Extract entity name for fallback
        entity_name = None
        words = task_description.split()
        for i, word in enumerate(words):
            if word.lower() in ["for", "of", "about"] and i + 1 < len(words):
                entity_name = words[i + 1]
                break
        
        result = await self.search_service.search_with_fallback(
            query=query,
            entity_name=entity_name,
            max_results=5,
        )
        
        self.cost_tracker.add_search_usage(1, self.name)
        
        return result
    
    def _deduplicate_results(self, results: List[Any]) -> List[Any]:
        """Remove duplicate results based on URL."""
        seen_urls = set()
        unique = []
        for r in results:
            # Handle both object and dict types
            if hasattr(r, 'url'):
                url = r.url or ''
            elif isinstance(r, dict):
                url = r.get('url', '')
            else:
                url = ''
            
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique.append(r)
        return unique
    
    def _prepare_context(
        self,
        search_results: Dict[str, Any],
        use_summarization: bool,
    ) -> str:
        """Prepare context from search results."""
        results = search_results.get("results", [])
        
        context_parts = []
        # Reduced to 5 results max for faster processing
        for i, result in enumerate(results[:5], 1):
            # Handle both object and dict types
            if hasattr(result, 'title'):
                title = result.title or ""
                url = result.url or ""
                content = result.content or ""
            elif isinstance(result, dict):
                title = result.get('title', '')
                url = result.get('url', '')
                content = result.get('content', '')
            else:
                continue
            
            # Truncate content aggressively for speed
            if use_summarization:
                content = str(content)[:300]
            else:
                content = str(content)[:800]
            
            context_parts.append(f"SOURCE {i}: {title}\nURL: {url}\n{content}\n")
        
        return "\n".join(context_parts)
    
    async def _generate_consultancy_output(
        self,
        task_description: str,
        context_text: str,
        previous_outputs: Dict[str, Any],
        classification: Dict[str, Any],
        task_id: str,
    ) -> Dict[str, Any]:
        """Generate consultancy-grade structured output."""
        
        # Include relevant previous outputs (limited)
        prev_context = ""
        if previous_outputs:
            relevant = []
            for tid, output in list(previous_outputs.items())[:2]:
                if isinstance(output, dict):
                    summary = output.get("summary", "")
                    if summary:
                        relevant.append(f"{tid}: {summary[:100]}")
            if relevant:
                prev_context = f"\nPrior: " + "; ".join(relevant)
        
        # Build compact task-specific instructions
        entities = classification.get("entities", [])
        entities_str = ", ".join(entities) if entities else "the subject"
        
        task_specific = ""
        task_lower = task_description.lower()
        
        if "feature" in task_lower or "matrix" in task_lower:
            task_specific = "Include feature_matrix in output comparing key features."
        elif "pricing" in task_lower:
            task_specific = "Include specific pricing tiers and strategy."
        elif "swot" in task_lower:
            task_specific = "SWOT must reference specific competitors."
        elif "competitor" in task_lower:
            task_specific = "Identify 3-5 specific competitors with differentiators."
        
        # Compact prompt
        prompt = f"""TASK: {task_description}
ENTITIES: {entities_str}
{task_specific}

SEARCH DATA:
{context_text[:4000]}
{prev_context}

Analyze and output JSON with: summary, key_findings, insights, data_points, limitations, confidence."""

        response = await self.llm_service.generate_json(
            prompt=prompt,
            system_prompt=EXECUTOR_SYSTEM_PROMPT,
            temperature=0.4,
            max_tokens=1200,  # Reduced for speed
        )
        
        self.track_llm_usage(response, task_id)
        
        return response
