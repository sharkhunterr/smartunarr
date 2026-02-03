#!/bin/bash
# Script pour corriger le linting backend (avec ou sans Poetry)

set -e

cd "$(dirname "$0")/../src/backend"

run_fix() {
    if command -v poetry &> /dev/null; then
        echo "🔧 Correction avec Poetry..."
        poetry run ruff check app/ tests/ --fix --unsafe-fixes
        poetry run ruff format app/ tests/
    elif [ -f ".venv/bin/activate" ]; then
        echo "🔧 Correction avec venv..."
        source .venv/bin/activate
        ruff check app/ tests/ --fix --unsafe-fixes
        ruff format app/ tests/
    else
        echo "❌ Erreur: Ni Poetry ni environnement virtuel trouvé"
        echo ""
        echo "Pour configurer le backend, exécutez:"
        echo "  bash scripts/setup-backend.sh"
        exit 1
    fi
}

run_fix
