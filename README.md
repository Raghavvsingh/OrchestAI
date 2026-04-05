# OrchestAI - Multi-Agent Task Execution System

A production-grade multi-agent system for competitive analysis workflows that dynamically plans tasks, executes with real-world data, validates outputs, and produces consultancy-grade reports.

## 🏗️ Architecture

```
Frontend (React) → FastAPI Backend → Coordinator Agent (brain)
                                   → Planner Agent (LLM-based DAG)
                                   → Executor Agent (Tavily + LLM RAG)
                                   → Validator Agent (multi-layer)
                                   → NeonDB (PostgreSQL - durable state)
```

## ✨ Features

- **Dynamic Planning**: LLM-based task DAG generation based on goal type
- **RAG Pipeline**: Tavily search + LLM for data-backed outputs
- **Multi-layer Validation**: Schema + rules + LLM critique
- **Durable Execution**: Checkpoint after every step, resume on failure
- **Feedback Loop**: Validation → Correction → Retry
- **Human-in-the-Loop**: Review queue for critical outputs
- **Cost Tracking**: Token usage and cost estimation
- **Real-time Updates**: WebSocket for live progress

## 🚀 Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- NeonDB account (or any PostgreSQL)

### Backend Setup

```bash
# From project root
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r ../requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
# From project root
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 📊 Example Goals

1. **Comparison**: "Compare Notion vs Obsidian"
2. **Single Entity**: "Analyze Swiggy"
3. **Startup Idea**: "Analyze startup idea: AI fitness app for students"

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/start-analysis` | Start a new analysis |
| GET | `/api/status/{run_id}` | Get run status |
| GET | `/api/result/{run_id}` | Get final report |
| POST | `/api/approve/{run_id}` | Approve/reject result |
| GET | `/api/logs/{run_id}` | Get execution logs |
| POST | `/api/resume/{run_id}` | Resume failed run |
| WS | `/api/ws/{run_id}` | WebSocket for live updates |

## 🔧 Configuration

Environment variables (`.env`):

```env
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
DATABASE_URL=postgresql://...
MAX_RETRIES=3
MAX_TASKS=10
LLM_MODEL=gpt-4o-mini
COST_LIMIT_USD=5.0
```

## 📁 Project Structure

```
OrchestAI_VSCode/
├── backend/
│   ├── main.py              # FastAPI entry
│   ├── config.py            # Settings
│   ├── database.py          # NeonDB connection
│   ├── models/
│   │   ├── schemas.py       # Pydantic models
│   │   └── db_models.py     # SQLAlchemy models
│   ├── agents/
│   │   ├── base_agent.py    # Base class
│   │   ├── planner.py       # Task planning
│   │   ├── executor.py      # RAG execution
│   │   ├── validator.py     # Validation
│   │   └── coordinator.py   # Orchestration
│   ├── services/
│   │   ├── llm_service.py   # OpenAI wrapper
│   │   ├── search_service.py # Tavily wrapper
│   │   └── cost_tracker.py  # Cost tracking
│   └── routes/
│       └── analysis.py      # API routes
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── InputPage.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── TaskGraph.jsx
│   │   │   ├── LogViewer.jsx
│   │   │   └── ReportView.jsx
│   │   └── services/
│   │       └── api.js
│   └── package.json
├── .env
└── requirements.txt
```

## ⚠️ Failure Handling

The system handles these scenarios automatically:

1. **Vague tasks** → Replan with stricter prompt
2. **Empty output** → Retry with better query
3. **3+ failures** → Mark FAILED, continue
4. **Dependency failed** → Block dependent tasks
5. **API failure** → Exponential backoff + fallback
6. **Cost explosion** → Summarization mode
7. **DB failure** → Retry with backoff
8. **Crash** → Resume from checkpoint

## 📈 Output Structure

Final reports include:
- Task-by-task findings
- Key data points with sources
- Confidence scores
- SWOT analysis (when applicable)
- Cost breakdown

## 🔒 Security Notes

- API keys are stored in `.env` (not committed)
- Database uses SSL connection
- CORS configured for local development
