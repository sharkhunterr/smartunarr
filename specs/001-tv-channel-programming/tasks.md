# Tasks: SmartTunarr - Intelligent TV Channel Programming

**Feature Branch**: `001-tv-channel-programming`
**Generated**: 2026-01-27
**Total Tasks**: 89

## User Stories Summary

| Story | Priority | Description | Task Count |
|-------|----------|-------------|------------|
| US1 | P1 | Programmer une chaine via profil JSON | 18 |
| US2 | P1 | Noter un programme existant | 8 |
| US3 | P2 | Programmer via IA (Ollama) | 7 |
| US4 | P2 | Gerer les profils de programmation | 8 |
| US5 | P2 | Visualiser les programmes | 9 |
| US6 | P2 | Configurer les services | 10 |
| US7 | P3 | Consulter l'historique | 6 |
| US8 | P3 | Changer theme et langue | 6 |
| Setup | - | Project initialization | 9 |
| Foundation | - | Blocking prerequisites | 8 |

---

## Phase 1: Setup

**Goal**: Initialize project structure and development environment

- [X] T001 Create backend project structure with FastAPI in backend/app/__init__.py
- [X] T002 Create requirements.txt with FastAPI, SQLAlchemy, Pydantic, httpx, plexapi, ollama in backend/requirements.txt
- [X] T003 Create pyproject.toml with project metadata and dependencies in backend/pyproject.toml
- [X] T004 [P] Create frontend Vue.js 3 project with TypeScript in frontend/package.json
- [X] T005 [P] Create frontend vite.config.ts with proxy to backend in frontend/vite.config.ts
- [X] T006 Create backend config.py with environment variable loading in backend/app/config.py
- [X] T007 Create .env.example with all required environment variables in backend/.env.example
- [X] T008 [P] Create Docker development docker-compose.yml in docker/docker-compose.dev.yml
- [X] T009 Create main FastAPI application entrypoint in backend/app/main.py

---

## Phase 2: Foundation

**Goal**: Establish blocking prerequisites for all user stories

### Database Layer

- [X] T010 Create SQLite database setup with WAL mode in backend/app/db/database.py
- [X] T011 Create base SQLAlchemy model with UUID primary key in backend/app/models/base.py
- [X] T012 [P] Create Profile model per data-model.md in backend/app/models/profile.py
- [X] T013 [P] Create Content and ContentMeta models per data-model.md in backend/app/models/content.py
- [X] T014 [P] Create Channel and Program models per data-model.md in backend/app/models/channel.py
- [X] T015 [P] Create ScoringResult model per data-model.md in backend/app/models/scoring.py
- [X] T016 [P] Create Service model per data-model.md in backend/app/models/service.py
- [X] T017 [P] Create HistoryEntry model per data-model.md in backend/app/models/history.py

---

## Phase 3: User Story 1 - Programmer une chaine via profil JSON (P1)

**Goal**: Enable JSON profile-based programming with scoring and iterations

**Independent Test**: L'utilisateur charge un profil JSON, selectionne une chaine, lance la programmation et obtient un programme optimise avec score.

### Core Scoring Engine

- [X] T018 [US1] Create BaseCriterion abstract class in backend/app/core/scoring/base_criterion.py
- [X] T019 [P] [US1] Implement TypeCriterion (content type matching) in backend/app/core/scoring/criteria/type_criterion.py
- [X] T020 [P] [US1] Implement DurationCriterion (duration fit in block) in backend/app/core/scoring/criteria/duration_criterion.py
- [X] T021 [P] [US1] Implement GenreCriterion (genre preference matching) in backend/app/core/scoring/criteria/genre_criterion.py
- [X] T022 [P] [US1] Implement TimingCriterion (time block assignment) in backend/app/core/scoring/criteria/timing_criterion.py
- [X] T023 [P] [US1] Implement StrategyCriterion (sequence/insertion rules) in backend/app/core/scoring/criteria/strategy_criterion.py
- [X] T024 [P] [US1] Implement AgeCriterion (age rating compliance) in backend/app/core/scoring/criteria/age_criterion.py
- [X] T025 [P] [US1] Implement RatingCriterion (TMDB rating thresholds) in backend/app/core/scoring/criteria/rating_criterion.py
- [X] T026 [P] [US1] Implement FilterCriterion (keyword/studio filters) in backend/app/core/scoring/criteria/filter_criterion.py
- [X] T027 [P] [US1] Implement BonusCriterion (contextual bonuses) in backend/app/core/scoring/criteria/bonus_criterion.py
- [X] T028 [US1] Create ScoringEngine orchestrator with weighted aggregation in backend/app/core/scoring/engine.py

