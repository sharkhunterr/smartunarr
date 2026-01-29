# SmartTunarr

Intelligent TV channel programming system for Tunarr. Generate optimized channel schedules using JSON profiles, AI-assisted generation, and multi-criteria scoring.

## Features

- **Profile-Based Programming**: Define time blocks, content criteria, and scoring weights in JSON profiles
- **9-Criterion Scoring Engine**: Type, duration, genre, timing, strategy, age rating, TMDB rating, filters, and bonuses
- **AI Profile Generation**: Use Ollama to generate profiles from natural language descriptions
- **Real-time Progress**: WebSocket-based progress tracking for long-running operations
- **Multi-iteration Optimization**: Run N iterations and keep the best-scoring schedule
- **External Service Integration**: Plex, Tunarr, TMDB, and Ollama support
- **Dark/Light Theme**: Customizable UI with French and English translations

## Architecture

```
smarttunarr/
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── api/       # REST API routes
│   │   ├── adapters/  # External service adapters (Plex, Tunarr, Ollama)
│   │   ├── core/      # Business logic (scoring, programming, blocks)
│   │   ├── db/        # Database setup and indexes
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Application services
│   │   └── utils/     # Utilities (encryption)
│   └── Dockerfile
├── frontend/          # Vue.js 3 frontend
│   ├── src/
│   │   ├── components/  # Vue components
│   │   ├── views/       # Page views
│   │   ├── stores/      # Pinia stores
│   │   ├── services/    # API and WebSocket services
│   │   ├── i18n/        # Translations (fr, en)
│   │   └── assets/      # CSS themes
│   └── Dockerfile
└── docker-compose.yml  # Production deployment
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Plex Media Server (with API token)
- Tunarr server
- (Optional) Ollama for AI features
- (Optional) TMDB API key for metadata enrichment

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/your-repo/smarttunarr.git
cd smarttunarr
```

2. Copy environment file:
```bash
cp backend/.env.example backend/.env
```

3. Edit `.env` with your settings:
```env
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///./data/smarttunarr.db
PLEX_URL=http://localhost:32400
PLEX_TOKEN=your-plex-token
TUNARR_URL=http://localhost:8000
TMDB_API_KEY=your-tmdb-key
OLLAMA_URL=http://localhost:11434
```

4. Start with Docker Compose:
```bash
docker-compose up -d
```

5. Access the application:
- Frontend: http://localhost:80
- Backend API: http://localhost:8080/api/v1
- API Docs: http://localhost:8080/docs

### Manual Development

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Usage

### 1. Configure Services

Navigate to **Settings** and configure your external services:
- **Plex**: Server URL and authentication token
- **Tunarr**: Server URL and optional credentials
- **TMDB**: API key for metadata enrichment
- **Ollama**: Server URL for AI features

Test each connection to ensure proper configuration.

### 2. Create a Profile

Profiles define how content should be scheduled. You can:

- **Manual Creation**: Create profiles via the Profiles page
- **AI Generation**: Use natural language to describe your desired schedule
- **Import**: Import existing JSON profile files

Example profile structure:
```json
{
  "name": "Action Movie Night",
  "time_blocks": [
    {
      "name": "Prime Time",
      "start_time": "20:00",
      "end_time": "23:00",
      "criteria": {
        "content_types": ["movie"],
        "genres": {"include": ["Action", "Thriller"]},
        "age_rating": {"max_rating": "R"}
      }
    }
  ],
  "scoring_weights": {
    "type": 1.0,
    "duration": 1.5,
    "genre": 2.0,
    "timing": 1.0
  }
}
```

### 3. Generate Programming

1. Go to **Programming**
2. Select a channel from Tunarr
3. Select a profile
4. Set number of iterations (more = better results, slower)
5. Click **Start Programming**
6. Review the generated schedule
7. Apply to Tunarr if satisfied

### 4. Analyze Existing Programming

1. Go to **Scoring**
2. Select a channel and profile
3. Click **Analyze**
4. Review per-program scores and violations
5. Export results as CSV or JSON

## API Reference

### Programming

- `POST /api/v1/programming/generate` - Generate channel programming
- `POST /api/v1/programming/preview` - Preview without applying

### Scoring

- `POST /api/v1/scoring/analyze` - Analyze existing programming
- `POST /api/v1/scoring/export` - Export analysis results

### Profiles

- `GET /api/v1/profiles` - List all profiles
- `POST /api/v1/profiles` - Create profile
- `GET /api/v1/profiles/{id}` - Get profile
- `PUT /api/v1/profiles/{id}` - Update profile
- `DELETE /api/v1/profiles/{id}` - Delete profile
- `POST /api/v1/profiles/import` - Import profile
- `GET /api/v1/profiles/{id}/export` - Export profile

### AI

- `POST /api/v1/ai/generate-profile` - Generate profile from description
- `POST /api/v1/ai/modify-profile` - Modify profile with AI
- `GET /api/v1/ai/models` - List available Ollama models

### Services

- `GET /api/v1/services` - List service configurations
- `PUT /api/v1/services/{type}` - Update service config
- `POST /api/v1/services/{type}/test` - Test connection
- `GET /api/v1/services/plex/libraries` - List Plex libraries
- `GET /api/v1/services/tunarr/channels` - List Tunarr channels

### WebSocket

- `WS /api/v1/ws/jobs` - Real-time job progress updates

## Scoring Criteria

The scoring engine evaluates content based on 9 criteria:

| Criterion | Description |
|-----------|-------------|
| Type | Content type matches block requirements (movie, episode) |
| Duration | Content duration fits within block time |
| Genre | Genre matches block preferences |
| Timing | Content is placed in appropriate time block |
| Strategy | Sequence and filler rules are followed |
| Age | Age rating complies with block restrictions |
| Rating | TMDB rating meets threshold requirements |
| Filter | Keyword and studio filters are respected |
| Bonus | Additional points for matching bonus conditions |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Tunarr](https://github.com/chrisbenincasa/tunarr) - IPTV channel manager
- [Plex](https://www.plex.tv/) - Media server
- [TMDB](https://www.themoviedb.org/) - Movie database
- [Ollama](https://ollama.ai/) - Local LLM inference
