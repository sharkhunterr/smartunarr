# Data Model: SmartTunarr

**Feature**: 001-tv-channel-programming
**Date**: 2026-01-27

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Profile   │───────│  TimeBlock  │       │   Channel   │
└─────────────┘  1:N  └─────────────┘       └─────────────┘
       │                                           │
       │                                           │
       │ 1:N                                       │ 1:N
       ▼                                           ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│ProfileLabel │       │   Content   │◄──────│   Program   │
└─────────────┘       └─────────────┘  N:1  └─────────────┘
                             │                     │
                             │ 1:1                 │ 1:1
                             ▼                     ▼
                      ┌─────────────┐       ┌─────────────┐
                      │ContentMeta  │       │ScoringResult│
                      └─────────────┘       └─────────────┘

┌─────────────┐       ┌─────────────┐
│   Service   │       │HistoryEntry │
└─────────────┘       └─────────────┘
```

## Entities

### Profile

Configuration JSON defining programming criteria.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| name | string | required, max 100 | Profile display name |
| version | string | required, semver | Schema version (e.g., "5.0") |
| libraries | JSON | required | Array of library references |
| time_blocks | JSON | required | Array of TimeBlock definitions |
| mandatory_forbidden_criteria | JSON | required | Criteria configuration |
| strategies | JSON | optional | Programming strategies |
| scoring_weights | JSON | required | Weight per criterion |
| default_iterations | int | default 10, 1-100 | Default iteration count |
| default_randomness | float | default 0.3, 0.0-1.0 | Default randomness factor |
| created_at | datetime | auto | Creation timestamp |
| updated_at | datetime | auto | Last modification |

**Validation Rules**:
- `name` must be unique per user
- `version` must be "4.x" or "5.x" for compatibility
- `scoring_weights` values must sum to reasonable total (100-200)
- `time_blocks` must cover 24h without gaps (optional validation)

### ProfileLabel

Tags for organizing profiles.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| profile_id | UUID | FK -> Profile | Parent profile |
| label | string | required, max 50 | Label name |

**Validation Rules**:
- Unique (profile_id, label) combination
- Label normalized to lowercase

### TimeBlock

Embedded in Profile JSON, also used at runtime.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| name | string | required | Block display name |
| start_time | time | required, HH:MM | Block start |
| end_time | time | required, HH:MM | Block end |
| criteria | JSON | optional | Block-specific criteria override |

**State Transitions**: N/A (immutable within profile)

**Validation Rules**:
- `end_time` can be < `start_time` (midnight spanning)
- No overlapping blocks within same profile

### Content

Media item from Plex library.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| plex_key | string | required, unique | Plex rating key |
| title | string | required | Display title |
| type | enum | movie/episode/trailer | Content type |
| duration_ms | int | required | Duration in milliseconds |
| year | int | optional | Release year |
| library_id | string | required | Source Plex library |
| created_at | datetime | auto | First seen |
| updated_at | datetime | auto | Last metadata refresh |

**Validation Rules**:
- `duration_ms` must be > 0
- `plex_key` format: "/library/metadata/{id}"

### ContentMeta

TMDB-enriched metadata for Content.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| content_id | UUID | FK -> Content, unique | Parent content |
| tmdb_id | int | optional | TMDB movie/show ID |
| genres | JSON | array of strings | Genre list |
| keywords | JSON | array of strings | Keyword list |
| age_rating | string | optional | Content rating (G, PG, etc.) |
| tmdb_rating | float | 0.0-10.0 | TMDB vote average |
| vote_count | int | >= 0 | TMDB vote count |
| budget | int | optional | Production budget |
| revenue | int | optional | Box office revenue |
| studios | JSON | array of strings | Production companies |
| collections | JSON | array of strings | Collection names |
| enriched_at | datetime | optional | Last TMDB fetch |

**Validation Rules**:
- `tmdb_rating` between 0.0 and 10.0
- `enriched_at` null means not yet enriched

### Channel

Tunarr channel reference.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| tunarr_id | string | required, unique | Tunarr channel ID |
| name | string | required | Channel display name |
| number | int | optional | Channel number |
| last_sync | datetime | optional | Last programming sync |

**State Transitions**:
- `idle` -> `syncing` -> `idle`
- `idle` -> `programming` -> `idle`

### Program

Scheduled content in a channel's programming.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| channel_id | UUID | FK -> Channel | Parent channel |
| content_id | UUID | FK -> Content | Scheduled content |
| start_time | datetime | required | Scheduled start |
| end_time | datetime | computed | start_time + duration |
| position | int | required | Order in programming |
| block_name | string | optional | Assigned time block |

**Validation Rules**:
- No overlapping programs in same channel
- `position` must be sequential starting from 0

### ScoringResult

Detailed scoring breakdown for a program.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| program_id | UUID | FK -> Program | Scored program |
| profile_id | UUID | FK -> Profile | Profile used for scoring |
| total_score | float | 0.0-100.0 | Weighted total score |
| type_score | float | 0.0-100.0 | Content type match |
| duration_score | float | 0.0-100.0 | Duration fit |
| genre_score | float | 0.0-100.0 | Genre match |
| timing_score | float | 0.0-100.0 | Time block fit |
| strategy_score | float | 0.0-100.0 | Strategy compliance |
| age_score | float | 0.0-100.0 | Age rating match |
| rating_score | float | 0.0-100.0 | TMDB rating match |
| filter_score | float | 0.0-100.0 | Keyword/studio filters |
| bonus_score | float | 0.0-100.0 | Contextual bonuses |
| forbidden_violations | JSON | array | List of violated forbidden rules |
| mandatory_penalties | JSON | array | List of missing mandatory criteria |
| scored_at | datetime | auto | Scoring timestamp |

**Validation Rules**:
- All scores between 0.0 and 100.0
- `total_score` = weighted average of individual scores

### Service

External service configuration.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| type | enum | plex/tmdb/tunarr/ollama | Service type |
| name | string | required | Display name |
| url | string | required for plex/tunarr/ollama | Service URL |
| api_key | string | encrypted, optional | API key (TMDB) |
| token | string | encrypted, optional | Auth token (Plex) |
| username | string | optional | Username (Tunarr) |
| password | string | encrypted, optional | Password (Tunarr) |
| default_model | string | optional | Default Ollama model |
| is_active | boolean | default true | Service enabled |
| last_test | datetime | optional | Last connection test |
| last_test_success | boolean | optional | Test result |

**Validation Rules**:
- Credentials must be encrypted at rest
- URL must be valid HTTP(S) URL
- Only one active service per type

### HistoryEntry

Audit log for operations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| type | enum | programming/scoring | Operation type |
| channel_id | UUID | FK -> Channel | Target channel |
| profile_id | UUID | FK -> Profile | Profile used |
| started_at | datetime | required | Operation start |
| completed_at | datetime | optional | Operation end |
| status | enum | running/success/failed | Operation status |
| iterations | int | optional | Iterations performed |
| best_score | float | optional | Best achieved score |
| result_summary | JSON | optional | Detailed results |
| error_message | string | optional | Error if failed |

**State Transitions**:
- `running` -> `success`
- `running` -> `failed`

## Indexes

### Performance Indexes

```sql
-- Content lookup by Plex key
CREATE UNIQUE INDEX idx_content_plex_key ON content(plex_key);

-- Content search by library
CREATE INDEX idx_content_library ON content(library_id);

-- ContentMeta by genres (JSON)
CREATE INDEX idx_contentmeta_genres ON content_meta(genres);

-- Program by channel and time
CREATE INDEX idx_program_channel_time ON program(channel_id, start_time);

-- History by channel and date
CREATE INDEX idx_history_channel_date ON history_entry(channel_id, started_at);

-- Profile labels for filtering
CREATE INDEX idx_profilelabel_label ON profile_label(label);
```

## Data Volume Estimates

| Entity | Expected Count | Growth Rate |
|--------|---------------|-------------|
| Profile | 10-50 | Slow (user-created) |
| Content | 30,000+ | Medium (library syncs) |
| ContentMeta | 30,000+ | Matches Content |
| Channel | 5-20 | Slow |
| Program | 200-500 per channel | Reset on programming |
| ScoringResult | Matches Program | Reset on programming |
| HistoryEntry | 100/month | Linear |
| Service | 4 (one per type) | Fixed |
