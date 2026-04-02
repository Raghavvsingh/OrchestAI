"""Search Service - Tavily API wrapper with fallback strategies."""

import logging
from typing import Dict, Any, Optional, List
import time
import asyncio

from tavily import TavilyClient, AsyncTavilyClient
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from config import get_settings
from models.schemas import SearchResult

logger = logging.getLogger(__name__)
settings = get_settings()


def safe_get(obj: Any, key: str, default: Any = None) -> Any:
    """Safely get attribute or key from object or dict."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


class SearchService:
    """Service for web search using Tavily API."""
    
    def __init__(self):
        self.client = TavilyClient(api_key=settings.tavily_api_key)
        self.async_client = AsyncTavilyClient(api_key=settings.tavily_api_key)
        self.total_searches = 0
        self.search_timeout = 30  # 30 second timeout for searches
    
    @retry(
        stop=stop_after_attempt(2),  # Reduced from 3
        wait=wait_exponential(multiplier=1, min=2, max=8),
        retry=retry_if_exception_type((Exception,)),
    )
    async def search(
        self,
        query: str,
        search_depth: str = "basic",
        max_results: int = 5,
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Perform a search using Tavily API with timeout."""
        start_time = time.time()
        
        try:
            kwargs = {
                "query": query[:400],  # Limit query length
                "search_depth": search_depth,
                "max_results": min(max_results, 5),  # Cap at 5
            }
            
            if include_domains:
                kwargs["include_domains"] = include_domains
            if exclude_domains:
                kwargs["exclude_domains"] = exclude_domains
            
            logger.info(f"Tavily search: {query[:60]}...")
            
            # Add timeout wrapper
            response = await asyncio.wait_for(
                self.async_client.search(**kwargs),
                timeout=self.search_timeout
            )
            
            self.total_searches += 1
            latency = int((time.time() - start_time) * 1000)
            
            # Handle response - could be dict or object
            raw_results = safe_get(response, "results", []) or []
            
            results = []
            for item in raw_results[:max_results]:
                # Handle both dict and object responses
                title = safe_get(item, "title", "")
                url = safe_get(item, "url", "")
                content = safe_get(item, "content", "")
                score = safe_get(item, "score", 0.0)
                
                results.append(SearchResult(
                    title=str(title) if title else "",
                    url=str(url) if url else "",
                    content=str(content)[:1000] if content else "",  # Limit content size
                    score=float(score) if score else 0.0,
                ))
            
            logger.info(f"Search done: {len(results)} results in {latency}ms")
            
            return {
                "query": query,
                "results": results,
                "answer": safe_get(response, "answer"),
                "latency_ms": latency,
            }
            
        except asyncio.TimeoutError:
            logger.error(f"Tavily search timeout after {self.search_timeout}s")
            raise
        except Exception as e:
            logger.error(f"Tavily search error: {e}")
            raise
    
    async def search_with_fallback(
        self,
        query: str,
        entity_name: Optional[str] = None,
        max_results: int = 5,
    ) -> Dict[str, Any]:
        """Search with fallback strategies."""
        
        # Strategy 1: Direct search
        try:
            result = await self.search(query, max_results=max_results)
            if result["results"]:
                return result
        except Exception as e:
            logger.warning(f"Primary search failed: {e}")
        
        # Strategy 2: Simplified query (use first part only)
        simplified_query = " ".join(query.split()[:8])
        try:
            result = await self.search(simplified_query, max_results=max_results)
            if result["results"]:
                return result
        except Exception as e:
            logger.warning(f"Simplified search failed: {e}")
        
        # Strategy 3: Entity name only
        if entity_name:
            try:
                result = await self.search(entity_name, max_results=max_results)
                if result["results"]:
                    return result
            except Exception as e:
                logger.warning(f"Entity search failed: {e}")
        
        # Return empty result
        return {
            "query": query,
            "results": [],
            "answer": None,
            "error": "All search strategies failed",
            "latency_ms": 0,
        }
    
    async def search_comparison(
        self,
        entity1: str,
        entity2: str,
        aspect: str,
    ) -> Dict[str, Any]:
        """Search for comparison between two entities."""
        query = f"{entity1} vs {entity2} {aspect} comparison"
        return await self.search_with_fallback(query, max_results=5)
    
    async def search_entity(
        self,
        entity: str,
        aspects: List[str],
    ) -> Dict[str, Any]:
        """Search for multiple aspects of an entity."""
        all_results = []
        
        for aspect in aspects[:3]:  # Limit to 3 aspects
            query = f"{entity} {aspect}"
            result = await self.search(query, max_results=3)
            all_results.extend(result.get("results", []))
        
        return {
            "entity": entity,
            "results": all_results,
            "aspects": aspects,
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get search statistics."""
        return {
            "total_searches": self.total_searches,
        }


# Singleton instance
_search_service: Optional[SearchService] = None


def get_search_service() -> SearchService:
    """Get or create search service instance."""
    global _search_service
    if _search_service is None:
        _search_service = SearchService()
    return _search_service
