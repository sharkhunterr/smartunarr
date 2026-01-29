# Quickstart Guide: SmartTunarr Development

**Feature**: 001-tv-channel-programming
**Date**: 2026-01-27

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (for production)
- Access to: Tunarr instance, Plex server, TMDB API key

## Project Structure

```
smarttunarr/
├── backend/                  # Python FastAPI backend
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── routes/
│   │   │   │   ├── programming.py
│   │   │   │   ├── scoring.py
│   │   │   │   ├── profiles.py
│   │   │   │   ├── channels.py
│   │   │   │   ├── services.py
│   │   │   │   ├── history.py
│   │   │   │   ├── ai.py
│   │   │   │   └── settings.py
│   │   │   └── websocket.py
│   │   ├── core/
│   │   │   ├── scoring/
│   │   │   │   ├── engine.py
│   │   │   │   ├── criteria/
│   │   │   │   │   ├── type_criterion.py
│   │   │   │   │   ├── duration_criterion.py
│   │   │   │   │   ├── genre_criterion.py
│   │   │   │   │   ├── timing_criterion.py
│   │   │   │   │   ├── strategy_criterion.py
│   │   │   │   │   ├── age_criterion.py
│   │   │   │   │   ├── rating_criterion.py
│   │   │   │   │   ├── filter_criterion.py
│   │   │   │   │   └── bonus_criterion.py
│   │   │   │   └── result.py
│   │   │   ├── programming/
│   │   │   │   ├── generator.py
│   │   │   │   ├── optimizer.py
│   │   │   │   └── validator.py
│   │   │   ├── blocks/
│   │   │   │   └── time_block_manager.py
│   │   │   └── orchestrator.py
│   │   ├── adapters/
│   │   │   ├── tunarr_adapter.py
│   │   │   ├── plex_adapter.py
│   │   │   └── metadata/
│   │   │       ├── cache_adapter.py
│   │   │       └── tmdb_adapter.py
│   │   ├── services/
│   │   │   ├── tunarr_service.py
│   │   │   ├── plex_service.py
│   │   │   ├── tmdb_service.py
│   │   │   └── ollama_service.py
│   │   ├── models/
│   │   │   ├── profile.py
│   │   │   ├── content.py
│   │   │   ├── channel.py
│   │   │   ├── program.py
│   │   │   ├── scoring.py
│   │   │   ├── service.py
│   │   │   └── history.py
│   │   ├── schemas/
│   │   │   ├── profile_schema.py
│   │   │   ├── programming_schema.py
│   │   │   ├── scoring_schema.py
│   │   │   └── service_schema.py
│   │   ├── db/
│   │   │   ├── database.py
│   │   │   └── migrations/
│   │   └── config.py
│   ├── tests/
│   │   ├── unit/
│   │   │   └── core/
│   │   │       └── scoring/
│   │   └── integration/
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/                 # Vue.js frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── programming/
│   │   │   ├── scoring/
│   │   │   ├── profiles/
│   │   │   ├── timeline/
│   │   │   └── common/
│   │   ├── views/
│   │   │   ├── ProgrammingView.vue
│   │   │   ├── ScoringView.vue
│   │   │   ├── ProfilesView.vue
│   │   │   ├── HistoryView.vue
│   │   │   └── SettingsView.vue
│   │   ├── stores/
│   │   │   ├── programming.ts
│   │   │   ├── profiles.ts
│   │   │   ├── channels.ts
│   │   │   └── settings.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── i18n/
│   │   │   ├── fr.json
│   │   │   └── en.json
│   │   ├── themes/
│   │   │   ├── light.css
│   │   │   └── dark.css
│   │   ├── App.vue
│   │   └── main.ts
│   ├── package.json
│   └── vite.config.ts
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── specs/                    # Speckit artifacts
│   └── 001-tv-channel-programming/
└── README.md
```

## Local Development Setup

### 1. Backend Setup

