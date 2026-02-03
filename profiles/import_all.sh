#!/bin/bash
# Script d'import des profils v6

API_URL="${API_URL:-http://localhost:4273}"
PROFILES_DIR="$(dirname "$0")"

echo "Importing v6 profiles to $API_URL..."

for profile in "$PROFILES_DIR"/*_v6.json; do
    name=$(basename "$profile")
    echo "Importing $name..."
    response=$(curl -s -X POST "$API_URL/api/profiles/import?overwrite=true" \
        -H "Content-Type: application/json" \
        -d @"$profile")

    if echo "$response" | grep -q '"id"'; then
        echo "  OK: $(echo "$response" | grep -o '"name":"[^"]*"')"
    else
        echo "  ERROR: $response"
    fi
done

echo "Done!"