### Programming Generator

- [X] T029 [US1] Create TimeBlockManager with midnight spanning support in backend/app/core/blocks/time_block_manager.py
- [X] T030 [US1] Create ProgrammingGenerator with N iterations and best-score selection in backend/app/core/programming/generator.py
- [X] T031 [US1] Implement forbidden content exclusion in generator in backend/app/core/programming/generator.py
- [X] T032 [US1] Implement mandatory content enforcement with penalties in backend/app/core/programming/generator.py

### External Adapters

- [X] T033 [US1] Create TunarrAdapter for GET/PUT channels and programming in backend/app/adapters/tunarr_adapter.py
- [X] T034 [US1] Create PlexAdapter for library listing and content metadata in backend/app/adapters/plex_adapter.py

### API Endpoints

- [X] T035 [US1] Create POST /programming/generate endpoint in backend/app/api/routes/programming.py

---

## Phase 4: User Story 2 - Noter un programme existant (P1)

**Goal**: Analyze and score existing channel programming

**Independent Test**: L'utilisateur selectionne une chaine existante, lance la notation, et obtient un tableau detaille avec tous les scores.

### Scoring Service

- [X] T036 [US2] Create ScoringService to analyze existing programming in backend/app/services/scoring_service.py
- [X] T037 [US2] Implement violation detection for forbidden rules in backend/app/services/scoring_service.py
- [X] T038 [US2] Implement penalty calculation for mandatory rules in backend/app/services/scoring_service.py

### API Endpoints

- [X] T039 [US2] Create POST /scoring/analyze endpoint in backend/app/api/routes/scoring.py
- [X] T040 [US2] Create POST /scoring/export endpoint (CSV/JSON) in backend/app/api/routes/scoring.py
- [X] T041 [US2] Create GET /channels endpoint to list Tunarr channels in backend/app/api/routes/channels.py
- [X] T042 [US2] Create GET /channels/{id} endpoint with current programming in backend/app/api/routes/channels.py
- [X] T043 [US2] Create POST /channels/{id}/sync endpoint in backend/app/api/routes/channels.py

---

## Phase 5: User Story 4 - Gerer les profils de programmation (P2)

**Goal**: Full CRUD for profiles with labels and defaults

**Independent Test**: L'utilisateur peut CRUD complet sur les profils, les associer a des labels, definir des defaults.

### Profile Management

- [X] T044 [US4] Create JSON Schema v5.0 definition for profile validation in backend/app/schemas/profile_schema.json
- [X] T045 [US4] Create Pydantic models for profile validation in backend/app/schemas/profile_schema.py
- [X] T046 [US4] Implement v4 compatibility layer (migration) in backend/app/services/profile_migration.py
- [X] T047 [US4] Create ProfileService with CRUD operations in backend/app/services/profile_service.py

### API Endpoints

- [X] T048 [US4] Create GET /profiles endpoint with label filter in backend/app/api/routes/profiles.py
- [X] T049 [US4] Create POST /profiles endpoint in backend/app/api/routes/profiles.py
- [X] T050 [US4] Create GET/PUT/DELETE /profiles/{id} endpoints in backend/app/api/routes/profiles.py
- [X] T051 [US4] Create POST /profiles/import and GET /profiles/{id}/export endpoints in backend/app/api/routes/profiles.py

---

## Phase 6: User Story 5 - Visualiser les programmes (P2)

**Goal**: Timeline visualization with blocks and score colors

**Independent Test**: L'utilisateur voit une timeline/grille avec tous les elements visuels requis.

### Frontend Foundation

