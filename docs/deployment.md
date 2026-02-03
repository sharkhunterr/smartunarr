# SmarTunarr Deployment Guide

This guide covers deploying SmarTunarr in various environments.

## Table of Contents

1. [Docker Deployment](#docker-deployment)
2. [Manual Deployment](#manual-deployment)
3. [Configuration](#configuration)
4. [Reverse Proxy Setup](#reverse-proxy-setup)
5. [Database Management](#database-management)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

## Docker Deployment

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 1GB disk space

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-repo/smartunarr.git
cd smartunarr

# Create environment file
cp backend/.env.example .env

# Edit configuration
nano .env

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Production Configuration

Edit `docker-compose.yml` for production:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
    restart: always
    environment:
      - SECRET_KEY=${SECRET_KEY}  # Use strong key!
      - DATABASE_URL=sqlite:///./data/smartunarr.db
      - LOG_LEVEL=INFO
    volumes:
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "python", "-c", "import httpx; httpx.get('http://localhost:8080/api/v1/health')"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
    restart: always
    ports:
      - "80:80"
    depends_on:
      backend:
        condition: service_healthy
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Encryption key for credentials | Required |
| `DATABASE_URL` | SQLite database path | `sqlite:///./data/smartunarr.db` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:3000` |

### Data Persistence

Mount a volume for persistent data:

```yaml
volumes:
  - /path/to/data:/app/data
```

This persists:
- SQLite database
- Uploaded profiles
- Application logs

### Updating

```bash
# Pull latest changes
git pull

# Rebuild containers
docker-compose build

# Restart with new images
docker-compose up -d
```

## Manual Deployment

### Backend

```bash
# Python 3.11+ required
python --version

# Create virtual environment
cd backend
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run with Gunicorn (production)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8080
```

### Frontend

```bash
# Node.js 18+ required
node --version

# Install dependencies
cd frontend
npm ci

# Build for production
npm run build

# Serve with nginx or similar
# Output is in dist/
```

### Systemd Service

Create `/etc/systemd/system/smartunarr.service`:

```ini
[Unit]
Description=SmarTunarr Backend
After=network.target

[Service]
Type=simple
User=smartunarr
WorkingDirectory=/opt/smartunarr/backend
Environment="PATH=/opt/smartunarr/backend/venv/bin"
ExecStart=/opt/smartunarr/backend/venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8080
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable smartunarr
sudo systemctl start smartunarr
```

## Configuration

### Service Configuration

Configure services via the UI or API:

```bash
# Configure Plex
curl -X PUT http://localhost:8080/api/v1/services/plex \
  -H "Content-Type: application/json" \
  -d '{"url": "http://plex:32400", "token": "YOUR_TOKEN"}'

# Test connection
curl -X POST http://localhost:8080/api/v1/services/plex/test
```

### Ollama Setup

For AI features, install Ollama:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended model
ollama pull llama3.1:8b

# Configure in SmarTunarr
curl -X PUT http://localhost:8080/api/v1/services/ollama \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:11434"}'
```

## Reverse Proxy Setup

### Nginx

```nginx
upstream smartunarr_backend {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name smartunarr.example.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name smartunarr.example.com;

    ssl_certificate /etc/letsencrypt/live/smartunarr.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smartunarr.example.com/privkey.pem;

    # Frontend
    location / {
        root /opt/smartunarr/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://smartunarr_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /api/v1/ws/ {
        proxy_pass http://smartunarr_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
    }
}
```

### Traefik

```yaml
# traefik.yml labels
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.smartunarr.rule=Host(`smartunarr.example.com`)"
  - "traefik.http.routers.smartunarr.tls=true"
  - "traefik.http.routers.smartunarr.tls.certresolver=letsencrypt"
```

## Database Management

### Backup

```bash
# SQLite backup
sqlite3 /app/data/smartunarr.db ".backup '/backup/smartunarr-$(date +%Y%m%d).db'"

# Docker backup
docker exec smartunarr-backend sqlite3 /app/data/smartunarr.db ".backup '/app/data/backup.db'"
docker cp smartunarr-backend:/app/data/backup.db ./backup.db
```

### Restore

```bash
# Stop application
docker-compose stop backend

# Replace database
cp backup.db /path/to/data/smartunarr.db

# Start application
docker-compose start backend
```

### Maintenance

```bash
# Create indexes
curl -X POST http://localhost:8080/api/v1/admin/create-indexes

# Vacuum database (optimize)
sqlite3 /app/data/smartunarr.db "VACUUM"

# Analyze tables (update statistics)
sqlite3 /app/data/smartunarr.db "ANALYZE"
```

## Monitoring

### Health Check

```bash
# Basic health
curl http://localhost:8080/api/v1/health

# Response:
# {"status": "healthy", "version": "1.0.0"}
```

### Logs

```bash
# Docker logs
docker-compose logs -f backend

# Application logs
tail -f /app/data/logs/smartunarr.log
```

### Metrics

The application exposes basic metrics at `/api/v1/metrics`:

- Request count and latency
- Active WebSocket connections
- Cache hit/miss rates
- Database query counts

## Troubleshooting

### Connection Issues

**Plex connection fails:**
```bash
# Verify Plex is accessible
curl -H "X-Plex-Token: YOUR_TOKEN" http://plex:32400/identity

# Check network connectivity
docker exec smartunarr-backend ping plex
```

**Tunarr connection fails:**
```bash
# Verify Tunarr API
curl http://tunarr:8000/api/version
```

### Database Issues

**Database locked:**
```bash
# Check for multiple connections
lsof /app/data/smartunarr.db

# Enable WAL mode (automatic in new databases)
sqlite3 /app/data/smartunarr.db "PRAGMA journal_mode=WAL"
```

**Corrupt database:**
```bash
# Check integrity
sqlite3 /app/data/smartunarr.db "PRAGMA integrity_check"

# Recover data
sqlite3 /app/data/smartunarr.db ".recover" | sqlite3 /app/data/recovered.db
```

### Performance Issues

**Slow queries:**
```bash
# Enable query logging
export LOG_LEVEL=DEBUG

# Check missing indexes
curl http://localhost:8080/api/v1/admin/index-recommendations
```

**Memory usage:**
```bash
# Check container memory
docker stats smartunarr-backend

# Reduce cache size in .env
CACHE_MAX_SIZE=500
```

### WebSocket Issues

**Connection drops:**
- Check reverse proxy timeouts
- Verify WebSocket upgrade headers
- Enable longer ping intervals

```nginx
# Nginx WebSocket timeout
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
```

## Security Considerations

1. **Secret Key**: Use a strong, unique `SECRET_KEY` in production
2. **HTTPS**: Always use HTTPS in production
3. **Network**: Keep backend on internal network, expose only frontend
4. **Updates**: Regularly update dependencies
5. **Backups**: Automate database backups

```bash
# Generate secure secret key
python -c "import secrets; print(secrets.token_hex(32))"
```
