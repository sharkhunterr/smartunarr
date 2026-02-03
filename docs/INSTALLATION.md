# Installation Guide

Complete installation guide for SmarTunarr.

---

## Prerequisites

### Required Services

| Service | Description | Required |
|---------|-------------|----------|
| **Plex Media Server** | Source of media content | Yes |
| **Tunarr** | Channel management target | Yes |
| **TMDB API Key** | Metadata enrichment | Optional |
| **Ollama** | AI profile generation | Optional |

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 512 MB | 1 GB |
| **CPU** | 1 core | 2 cores |
| **Storage** | 500 MB | 1 GB |
| **Docker** | 20.10+ | Latest |

---

## Installation Methods

### Option 1: Docker (Recommended)

The simplest way to run SmarTunarr.

```bash
# Pull the image
docker pull sharkhunterr/smartunarr:latest

# Download docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/sharkhunterr/smartunarr/master/docker/docker-compose.yml

# Start SmarTunarr
docker compose up -d
```

**Access**: http://localhost:3000

See [Docker Guide](../docker/README.md) for detailed configuration.

### Option 2: Docker Run

```bash
docker run -d \
  --name smartunarr \
  -p 3000:3000 \
  -p 4273:4273 \
  -v smartunarr-data:/app/data \
  -e LOG_LEVEL=INFO \
  --restart unless-stopped \
  sharkhunterr/smartunarr:latest
```

### Option 3: Local Development

For development or manual installation.

#### Backend Setup

```bash
# Navigate to backend
cd src/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit configuration
nano .env

# Start backend
uvicorn app.main:app --host 0.0.0.0 --port 4273 --reload
```

#### Frontend Setup

```bash
# Navigate to frontend
cd src/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

**Access**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4273
- API Docs: http://localhost:4273/docs

### Option 4: npm Scripts

From the project root:

```bash
# Install all dependencies
npm run setup

# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:backend
npm run dev:frontend
```

---

## Post-Installation Setup

### 1. Access the Application

Open http://localhost:3000 in your browser.

### 2. Configure Services

Navigate to **Settings** and configure your external services:

#### Plex Configuration

| Field | Description | Example |
|-------|-------------|---------|
| URL | Plex server address | `http://192.168.1.100:32400` |
| Token | X-Plex-Token | `xxxxxxxxxxxxxxxxxxxx` |

**How to get your Plex token:**
1. Sign in to Plex Web App
2. Open any media item
3. Click "Get Info" → "View XML"
4. Find `X-Plex-Token=` in the URL

#### Tunarr Configuration

| Field | Description | Example |
|-------|-------------|---------|
| URL | Tunarr server address | `http://192.168.1.100:8000` |
| Username | Optional username | `admin` |
| Password | Optional password | `****` |

#### TMDB Configuration (Optional)

| Field | Description |
|-------|-------------|
| API Key | Your TMDB API key |

**Get a free API key at**: https://www.themoviedb.org/settings/api

#### Ollama Configuration (Optional)

| Field | Description | Example |
|-------|-------------|---------|
| URL | Ollama server address | `http://localhost:11434` |
| Model | Default model | `llama3.2` |

### 3. Test Connections

Click the **Test** button for each service to verify connectivity.

### 4. Create Your First Profile

1. Navigate to **Profiles**
2. Click **New Profile**
3. Define time blocks and criteria
4. Save the profile

### 5. Generate Programming

1. Navigate to **Programming**
2. Select a Tunarr channel
3. Select your profile
4. Set iterations (more = better results)
5. Click **Start**

---

## Network Configuration

### Docker Network Access

When running in Docker, use appropriate hostnames:

| Platform | Host Machine Address |
|----------|---------------------|
| **Linux** | Host IP (e.g., `192.168.1.100`) |
| **Mac/Windows** | `host.docker.internal` |

### Example: Plex on Same Machine

```yaml
# docker-compose.yml
environment:
  - PLEX_URL=http://host.docker.internal:32400  # Mac/Windows
  # or
  - PLEX_URL=http://192.168.1.100:32400  # Linux
```

### Firewall Rules

Ensure these ports are accessible:

| Service | Port | Direction |
|---------|------|-----------|
| SmarTunarr Web UI | 3000 | Inbound |
| SmarTunarr API | 4273 | Inbound |
| Plex | 32400 | Outbound |
| Tunarr | 8000 | Outbound |
| TMDB API | 443 | Outbound |
| Ollama | 11434 | Outbound |

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs smartunarr

# Common fixes
docker compose down
docker compose up -d
```

### Permission Errors

```bash
# Fix data directory permissions
chmod -R 755 ./data
chown -R 1000:1000 ./data
```

### Database Locked

```bash
# Stop all instances
docker compose down

# Start fresh
docker compose up -d
```

### Service Connection Failed

1. Verify service is running
2. Check network connectivity
3. Verify credentials/tokens
4. Check firewall rules

```bash
# Test connectivity from container
docker compose exec smartunarr curl -I http://your-service:port
```

---

## Upgrading

### Docker

```bash
# Pull latest image
docker compose pull

# Recreate container
docker compose up -d

# Clean old images
docker image prune -f
```

### Local Installation

```bash
# Update code
git pull

# Update backend dependencies
cd src/backend
pip install -r requirements.txt

# Update frontend dependencies
cd ../frontend
npm install
```

---

## Uninstallation

### Docker

```bash
# Stop and remove container
docker compose down

# Remove data volume (WARNING: deletes all data)
docker volume rm smartunarr-data

# Remove image
docker rmi sharkhunterr/smartunarr
```

### Local Installation

```bash
# Remove virtual environment
rm -rf src/backend/venv

# Remove node modules
rm -rf src/frontend/node_modules

# Remove database
rm -f src/backend/smartunarr.db
```

---

## Next Steps

- [Configuration Guide](CONFIGURATION.md) - Detailed configuration options
- [User Guide](USER_GUIDE.md) - How to use SmarTunarr
- [API Reference](API.md) - REST API documentation