```bash
# Create virtual environment
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=sqlite:///./smarttunarr.db
PLEX_URL=http://localhost:32400
PLEX_TOKEN=your_plex_token
TMDB_API_KEY=your_tmdb_api_key
TUNARR_URL=http://localhost:8000
TUNARR_USERNAME=admin
TUNARR_PASSWORD=admin
OLLAMA_URL=http://localhost:11434
LOG_LEVEL=DEBUG
EOF

# Initialize database
python -m app.db.init

# Run development server
uvicorn app.main:app --reload --port 8080
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
VITE_API_URL=http://localhost:8080/api/v1
VITE_WS_URL=ws://localhost:8080/ws
EOF

# Run development server
npm run dev
```

### 3. Access Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs

## Development Workflow

### Adding a New Scoring Criterion

1. Create criterion class in `backend/app/core/scoring/criteria/`:

```python
# new_criterion.py
from .base_criterion import BaseCriterion

class NewCriterion(BaseCriterion):
    name = "new"
    weight_key = "new"

    def calculate(self, content, profile, block=None):
        # Return score 0-100
        return score
```

2. Register in `backend/app/core/scoring/engine.py`:

```python
from .criteria.new_criterion import NewCriterion

class ScoringEngine:
    criteria = [
        # ... existing criteria
        NewCriterion(),
    ]
```

3. Add weight to profile schema in `backend/app/schemas/profile_schema.py`

4. Add tests in `backend/tests/unit/core/scoring/test_new_criterion.py`

### Adding a New API Endpoint

1. Create route in `backend/app/api/routes/`:

```python
from fastapi import APIRouter

router = APIRouter(prefix="/new", tags=["New"])

@router.get("/")
async def list_items():
    pass
```

2. Register in `backend/app/api/__init__.py`

3. Update OpenAPI spec in `specs/001-tv-channel-programming/contracts/openapi.yaml`

### Adding a New Vue Component

1. Create component in `frontend/src/components/`:

```vue
<script setup lang="ts">
// Component logic
</script>

<template>
  <!-- Template -->
</template>

<style scoped>
/* Styles */
</style>
```

2. Add translations to `frontend/src/i18n/fr.json` and `en.json`

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/unit/core/scoring/test_engine.py

# Run scoring tests (critical path)
pytest tests/unit/core/scoring/ -v
```

### Frontend Tests

```bash
cd frontend

# Run unit tests
npm run test:unit

# Run e2e tests
npm run test:e2e
```

## Docker Build

```bash
# Build image
docker build -t smarttunarr:latest -f docker/Dockerfile .

# Run container
docker run -d \
  -p 8080:8080 \
  -v smarttunarr_data:/data \
  -e PLEX_URL=http://host.docker.internal:32400 \
  -e PLEX_TOKEN=your_token \
  -e TMDB_API_KEY=your_key \
  -e TUNARR_URL=http://host.docker.internal:8000 \
  smarttunarr:latest
```

## Key Dependencies

### Backend

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.109+ | Web framework |
| uvicorn | 0.27+ | ASGI server |
| pydantic | 2.5+ | Data validation |
| sqlalchemy | 2.0+ | ORM |
| httpx | 0.26+ | Async HTTP client |
| plexapi | 4.15+ | Plex integration |
| ollama | 0.1+ | Ollama integration |

### Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| vue | 3.4+ | UI framework |
| typescript | 5.3+ | Type safety |
| pinia | 2.1+ | State management |
| vue-router | 4.2+ | Routing |
| vue-i18n | 9.9+ | Internationalization |
| axios | 1.6+ | HTTP client |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | No | sqlite:///./smarttunarr.db | Database connection |
| PLEX_URL | Yes | - | Plex server URL |
| PLEX_TOKEN | Yes | - | Plex auth token |
| TMDB_API_KEY | No | - | TMDB API key |
| TUNARR_URL | Yes | - | Tunarr server URL |
| TUNARR_USERNAME | No | - | Tunarr username |
| TUNARR_PASSWORD | No | - | Tunarr password |
| OLLAMA_URL | No | http://localhost:11434 | Ollama server URL |
| LOG_LEVEL | No | INFO | Logging level |

## Performance Targets

| Metric | Target | Test Command |
|--------|--------|--------------|
| 24h programming (10 iter) | < 2 min | `pytest tests/perf/test_programming.py` |
| UI response | < 200ms | Frontend Lighthouse |
| Cache 30K films | No degradation | `pytest tests/perf/test_cache.py` |
| Score reproducibility | 100% | `pytest tests/unit/core/scoring/test_determinism.py` |
