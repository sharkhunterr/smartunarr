# Configuration Guide

Complete configuration reference for SmarTunarr.

---

## Environment Variables

### Application Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_NAME` | `SmarTunarr` | Application name |
| `DEBUG` | `false` | Enable debug mode |
| `LOG_LEVEL` | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`) |
| `SECRET_KEY` | Auto-generated | Encryption key for credentials |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./smartunarr.db` | Database connection string |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8080` | Server port |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |

### External Services

| Variable | Default | Description |
|----------|---------|-------------|
| `PLEX_URL` | - | Plex server URL |
| `PLEX_TOKEN` | - | Plex authentication token |
| `TUNARR_URL` | - | Tunarr server URL |
| `TUNARR_USERNAME` | - | Tunarr username (optional) |
| `TUNARR_PASSWORD` | - | Tunarr password (optional) |
| `TMDB_API_KEY` | - | TMDB API key |
| `TMDB_RATE_LIMIT` | `40` | TMDB requests per 10 seconds |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_DEFAULT_MODEL` | `llama3.2` | Default Ollama model |

---

## Configuration Files

### .env File

Create a `.env` file in the backend directory:

```env
# Application
APP_NAME=SmarTunarr
DEBUG=false
LOG_LEVEL=INFO

# Database
DATABASE_URL=sqlite+aiosqlite:///./smartunarr.db

# Plex (Required)
PLEX_URL=http://localhost:32400
PLEX_TOKEN=your_plex_token_here

# Tunarr (Required)
TUNARR_URL=http://localhost:8000
TUNARR_USERNAME=
TUNARR_PASSWORD=

# TMDB (Optional)
TMDB_API_KEY=your_tmdb_api_key
TMDB_RATE_LIMIT=40

# Ollama (Optional)
OLLAMA_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=llama3.2

# Security
SECRET_KEY=your-secret-key-here

# Server
HOST=0.0.0.0
PORT=8080
```

### Docker Compose

```yaml
version: '3.8'

services:
  smartunarr:
    image: sharkhunterr/smartunarr:latest
    container_name: smartunarr
    ports:
      - "3000:3000"   # Web UI
      - "4273:4273"   # API
    volumes:
      - smartunarr-data:/app/data
    environment:
      # Logging
      - LOG_LEVEL=INFO

      # Database
      - DATABASE_URL=sqlite+aiosqlite:///data/smartunarr.db

      # External Services (configure via UI recommended)
      # - PLEX_URL=http://plex:32400
      # - PLEX_TOKEN=xxxx
      # - TUNARR_URL=http://tunarr:8000
      # - TMDB_API_KEY=xxxx
      # - OLLAMA_URL=http://ollama:11434

    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4273/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  smartunarr-data:
```

---

## Service Configuration

Services can be configured via the UI (recommended) or environment variables.

### Plex

**UI Configuration** (Settings → Services → Plex):
- URL: Your Plex server address
- Token: X-Plex-Token

**Getting your Plex Token:**

1. Sign in to Plex Web App
2. Navigate to any library item
3. Click the three dots menu → "Get Info"
4. Click "View XML"
5. Copy the `X-Plex-Token` value from the URL

**Test Connection:**
```bash
curl -H "X-Plex-Token: YOUR_TOKEN" http://YOUR_PLEX:32400/identity
```

### Tunarr

**UI Configuration** (Settings → Services → Tunarr):
- URL: Your Tunarr server address
- Username: Optional authentication
- Password: Optional authentication

**Test Connection:**
```bash
curl http://YOUR_TUNARR:8000/api/version
```

### TMDB

**UI Configuration** (Settings → Services → TMDB):
- API Key: Your TMDB API key

**Getting a TMDB API Key:**
1. Create account at https://www.themoviedb.org/
2. Go to Settings → API
3. Request an API key (free)

**Test Connection:**
```bash
curl "https://api.themoviedb.org/3/movie/550?api_key=YOUR_KEY"
```

### Ollama

**UI Configuration** (Settings → Services → Ollama):
- URL: Ollama server address
- Default Model: Model for AI generation

**Recommended Models:**
- `llama3.2` - Fast, good quality
- `llama3.1:8b` - Better quality
- `mistral` - Alternative

**Test Connection:**
```bash
curl http://YOUR_OLLAMA:11434/api/tags
```

---

## Profile Configuration

Profiles define how content is scheduled. See [SCORING_SYSTEM.md](SCORING_SYSTEM.md) for detailed scoring documentation.

### Profile Structure

