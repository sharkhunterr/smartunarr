# GitHub Releases - SmarTunarr

> Copier-coller directement le contenu de chaque release dans GitHub

---

# v0.2.0

**Title:** `v0.2.0 - Initial Release: Smart TV Channel Programming for Tunarr`

**Release Notes (copier ci-dessous):**

---

## 🎉 What's New in v0.2.0

**Welcome to SmarTunarr!** The first release of our intelligent TV channel programming system for Tunarr. Built entirely with AI-assisted development using Claude Code.

### 📺 Smart Channel Programming

Automate your Tunarr channel schedules with intelligent content placement:

- **Multi-iteration Optimization** — Run N iterations and keep the best-scoring schedule
- **Profile-Based Scheduling** — Define time blocks with specific content criteria
- **Real-time Progress** — WebSocket-based progress tracking during generation
- **Preview & Apply** — Review generated schedules before pushing to Tunarr
- **Intelligent Filling** — Automatically fills time blocks respecting all constraints

### 🎯 9-Criterion Scoring Engine

Comprehensive content evaluation system with 9 weighted criteria:

| Criterion | Description |
|-----------|-------------|
| **Type** | Content type matches preferences (movie, episode) |
| **Duration** | Content fits within block time constraints |
| **Genre** | Genre alignment with block preferences |
| **Timing** | Adaptive scoring based on P/M/F thresholds |
| **Strategy** | Programming strategy compliance |
| **Age** | Age rating validation |
| **Rating** | TMDB rating thresholds |
| **Filter** | Keyword and studio filtering |
| **Bonus** | Contextual bonuses (recent, blockbuster, collection) |

### 📋 Profile Management

Flexible JSON-based profile configuration:

- **Time Blocks** — Define unlimited time periods with unique criteria
- **M/F/P Rules** — Mandatory, Forbidden, Preferred rules per criterion
- **Criterion Multipliers** — Amplify or reduce criterion impact
- **Import/Export** — Share profiles as JSON files
- **Duplicate & Edit** — Quick profile creation from templates

### 🤖 AI Profile Generation

Create profiles using natural language with Ollama integration:

- **Natural Language Input** — Describe your ideal schedule in plain text
- **AI Modification** — Modify existing profiles with AI assistance
- **Multiple Models** — Support for various Ollama models (llama3.2, mistral, etc.)
- **Local Processing** — No cloud required, runs on your Ollama server

### ⏰ Automated Scheduling

Schedule recurring programming tasks:

- **Simple Mode** — Daily, weekly, or custom day selection
- **Expert Mode** — Full cron expression support
- **Multiple Types** — Schedule programming or scoring analysis
- **Enable/Disable** — Toggle schedules without deletion
- **Run Now** — Execute any schedule immediately

### 📊 Scoring Analysis

Analyze existing channel programming against profiles:

- **Per-Program Scoring** — Individual score for each program
- **Criterion Breakdown** — Detailed scores per criterion with M/F/P status
- **Violation Detection** — Identify forbidden content or missing mandatory requirements
- **Export Results** — CSV and JSON export for further analysis
- **Visual Indicators** — Color-coded scores for quick assessment

### 📜 Execution History

Track all programming and scoring operations:

- **Complete Logs** — Full execution history with parameters and results
- **Status Tracking** — Success, failed, running states
- **Scheduled Indicator** — Identify scheduled vs manual executions
- **Comparison** — Compare two history entries side-by-side
- **Cleanup Tools** — Clear old history entries

### 🔌 Service Integrations

Connect to your media stack:

- **Plex** — Fetch media libraries with full metadata
- **Tunarr** — Read/write channel programming
- **TMDB** — Enrich metadata with ratings, keywords, studios
- **Ollama** — AI-powered profile generation

### 🎨 Modern Web Interface

Beautiful, responsive UI built with React 18:

- **🌐 5 Languages** — English, Français, Deutsch, Español, Italiano
- **🌓 Theme Support** — Light, Dark, and Auto themes
- **📱 Responsive Design** — Works on desktop, tablet, and mobile
- **⚡ Real-time Updates** — WebSocket-powered progress tracking
- **🧭 Intuitive Navigation** — Clean sidebar with quick access

### 🐳 Docker Deployment

Easy deployment with Docker:

- **Single Container** — Frontend + Backend in one image
- **Multi-Platform** — `linux/amd64` and `linux/arm64` support
- **SQLite Database** — No external database required
- **Volume Persistence** — Data survives container restarts
- **Health Checks** — Built-in health monitoring

### 🛠️ Technical Stack

**Backend:**
- Python 3.11 with FastAPI
- SQLAlchemy + Alembic for database
- APScheduler for task scheduling
- Pydantic for validation

**Frontend:**
- React 18 with TypeScript
- Tailwind CSS for styling
- i18next for internationalization
- Vite for fast builds

**DevOps:**
- Docker with multi-stage builds
- GitLab CI/CD pipeline
- Automated releases to Docker Hub & GitHub

---

## 🚀 Quick Start

```bash
# Pull the image
docker pull sharkhunterr/smartunarr:latest

# Run with Docker Compose
curl -o docker-compose.yml https://raw.githubusercontent.com/sharkhunterr/smartunarr/master/docker/docker-compose.yml
docker compose up -d
```

**Access**: http://localhost:3000

---

## 📚 Documentation

- [Installation Guide](https://github.com/sharkhunterr/smartunarr/blob/master/docs/INSTALLATION.md)
- [Configuration Guide](https://github.com/sharkhunterr/smartunarr/blob/master/docs/CONFIGURATION.md)
- [User Guide](https://github.com/sharkhunterr/smartunarr/blob/master/docs/USER_GUIDE.md)
- [Scoring System](https://github.com/sharkhunterr/smartunarr/blob/master/docs/SCORING_SYSTEM.md)
- [API Reference](https://github.com/sharkhunterr/smartunarr/blob/master/docs/API.md)

---

## 🙏 Acknowledgments

Special thanks to:
- [Tunarr](https://github.com/chrisbenincasa/tunarr) — IPTV channel manager
- [Plex](https://www.plex.tv/) — Media server
- [TMDB](https://www.themoviedb.org/) — Movie database
- [Ollama](https://ollama.ai/) — Local LLM inference
- [Claude Code](https://claude.ai/claude-code) — AI-assisted development

---

**Full Changelog**: https://github.com/sharkhunterr/smartunarr/commits/v0.2.0

---
---

# 📋 Instructions

1. Aller sur https://github.com/sharkhunterr/smartunarr/releases/new
2. **Tag**: Correspond au tag de version
3. **Target**: `master`
4. **Title**: Copier le titre de la version concernée
5. **Description**: Copier tout depuis `## 🎉 What's New` jusqu'à `**Full Changelog**` inclus
6. **Publish release**

> ⚠️ Le script `npm run release:full` prend automatiquement la PREMIÈRE section de version (celle du haut)
