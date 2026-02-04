# Development Guide

Guide for contributing to SmarTunarr development.

---

## Getting Started

### Prerequisites

- **Python 3.11+** - Backend
- **Node.js 18+** - Frontend
- **Docker** - Optional, for containerized development
- **Git** - Version control

### Clone Repository

```bash
git clone https://github.com/sharkhunterr/smartunarr.git
cd smartunarr
```

### Quick Setup

```bash
# Install all dependencies
npm run setup

# Start development servers
npm run dev
```

This starts:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:4273
- **API Docs**: http://localhost:4273/docs

---

## Project Structure

```
smartunarr/
├── src/
│   ├── backend/              # Python FastAPI backend
│   │   ├── app/
│   │   │   ├── api/          # REST API routes
│   │   │   │   └── routes/   # Route modules
│   │   │   ├── adapters/     # External service adapters
│   │   │   ├── core/         # Business logic
│   │   │   ├── db/           # Database setup
│   │   │   ├── models/       # SQLAlchemy models
│   │   │   ├── schemas/      # Pydantic schemas
│   │   │   ├── services/     # Application services
│   │   │   └── utils/        # Utilities
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── frontend/             # React TypeScript frontend
│       ├── src/
│       │   ├── components/   # React components
│       │   ├── pages/        # Page components
│       │   ├── services/     # API services
│       │   ├── types/        # TypeScript types
│       │   └── i18n/         # Translations
│       ├── package.json
│       └── Dockerfile
│
├── docker/                   # Docker configuration
│   ├── Dockerfile            # Multi-stage production build
│   ├── docker-compose.yml
│   └── supervisord.conf
│
├── docs/                     # Documentation
├── scripts/                  # Build and release scripts
└── package.json              # Root package.json
```

---

## Backend Development

### Setup

```bash
cd src/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Start development server
uvicorn app.main:app --reload --port 4273
```

### Project Layout

```
app/
├── __init__.py           # App metadata
├── main.py               # FastAPI application
├── config.py             # Configuration settings
│
├── api/
│   ├── __init__.py
│   ├── deps.py           # Dependency injection
│   └── routes/
│       ├── channels.py
│       ├── profiles.py
│       ├── programming.py
│       ├── scoring.py
│       ├── schedules.py
│       ├── history.py
│       ├── services.py
│       └── ai.py
│
├── adapters/             # External service integrations
│   ├── plex.py
│   ├── tunarr.py
│   ├── tmdb.py
│   └── ollama.py
│
├── core/                 # Business logic
│   ├── scoring.py        # 9-criterion scoring engine
│   ├── programming.py    # Schedule generation
│   ├── blocks.py         # Time block logic
│   └── scheduler.py      # APScheduler manager
│
├── models/               # SQLAlchemy models
│   ├── profile.py
│   ├── history.py
│   ├── schedule.py
│   └── service.py
│
├── schemas/              # Pydantic schemas
│   ├── profile.py
│   ├── programming.py
│   ├── scoring.py
│   └── common.py
│
├── services/             # Application services
│   ├── profile_service.py
│   ├── history_service.py
│   └── schedule_service.py
│
└── utils/
    └── encryption.py     # Credential encryption
```

### Adding a New Route

1. Create route file in `app/api/routes/`:

```python
# app/api/routes/my_feature.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.my_feature import MyFeatureRequest, MyFeatureResponse

router = APIRouter()

@router.get("/", response_model=list[MyFeatureResponse])
async def list_items(db: AsyncSession = Depends(get_db)):
    """List all items."""
    # Implementation
    pass

@router.post("/", response_model=MyFeatureResponse)
async def create_item(
    data: MyFeatureRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create new item."""
    # Implementation
    pass
```

2. Register in `app/main.py`:

```python
from app.api.routes import my_feature

app.include_router(
    my_feature.router,
    prefix="/api/v1/my-feature",
    tags=["my-feature"]
)
```

### Adding a New Model

1. Create model in `app/models/`:

```python
# app/models/my_model.py
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.sql import func

from app.db.base import BaseModel

class MyModel(BaseModel):
    __tablename__ = "my_models"

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
```

2. Export in `app/models/__init__.py`:

```python
from app.models.my_model import MyModel
```