```json
{
  "name": "My Profile",
  "description": "Profile description",
  "time_blocks": [
    {
      "name": "Morning Block",
      "start_time": "06:00",
      "end_time": "12:00",
      "criteria": {
        "preferred_types": ["movie"],
        "allowed_types": ["movie", "episode"],
        "preferred_genres": ["Family", "Animation"],
        "min_duration_min": 60,
        "max_duration_min": 180,
        "min_tmdb_rating": 6.0
      }
    }
  ],
  "default_weights": {
    "type": 15,
    "duration": 20,
    "genre": 15,
    "timing": 10,
    "strategy": 10,
    "age": 15,
    "rating": 10,
    "filter": 10,
    "bonus": 5
  }
}
```

### Time Block Criteria

| Field | Type | Description |
|-------|------|-------------|
| `preferred_types` | array | Preferred content types |
| `allowed_types` | array | Allowed content types |
| `excluded_types` | array | Excluded content types |
| `preferred_genres` | array | Preferred genres |
| `allowed_genres` | array | Allowed genres |
| `forbidden_genres` | array | Forbidden genres |
| `min_duration_min` | number | Minimum duration (minutes) |
| `max_duration_min` | number | Maximum duration (minutes) |
| `min_tmdb_rating` | number | Minimum TMDB rating |
| `preferred_tmdb_rating` | number | Preferred TMDB rating |
| `min_vote_count` | number | Minimum vote count |
| `max_age_rating` | string | Maximum age rating |

### M/F/P Rules

Each criterion can have Mandatory/Forbidden/Preferred rules:

```json
"genre_rules": {
  "mandatory_values": ["Family"],
  "mandatory_penalty": -50.0,
  "forbidden_values": ["Horror"],
  "forbidden_penalty": -150.0,
  "preferred_values": ["Animation"],
  "preferred_bonus": 20.0
}
```

---

## Scheduling Configuration

### Schedule Types

| Type | Description |
|------|-------------|
| `programming` | Generate channel programming |
| `scoring` | Analyze existing programming |

### Schedule Frequency

**Simple Mode:**
```json
{
  "mode": "simple",
  "frequency": "daily",
  "time": "06:00"
}
```

```json
{
  "mode": "simple",
  "frequency": "weekly",
  "days": [0, 4],  // Monday, Friday
  "time": "08:00"
}
```

**Cron Mode:**
```json
{
  "mode": "cron",
  "expression": "0 6 * * 1-5"  // 6 AM, Mon-Fri
}
```

### Cron Expression Reference

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

| Expression | Description |
|------------|-------------|
| `0 6 * * *` | Every day at 6 AM |
| `0 6 * * 1-5` | Mon-Fri at 6 AM |
| `0 6 * * 0,6` | Weekends at 6 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 6 1 * *` | First of month at 6 AM |

---

## Database Configuration

### SQLite (Default)

```env
DATABASE_URL=sqlite+aiosqlite:///./smartunarr.db
```

**WAL Mode** (automatic):
- Better concurrent read performance
- Automatic on new databases

### Backup

```bash
# Manual backup
sqlite3 smartunarr.db ".backup backup.db"

# Docker backup
docker exec smartunarr sqlite3 /app/data/smartunarr.db ".backup /app/data/backup.db"
```

### Maintenance

```bash
# Optimize database
sqlite3 smartunarr.db "VACUUM; ANALYZE;"

# Check integrity
sqlite3 smartunarr.db "PRAGMA integrity_check;"
```

---

## Security Configuration

### Secret Key

Generate a secure secret key:

```bash
# Python
python -c "import secrets; print(secrets.token_hex(32))"

# OpenSSL
openssl rand -hex 32
```

### CORS

Configure allowed origins:

```env
CORS_ORIGINS=http://localhost:3000,https://myapp.example.com
```

Or allow all (development only):

```env
CORS_ORIGINS=*
```

### Reverse Proxy

See [Deployment Guide](deployment.md#reverse-proxy-setup) for nginx/Traefik configuration.

---

## Logging Configuration

### Log Levels

| Level | Description |
|-------|-------------|
| `DEBUG` | Detailed debugging information |
| `INFO` | General operational information |
| `WARNING` | Warning messages |
| `ERROR` | Error messages |
| `CRITICAL` | Critical errors |

### Docker Logs

```bash
# View logs
docker compose logs -f smartunarr

# View last 100 lines
docker compose logs --tail 100 smartunarr
```

---

## Advanced Configuration

### Rate Limiting

TMDB rate limiting:

```env
TMDB_RATE_LIMIT=40  # Requests per 10 seconds
```

### Performance Tuning

For large libraries:

```yaml
environment:
  - LOG_LEVEL=WARNING  # Reduce logging
  - TMDB_RATE_LIMIT=30  # Conservative rate limit
```

---

## Next Steps

- [User Guide](USER_GUIDE.md) - How to use SmarTunarr
- [API Reference](API.md) - REST API documentation
- [Scoring System](SCORING_SYSTEM.md) - Detailed scoring documentation
