#!/bin/bash
# Script pour vérifier le linting backend (avec ou sans Poetry)

set -e

cd "$(dirname "$0")/../src/backend"

run_lint() {
    if command -v poetry &> /dev/null; then
        echo "🔍 Vérification avec Poetry..."
        poetry run ruff check app/ tests/
        poetry run ruff format --check app/ tests/
    elif [ -f ".venv/bin/activate" ]; then
        echo "🔍 Vérification avec venv..."
        source .venv/bin/activate
        ruff check app/ tests/
        ruff format --check app/ tests/
    else
        echo "❌ Erreur: Ni Poetry ni environnement virtuel trouvé"
        echo ""
        echo "Pour configurer le backend, exécutez:"
        echo "  bash scripts/setup-backend.sh"
        exit 1
    fi
}

run_lint
