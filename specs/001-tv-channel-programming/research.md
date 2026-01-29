# Research: SmartTunarr Technical Decisions

**Feature**: 001-tv-channel-programming
**Date**: 2026-01-27

## Technology Stack Decisions

### Backend Framework

**Decision**: Python 3.11+ with FastAPI

**Rationale**:
- Async support native for concurrent API calls (Plex, TMDB, Tunarr, Ollama)
- Pydantic built-in for JSON schema validation (profile validation)
- OpenAPI auto-generation for API documentation
- Excellent performance for I/O-bound operations
- Strong typing support for maintainability

**Alternatives considered**:
- Flask: Less async support, would require additional libraries
- Django: Overkill for API-focused application, slower startup
- Node.js/Express: Would work but Python ecosystem better for data processing

### Frontend Framework

**Decision**: Vue.js 3 with TypeScript

**Rationale**:
- Composition API for better code organization
- TypeScript for type safety with API contracts
- Excellent i18n support (vue-i18n)
- Built-in reactivity for real-time score updates
- Smaller bundle size than React for single-page app

**Alternatives considered**:
- React: More complex state management setup
- Svelte: Smaller ecosystem, fewer UI libraries
- Plain JS: Would slow development significantly

### Database / Cache

**Decision**: SQLite with WAL mode

**Rationale**:
- Single-file database, perfect for Docker volume mount
- Supports 30K+ records efficiently with proper indexing
- No external database service required (single container requirement)
- WAL mode for concurrent reads during programming generation
- JSON1 extension for flexible metadata storage

**Alternatives considered**:
- PostgreSQL: Requires separate container, violates FR-070
- Redis: Good for cache but would need separate container
- SQLite + Redis: Adds complexity without significant benefit

### Tunarr API Integration

**Decision**: REST API client with retry logic

**Rationale**:
- Tunarr exposes REST API for channel management
- Need GET /channels, GET /channels/{id}/programming, PUT /channels/{id}/programming
- Implement exponential backoff for connection loss handling

**Alternatives considered**:
- Direct database access: Not supported, would break on Tunarr updates
- WebSocket: Tunarr doesn't expose WebSocket API

### Plex API Integration

**Decision**: PlexAPI Python library

**Rationale**:
- Official Python library, well-maintained
- Handles authentication, library browsing, metadata retrieval
- Supports bulk operations for initial cache population

**Alternatives considered**:
- Direct REST calls: Would duplicate PlexAPI functionality
- Custom client: Unnecessary complexity

### TMDB Integration

**Decision**: httpx async client with rate limiting

**Rationale**:
- TMDB API rate limit: 40 requests/10 seconds
- Async client for non-blocking enrichment
- Local cache to minimize API calls
- Batch processing for initial cache population

**Alternatives considered**:
- tmdbsimple library: Synchronous, would block
- aiohttp: Works but httpx has better typing

### Ollama Integration

**Decision**: ollama-python SDK

**Rationale**:
- Official SDK for Ollama API
- Supports streaming for progress feedback
- JSON mode for structured profile generation

**Alternatives considered**:
- Direct REST: SDK provides better error handling
- LangChain: Overkill for single LLM integration

### Profile Schema Validation

**Decision**: JSON Schema with Pydantic models

**Rationale**:
- JSON Schema for external validation (import)
- Pydantic models for internal type safety
- Support v4 legacy format with migration layer

**Alternatives considered**:
- YAML: JSON is already the standard in spec
- Custom validation: Would miss edge cases

### Scoring Algorithm

**Decision**: Weighted hierarchical scoring with deterministic seeding

**Rationale**:
- Program score = weighted sum of 9 criteria
- Block score = average of program scores in block
- Global score = weighted average of block scores
- Deterministic random seed for reproducibility (SC-004)

**Alternatives considered**:
- ML-based scoring: Overkill, not reproducible
- Simple averaging: Loses granularity

### Real-time Progress

**Decision**: WebSocket for progress updates

**Rationale**:
- Programming iterations need real-time feedback
- WebSocket efficient for server-push pattern
- Single connection for entire session

**Alternatives considered**:
- Server-Sent Events: Works but less bidirectional support
- Polling: Inefficient for real-time updates

## External API Research

### Tunarr API Endpoints

- `GET /api/channels` - List all channels
- `GET /api/channels/{id}` - Get channel details
- `GET /api/channels/{id}/programming` - Get current programming
- `PUT /api/channels/{id}/programming` - Update programming
- `POST /api/channels/{id}/programming/random` - Generate random programming

### Plex API Endpoints (via PlexAPI)

- `library.section(id)` - Get library
- `section.all()` - Get all items in library
- `item.reload()` - Refresh item metadata

### TMDB API Endpoints

- `GET /movie/{id}` - Movie details
- `GET /movie/{id}/keywords` - Movie keywords
- `GET /search/movie` - Search by title
- Rate limit: 40 requests per 10 seconds

### Ollama API

- `POST /api/generate` - Generate text
- `POST /api/chat` - Chat completion with JSON mode
- Local, no rate limit

## Edge Case Handling

### Connection Loss During Programming

**Decision**: Checkpoint-based recovery

**Implementation**:
- Save best iteration state after each iteration
- On reconnect, resume from last checkpoint
- Notify user of partial progress

### Midnight-Spanning Blocks

**Decision**: Virtual day boundary

**Implementation**:
- Blocks can span midnight (e.g., 21:00-06:00)
- Internal representation uses minutes from day start
- 21:00-06:00 = 1260min to 1800min (next day offset)

### Invalid Profile JSON

**Decision**: Detailed validation errors

**Implementation**:
- JSON syntax errors: Report line/column
- Schema violations: Report path and expected type
- Semantic errors: Report conflicting criteria

### Ollama Generation Failures

**Decision**: 3-attempt retry with feedback

**Implementation**:
- Attempt 1: Original prompt
- Attempt 2: Add validation errors to prompt
- Attempt 3: Simplify to core criteria only
- After 3 failures: Show manual editor

### Missing Plex Library

**Decision**: Graceful degradation

**Implementation**:
- Validate library existence at profile load
- Mark missing libraries in UI
- Exclude from programming, don't block entirely

### Contradictory Mandatory Criteria

**Decision**: Validation-time rejection

**Implementation**:
- Detect impossible combinations at profile validation
- Example: mandatory_genre=Horror + forbidden_genre=Horror
- Report specific conflict to user

### Corrupted TMDB Cache

**Decision**: Automatic rebuild

**Implementation**:
- Detect corruption via integrity check
- Offer cache rebuild option
- Continue in Plex-only mode during rebuild