3. Create Pydantic schemas in `app/schemas/`:

```python
# app/schemas/my_model.py
from pydantic import BaseModel
from datetime import datetime

class MyModelBase(BaseModel):
    name: str
    description: str | None = None

class MyModelCreate(MyModelBase):
    pass

class MyModelResponse(MyModelBase):
    id: str
    enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True
```

### Testing

```bash
# Run tests
pytest

# With coverage
pytest --cov=app

# Specific test file
pytest tests/test_scoring.py
```

---

## Frontend Development

### Setup

```bash
cd src/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Layout

```
src/
├── main.tsx              # Application entry
├── App.tsx               # Root component
├── vite-env.d.ts         # Vite types
│
├── components/
│   ├── layout/           # Layout components
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── common/           # Shared components
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   └── Table.tsx
│   ├── profiles/         # Profile components
│   ├── programming/      # Programming components
│   ├── scoring/          # Scoring components
│   └── scheduling/       # Scheduling components
│
├── pages/
│   ├── DashboardPage.tsx
│   ├── ProfilesPage.tsx
│   ├── ProgrammingPage.tsx
│   ├── ScoringPage.tsx
│   ├── SchedulingPage.tsx
│   ├── HistoryPage.tsx
│   └── SettingsPage.tsx
│
├── services/
│   └── api.ts            # API client
│
├── types/
│   └── index.ts          # TypeScript types
│
└── i18n/
    ├── index.ts          # i18n configuration
    └── locales/
        ├── en.json
        ├── fr.json
        ├── de.json
        ├── es.json
        └── it.json
```

### Adding a New Component

```tsx
// src/components/my-feature/MyComponent.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    await onAction();
    setLoading(false);
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold">{title}</h2>
      <button
        onClick={handleClick}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {loading ? t('common.loading') : t('common.submit')}
      </button>
    </div>
  );
}
```

### Adding a New Page

1. Create page component:

```tsx
// src/pages/MyFeaturePage.tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';

