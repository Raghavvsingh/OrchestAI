#!/bin/bash
# Quick restart script for testing

echo "🔄 Restarting OrchestAI backend..."
echo "📊 Summary of fixes applied:"
echo "  ✅ Fixed DAG cycle detection (planner.py)"
echo "  ✅ Fixed database schema (nullable columns, enum types)" 
echo "  ✅ Fixed logs API (NULL timestamp handling)"
echo "  ✅ Added planning timeouts and error handling"
echo "  ✅ Added detailed progress logging"
echo ""
echo "🚀 Please restart your uvicorn server:"
echo "   cd backend"  
echo "   uvicorn main:app --reload --port 8000"
echo ""
echo "🧪 Then test by creating a new analysis:"
echo "   Goal: 'Analyze Swiggy'"
echo "   Expected: Tasks should plan quickly and show progress"
echo ""