- [X] T052 [US5] Create Vue.js router configuration in frontend/src/router/index.ts
- [X] T053 [US5] Create Pinia store for programming state in frontend/src/stores/programming.ts
- [X] T054 [US5] Create API service layer with axios in frontend/src/services/api.ts
- [X] T055 [US5] Create WebSocket client for progress updates in frontend/src/services/websocket.ts

### UI Components

- [X] T056 [US5] Create ProgrammingView with channel/profile selectors in frontend/src/views/ProgrammingView.vue
- [X] T057 [US5] Create TimelineComponent for program visualization in frontend/src/components/timeline/TimelineComponent.vue
- [X] T058 [US5] Create ProgramCard with score color coding in frontend/src/components/timeline/ProgramCard.vue
- [X] T059 [US5] Create BlockMarker component for time block visualization in frontend/src/components/timeline/BlockMarker.vue
- [X] T060 [US5] Create ScoreBreakdownPopup for hover details in frontend/src/components/timeline/ScoreBreakdownPopup.vue

---

## Phase 7: User Story 6 - Configurer les services (P2)

**Goal**: Configure external services with connection testing

**Independent Test**: L'utilisateur configure chaque service et teste la connexion.

### Service Layer

- [X] T061 [US6] Create ServiceConfigService for CRUD operations in backend/app/services/service_config_service.py
- [X] T062 [US6] Implement credential encryption at rest in backend/app/utils/encryption.py
- [X] T063 [US6] Create PlexService with library listing in backend/app/services/plex_service.py
- [X] T064 [US6] Create TunarrService with connection test in backend/app/services/tunarr_service.py
- [X] T065 [US6] Create TMDBService with rate limiting in backend/app/services/tmdb_service.py

### API Endpoints

- [X] T066 [US6] Create GET/PUT /services/{type} endpoints in backend/app/api/routes/services.py
- [X] T067 [US6] Create POST /services/{type}/test endpoint in backend/app/api/routes/services.py
- [X] T068 [US6] Create GET /services/plex/libraries endpoint in backend/app/api/routes/services.py

### Frontend

- [X] T069 [US6] Create SettingsView with services tab in frontend/src/views/SettingsView.vue
- [X] T070 [US6] Create ServiceConfigCard component in frontend/src/components/settings/ServiceConfigCard.vue

---

## Phase 8: User Story 3 - Programmer via IA (Ollama) (P2)

**Goal**: Generate profiles from natural language using Ollama

**Independent Test**: L'utilisateur ecrit un prompt, le systeme genere un JSON, le valide, puis execute la programmation.

### Ollama Integration

- [X] T071 [US3] Create OllamaAdapter with ollama-python SDK in backend/app/adapters/ollama_adapter.py
- [X] T072 [US3] Create prompt template with JSON example in backend/app/services/ai_prompt_template.py
- [X] T073 [US3] Create AIProfileService with 3-attempt retry logic in backend/app/services/ai_profile_service.py

### API Endpoints

- [X] T074 [US3] Create POST /ai/generate-profile endpoint in backend/app/api/routes/ai.py
- [X] T075 [US3] Create GET /ai/history endpoint in backend/app/api/routes/ai.py
- [X] T076 [US3] Create GET /services/ollama/models endpoint in backend/app/api/routes/services.py

### Frontend

- [X] T077 [US3] Create AIPromptInput component in frontend/src/components/ai/AIPromptInput.vue

---

## Phase 9: User Story 7 - Consulter l'historique (P3)

**Goal**: View operation history with filters

**Independent Test**: L'utilisateur consulte une liste chronologique avec filtres.

### History Service

- [X] T078 [US7] Create HistoryService with filter support in backend/app/services/history_service.py

### API Endpoints

- [X] T079 [US7] Create GET /history endpoint with filters in backend/app/api/routes/history.py
- [X] T080 [US7] Create GET /history/{id} endpoint in backend/app/api/routes/history.py

### Frontend

- [X] T081 [US7] Create HistoryView with filter controls in frontend/src/views/HistoryView.vue
- [X] T082 [US7] Create HistoryListItem component in frontend/src/components/history/HistoryListItem.vue
- [X] T083 [US7] Create HistoryDetailModal component in frontend/src/components/history/HistoryDetailModal.vue

---

## Phase 10: User Story 8 - Changer theme et langue (P3)

**Goal**: Theme and language preferences