export function MyFeaturePage() {
  const { t } = useTranslation();
  const [data, setData] = useState([]);

  useEffect(() => {
    api.myFeature.list().then(setData);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        {t('myFeature.title')}
      </h1>
      {/* Page content */}
    </div>
  );
}
```

2. Add route in `App.tsx`:

```tsx
import { MyFeaturePage } from './pages/MyFeaturePage';

// In routes
<Route path="/my-feature" element={<MyFeaturePage />} />
```

3. Add navigation in `Sidebar.tsx`

### API Service

```typescript
// src/services/api.ts
export const myFeatureApi = {
  list: async () => {
    const response = await fetch(`${API_BASE}/my-feature`);
    return response.json();
  },

  create: async (data: MyFeatureCreate) => {
    const response = await fetch(`${API_BASE}/my-feature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },
};
```

### Internationalization

Add translations to all locale files:

```json
// src/i18n/locales/en.json
{
  "myFeature": {
    "title": "My Feature",
    "description": "Feature description",
    "actions": {
      "create": "Create",
      "edit": "Edit",
      "delete": "Delete"
    }
  }
}
```

```json
// src/i18n/locales/fr.json
{
  "myFeature": {
    "title": "Ma Fonctionnalité",
    "description": "Description de la fonctionnalité",
    "actions": {
      "create": "Créer",
      "edit": "Modifier",
      "delete": "Supprimer"
    }
  }
}
```

### Linting

```bash
# Run linter
npm run lint

# Fix issues
npm run lint -- --fix
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Profiles│  │Program. │  │ Scoring │  │Schedule │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       └────────────┴────────────┴────────────┘              │
│                         │ HTTP/SSE                          │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                    API Layer                                 │
│  ┌─────────────────────┴─────────────────────┐              │
│  │              FastAPI Routes                │              │
│  └─────────────────────┬─────────────────────┘              │
│                        │                                     │
│  ┌─────────────────────┼─────────────────────┐              │
│  │             Service Layer                  │              │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐   │              │
│  │  │ Profile │  │ History │  │Schedule │   │              │
│  │  │ Service │  │ Service │  │ Service │   │              │
│  │  └────┬────┘  └────┬────┘  └────┬────┘   │              │
│  └───────┼────────────┼────────────┼────────┘              │
│          │            │            │                        │
│  ┌───────┴────────────┴────────────┴────────┐              │
│  │              Core Logic                   │              │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │              │
│  │  │ Scoring │  │Program. │  │ Blocks  │  │              │
│  │  └─────────┘  └─────────┘  └─────────┘  │              │
│  └──────────────────────────────────────────┘              │
│                        │                                     │
│  ┌─────────────────────┼─────────────────────┐              │
│  │              Data Layer                    │              │
│  │  ┌─────────┐  ┌─────────────────────────┐│              │
│  │  │ SQLite  │  │       Adapters          ││              │
│  │  │   DB    │  │ Plex│Tunarr│TMDB│Ollama ││              │
│  │  └─────────┘  └─────────────────────────┘│              │
│  └───────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Scoring Engine Flow

```
┌────────────┐
│   Media    │
│  Content   │
└─────┬──────┘
      │
      ▼
┌─────────────────────────────────────────┐
│           9 Criteria Evaluation          │
│  ┌─────┐ ┌────────┐ ┌───────┐ ┌──────┐ │
│  │Type │ │Duration│ │ Genre │ │Timing│ │
│  └──┬──┘ └───┬────┘ └───┬───┘ └──┬───┘ │
│     │        │          │        │      │
│  ┌──┴──┐ ┌───┴───┐ ┌────┴──┐ ┌──┴───┐  │
│  │Strat│ │  Age  │ │Rating │ │Filter│  │
│  └──┬──┘ └───┬───┘ └───┬───┘ └──┬───┘  │
│     │        │         │        │       │
│     └────────┴─────────┴────────┘       │
│                  │ ┌───────┐            │
│                  └─│ Bonus │            │
│                    └───┬───┘            │
└────────────────────────┼────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Weighted Sum │
                  │  + M/F/P     │
                  │  Adjustments │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Final Score  │
                  │   (0-100)    │
                  └──────────────┘
```

---

## Docker Development

### Build Image

```bash
# Build production image
docker build -t smartunarr:dev -f docker/Dockerfile .

# Build with specific platform
docker build --platform linux/amd64 -t smartunarr:dev -f docker/Dockerfile .
```

### Run Container

```bash
docker run -d \
  --name smartunarr-dev \
  -p 3000:3000 \
  -p 4273:4273 \
  -v $(pwd)/data:/app/data \
  smartunarr:dev
```

### Multi-Platform Build

```bash
# Create builder
docker buildx create --name multiarch --use

# Build and push
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t sharkhunterr/smartunarr:dev \
  --push \
  -f docker/Dockerfile .
```

---

## Release Process

### Version Bump

```bash
# Patch release (0.1.0 -> 0.1.1)
npm run release

# Minor release (0.1.0 -> 0.2.0)
npm run release:minor

# Major release (0.1.0 -> 1.0.0)
npm run release:major
```

### Full Release

```bash
# Release to GitLab, GitHub, and Docker Hub
npm run release:full
```

See [Scripts README](../scripts/README.md) for detailed release documentation.

---

## Code Style

### Python

- Follow PEP 8
- Use type hints
- Docstrings for public functions
- Line length: 100 characters

```python
def calculate_score(
    content: MediaContent,
    block: TimeBlock,
    weights: dict[str, float]
) -> float:
    """
    Calculate content score for a time block.

    Args:
        content: Media content to score
        block: Time block with criteria
        weights: Scoring weights

    Returns:
        Score between 0 and 100
    """
    pass
```

### TypeScript

- Use TypeScript strict mode
- Prefer functional components
- Use proper typing

```typescript
interface Props {
  title: string;
  onSubmit: (data: FormData) => Promise<void>;
}

export function MyComponent({ title, onSubmit }: Props) {
  // ...
}
```

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes
4. Run tests and linting
5. Commit with conventional commits: `git commit -m "feat: add my feature"`
6. Push to branch: `git push origin feature/my-feature`
7. Create Pull Request

### Commit Convention

| Prefix | Description |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `style:` | Code style (formatting) |
| `refactor:` | Code refactoring |
| `test:` | Tests |
| `chore:` | Maintenance |

---

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [SQLAlchemy](https://www.sqlalchemy.org/)
- [Pydantic](https://docs.pydantic.dev/)
