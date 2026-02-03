# API Reference

REST API documentation for SmarTunarr.

**Base URL**: `http://localhost:4273/api/v1`

**Interactive Docs**: `http://localhost:4273/docs` (Swagger UI)

---

## Authentication

Currently, SmarTunarr does not require authentication for API access. Future versions may add optional authentication.

---

## Endpoints Overview

| Category | Base Path | Description |
|----------|-----------|-------------|
| [Health](#health) | `/health` | Health check |
| [Channels](#channels) | `/channels` | Tunarr channels |
| [Profiles](#profiles) | `/profiles` | Scheduling profiles |
| [Programming](#programming) | `/programming` | Schedule generation |
| [Scoring](#scoring) | `/scoring` | Schedule analysis |
| [Schedules](#schedules) | `/schedules` | Automated scheduling |
| [History](#history) | `/history` | Execution history |
| [Services](#services) | `/services` | Service configuration |
| [AI](#ai) | `/ai` | AI profile generation |

---

## Health

### GET /health

Check API health status.

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Channels

### GET /channels

List available Tunarr channels.

**Response:**
```json
{
  "channels": [
    {
      "id": "channel-uuid",
      "name": "Movies 24/7",
      "number": 1,
      "programming_count": 150
    }
  ]
}
```

### GET /channels/{channel_id}

Get channel details.

**Response:**
```json
{
  "id": "channel-uuid",
  "name": "Movies 24/7",
  "number": 1,
  "programming": [
    {
      "start_time": "2024-01-15T00:00:00Z",
      "title": "Movie Title",
      "duration": 7200,
      "type": "movie"
    }
  ]
}
```

---

## Profiles

### GET /profiles

List all profiles.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `skip` | int | Pagination offset |
| `limit` | int | Page size (default: 100) |

**Response:**
```json
{
  "profiles": [
    {
      "id": "uuid",
      "name": "Family Schedule",
      "description": "Family-friendly programming",
      "time_blocks_count": 4,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 5
}
```

### POST /profiles

Create a new profile.

**Request Body:**
```json
{
  "name": "My Profile",
  "description": "Profile description",
  "time_blocks": [
    {
      "name": "Morning",
      "start_time": "06:00",
      "end_time": "12:00",
      "criteria": {
        "preferred_types": ["movie"],
        "preferred_genres": ["Family", "Animation"],
        "max_age_rating": "PG"
      }
    }
  ],
  "default_weights": {
    "type": 15,
    "duration": 20,
    "genre": 15
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "My Profile",
  "created_at": "2024-01-15T10:00:00Z"
}
```

### GET /profiles/{profile_id}

Get profile by ID.

**Response:**
```json
{
  "id": "uuid",
  "name": "My Profile",
  "description": "Description",
  "time_blocks": [...],
  "default_weights": {...}
}
```

### PUT /profiles/{profile_id}

Update a profile.

**Request Body:** Same as POST

**Response:** Updated profile

### DELETE /profiles/{profile_id}

Delete a profile.

**Response:** `204 No Content`

### POST /profiles/import

Import a profile from JSON.

**Request Body:** Profile JSON

**Response:** Created profile

### GET /profiles/{profile_id}/export

Export profile as JSON.

**Response:** Profile JSON file download

---

## Programming

### POST /programming/generate

Generate channel programming.

**Request Body:**
```json
{
  "channel_id": "channel-uuid",
  "profile_id": "profile-uuid",
  "iterations": 100,
  "start_date": "2024-01-15",
  "end_date": "2024-01-22"
}
```

**Response:**
```json
{
  "job_id": "job-uuid",
  "status": "started"
}
```

### GET /programming/status/{job_id}

Get programming job status.

**Response:**
```json
{
  "job_id": "job-uuid",
  "status": "running",
  "progress": 45,
  "current_iteration": 45,
  "total_iterations": 100,
  "best_score": 78.5
}
```

### GET /programming/result/{job_id}

Get programming result.

**Response:**
```json
{
  "job_id": "job-uuid",
  "status": "completed",
  "best_score": 82.3,
  "schedule": [
    {
      "start_time": "2024-01-15T06:00:00Z",
      "end_time": "2024-01-15T08:00:00Z",
      "title": "Movie Title",
      "type": "movie",
      "duration": 7200,
      "score": 85.0,
      "criteria_scores": {
        "type": 100,
        "duration": 90,
        "genre": 80
      }
    }
  ]
}
```

### POST /programming/apply

Apply generated schedule to Tunarr.

**Request Body:**
```json
{
  "job_id": "job-uuid",
  "channel_id": "channel-uuid"
}
```

**Response:**
```json
{
  "status": "applied",
  "programs_count": 50
}
```

### POST /programming/preview

Preview programming without applying.

**Request Body:** Same as generate

**Response:** Same as result

---

## Scoring

### POST /scoring/analyze

Analyze existing channel programming.

**Request Body:**
```json
{
  "channel_id": "channel-uuid",
  "profile_id": "profile-uuid",
  "date": "2024-01-15"
}
```

**Response:**
```json
{
  "average_score": 75.2,
  "programs": [
    {
      "start_time": "2024-01-15T06:00:00Z",
      "title": "Movie Title",
      "score": 82.0,
      "criteria_scores": {
        "type": {"score": 100, "weight": 15, "details": "..."},
        "duration": {"score": 85, "weight": 20, "details": "..."},
        "genre": {"score": 75, "weight": 15, "details": "..."}
      },
      "violations": ["forbidden_genre_detected"]
    }
  ],
  "summary": {
    "excellent": 10,
    "good": 25,
    "average": 12,
    "poor": 3,
    "inadequate": 0
  }
}
```

### POST /scoring/export

Export analysis results.

**Request Body:**
```json
{
  "channel_id": "channel-uuid",
  "profile_id": "profile-uuid",
  "date": "2024-01-15",
  "format": "csv"
}
```

**Response:** File download (CSV or JSON)

---

## Schedules

### GET /schedules

List all schedules.

**Response:**
```json
{
  "schedules": [
    {
      "id": "uuid",
      "name": "Daily Programming",
      "schedule_type": "programming",
      "channel_id": "channel-uuid",
      "profile_id": "profile-uuid",
      "enabled": true,
      "schedule_config": {
        "mode": "simple",
        "frequency": "daily",
        "time": "06:00"
      },
      "last_execution_at": "2024-01-15T06:00:00Z",
      "last_execution_status": "success",
      "next_execution_at": "2024-01-16T06:00:00Z"
    }
  ]
}
```

### POST /schedules

Create a schedule.

**Request Body:**
```json
{
  "name": "Daily Programming",
  "description": "Generate programming daily",
  "schedule_type": "programming",
  "channel_id": "channel-uuid",
  "profile_id": "profile-uuid",
  "schedule_config": {
    "mode": "simple",
    "frequency": "daily",
    "time": "06:00"
  },
  "execution_params": {
    "iterations": 100
  },
  "enabled": true
}
```

**Response:** Created schedule

### GET /schedules/{schedule_id}

Get schedule by ID.

### PUT /schedules/{schedule_id}

Update a schedule.

### DELETE /schedules/{schedule_id}

Delete a schedule.

### POST /schedules/{schedule_id}/toggle

Enable/disable a schedule.

**Response:**
```json
{
  "id": "uuid",
  "enabled": false
}
```

### POST /schedules/{schedule_id}/run

Execute schedule immediately.

**Response:**
```json
{
  "job_id": "job-uuid",
  "status": "started"
}
```

---

## History

### GET /history

List execution history.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `skip` | int | Pagination offset |
| `limit` | int | Page size (default: 50) |
| `type` | string | Filter by type (programming/scoring) |
| `channel_id` | string | Filter by channel |
| `profile_id` | string | Filter by profile |

**Response:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "type": "programming",
      "channel_id": "channel-uuid",
      "channel_name": "Movies 24/7",
      "profile_id": "profile-uuid",
      "profile_name": "Family Schedule",
      "status": "success",
      "average_score": 78.5,
      "programs_count": 50,
      "schedule_id": "schedule-uuid",
      "schedule_name": "Daily Programming",
      "created_at": "2024-01-15T06:00:00Z",
      "completed_at": "2024-01-15T06:05:00Z"
    }
  ],
  "total": 100
}
```

### GET /history/{entry_id}

Get history entry details.

**Response:**
```json
{
  "id": "uuid",
  "type": "programming",
  "status": "success",
  "parameters": {
    "iterations": 100,
    "start_date": "2024-01-15"
  },
  "result": {
    "best_score": 78.5,
    "schedule": [...]
  },
  "error": null
}
```

### DELETE /history/{entry_id}

Delete history entry.

### DELETE /history

Clear history.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `before` | datetime | Delete entries before date |

---

## Services

### GET /services

List service configurations.

**Response:**
```json
{
  "services": {
    "plex": {
      "configured": true,
      "connected": true,
      "url": "http://192.168.1.100:32400"
    },
    "tunarr": {
      "configured": true,
      "connected": true,
      "url": "http://192.168.1.100:8000"
    },
    "tmdb": {
      "configured": true,
      "connected": true
    },
    "ollama": {
      "configured": false,
      "connected": false
    }
  }
}
```

### PUT /services/{service_type}

Update service configuration.

**Request Body (Plex):**
```json
{
  "url": "http://192.168.1.100:32400",
  "token": "xxxxxxxxxxxx"
}
```

**Request Body (Tunarr):**
```json
{
  "url": "http://192.168.1.100:8000",
  "username": "admin",
  "password": "secret"
}
```

**Request Body (TMDB):**
```json
{
  "api_key": "xxxxxxxxxxxx"
}
```

**Request Body (Ollama):**
```json
{
  "url": "http://localhost:11434",
  "default_model": "llama3.2"
}
```

### POST /services/{service_type}/test

Test service connection.

**Response:**
```json
{
  "status": "success",
  "message": "Connected successfully",
  "details": {
    "version": "1.32.0",
    "libraries": 5
  }
}
```

### GET /services/plex/libraries

List Plex libraries.

**Response:**
```json
{
  "libraries": [
    {
      "key": "1",
      "title": "Movies",
      "type": "movie",
      "count": 500
    }
  ]
}
```

### GET /services/tunarr/channels

List Tunarr channels (alias for GET /channels).

---

## AI

### POST /ai/generate-profile

Generate profile from description.

**Request Body:**
```json
{
  "description": "Family-friendly channel with kids content in the morning...",
  "model": "llama3.2"
}
```

**Response:**
```json
{
  "profile": {
    "name": "Generated Profile",
    "time_blocks": [...]
  },
  "generation_info": {
    "model": "llama3.2",
    "tokens_used": 1500
  }
}
```

### POST /ai/modify-profile

Modify existing profile with AI.

**Request Body:**
```json
{
  "profile_id": "uuid",
  "modification": "Add a late-night horror block from 11 PM to 6 AM",
  "model": "llama3.2"
}
```

**Response:** Modified profile

### GET /ai/models

List available Ollama models.

**Response:**
```json
{
  "models": [
    {
      "name": "llama3.2",
      "size": "4.7GB",
      "modified_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

## WebSocket

### WS /ws/jobs

Real-time job progress updates.

**Connect:**
```javascript
const ws = new WebSocket('ws://localhost:4273/api/v1/ws/jobs');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

**Messages:**
```json
{
  "type": "progress",
  "job_id": "uuid",
  "progress": 45,
  "current_iteration": 45,
  "best_score": 78.5
}
```

```json
{
  "type": "completed",
  "job_id": "uuid",
  "status": "success",
  "final_score": 82.3
}
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "detail": "Error message",
  "error_code": "PROFILE_NOT_FOUND",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 404 | Not Found |
| 422 | Validation Error |
| 500 | Internal Server Error |

---

## Rate Limiting

No rate limiting is currently implemented. However, TMDB API calls are rate-limited internally (40 requests/10 seconds by default).

---

## Examples

### cURL

```bash
# List profiles
curl http://localhost:4273/api/v1/profiles

# Create profile
curl -X POST http://localhost:4273/api/v1/profiles \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "time_blocks": []}'

# Generate programming
curl -X POST http://localhost:4273/api/v1/programming/generate \
  -H "Content-Type: application/json" \
  -d '{"channel_id": "uuid", "profile_id": "uuid", "iterations": 50}'
```

### Python

```python
import httpx

client = httpx.Client(base_url="http://localhost:4273/api/v1")

# List profiles
profiles = client.get("/profiles").json()

# Create profile
new_profile = client.post("/profiles", json={
    "name": "My Profile",
    "time_blocks": [
        {
            "name": "Morning",
            "start_time": "06:00",
            "end_time": "12:00",
            "criteria": {"preferred_genres": ["Family"]}
        }
    ]
}).json()

# Generate programming
job = client.post("/programming/generate", json={
    "channel_id": "channel-uuid",
    "profile_id": new_profile["id"],
    "iterations": 100
}).json()
```

### JavaScript

```javascript
// List profiles
const profiles = await fetch('http://localhost:4273/api/v1/profiles')
  .then(r => r.json());

// Generate programming with WebSocket progress
const ws = new WebSocket('ws://localhost:4273/api/v1/ws/jobs');

const job = await fetch('http://localhost:4273/api/v1/programming/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channel_id: 'uuid',
    profile_id: 'uuid',
    iterations: 100
  })
}).then(r => r.json());

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.job_id === job.job_id) {
    console.log(`Progress: ${data.progress}%`);
  }
};
```

---

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

- **JSON**: `http://localhost:4273/openapi.json`
- **Swagger UI**: `http://localhost:4273/docs`
- **ReDoc**: `http://localhost:4273/redoc`