**Independent Test**: L'utilisateur change le theme et la langue, les changements sont persistes.

### Settings

- [X] T084 [US8] Create settings Pinia store with persistence in frontend/src/stores/settings.ts
- [X] T085 [US8] Create French translations in frontend/src/i18n/fr.json
- [X] T086 [US8] Create English translations in frontend/src/i18n/en.json
- [X] T087 [US8] Create light theme CSS variables in frontend/src/assets/css/themes/light.css
- [X] T088 [US8] Create dark theme CSS variables in frontend/src/assets/css/themes/dark.css
- [X] T089 [US8] Create ThemeLanguageSwitcher component in frontend/src/components/common/ThemeLanguageSwitcher.vue

---

## Phase 11: Polish & Production

**Goal**: Docker deployment, performance, documentation

### WebSocket

- [X] T090 Create WebSocket connection manager in backend/app/core/websocket_manager.py
- [X] T091 Implement iteration progress events in backend/app/api/routes/websocket.py

### Docker

- [X] T092 Create multi-stage Dockerfile in backend/Dockerfile and frontend/Dockerfile
- [X] T093 Create production docker-compose.yml in docker-compose.yml
- [X] T094 Add health check endpoint in backend/app/api/routes/health.py

### Performance

- [X] T095 Add database indexes per data-model.md in backend/app/db/indexes.py
- [X] T096 Implement metadata caching strategy in backend/app/services/cache_service.py

### Documentation

- [X] T097 Create README with setup instructions in README.md
- [X] T098 Create Docker deployment guide in docs/deployment.md

---

## Dependencies

```
Phase 1 (Setup) ─────────────────────────────────────────┐
                                                          │
Phase 2 (Foundation) ◄───────────────────────────────────┘
    │
    ├─► Phase 3 (US1: Programming) ──┐
    │                                 │
    └─► Phase 4 (US2: Scoring) ◄─────┘
            │
            ├─► Phase 5 (US4: Profiles)
            │
            ├─► Phase 6 (US5: Visualization)
            │
            ├─► Phase 7 (US6: Services)
            │
            └─► Phase 8 (US3: AI/Ollama) ◄── Requires US6
                    │
                    ├─► Phase 9 (US7: History)
                    │
                    └─► Phase 10 (US8: Theme/i18n)
                            │
                            └─► Phase 11 (Polish)
```

## Parallel Execution Examples

### Within Phase 2 (Foundation)
```
T012, T013, T014, T015, T016, T017 can run in parallel (different model files)
```

### Within Phase 3 (US1)
```
T019-T027 can run in parallel (independent criterion implementations)
T033, T034 can run in parallel (different adapters)
```

### Within Phase 6 (US5)
```
T057, T058, T059, T060 can run in parallel (independent components)
```

### Within Phase 10 (US8)
```
T085, T086 can run in parallel (different language files)
T087, T088 can run in parallel (different theme files)
```

---

## Implementation Strategy

### MVP Scope (Recommended First Release)
- **Phase 1**: Setup
- **Phase 2**: Foundation
- **Phase 3**: US1 - Programmer une chaine via profil JSON
- **Phase 4**: US2 - Noter un programme existant

This delivers the core value proposition: JSON profile-based programming with scoring.

### Incremental Delivery
1. MVP (US1 + US2) - Core programming and scoring
2. +US4 + US5 - Profile management and visualization
3. +US6 - Service configuration UI
4. +US3 - AI profile generation
5. +US7 + US8 - History and preferences
6. Polish - Docker, performance, docs

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 98 |
| Completed Tasks | 98 |
| Remaining Tasks | 0 |
| Setup Tasks | 9 (9 done) |
| Foundation Tasks | 8 (8 done) |
| US1 Tasks | 18 (18 done) |
| US2 Tasks | 8 (8 done) |
| US3 Tasks | 7 (7 done) |
| US4 Tasks | 8 (8 done) |
| US5 Tasks | 9 (9 done) |
| US6 Tasks | 10 (10 done) |
| US7 Tasks | 6 (6 done) |
| US8 Tasks | 6 (6 done) |
| Polish Tasks | 9 (9 done) |
| Parallelizable Tasks | 35 |
