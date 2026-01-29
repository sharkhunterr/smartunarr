"""AI prompt templates for profile generation."""

from typing import Any

# System prompt for profile generation
SYSTEM_PROMPT = """Tu es un assistant expert en programmation de chaînes TV. Tu génères des profils de programmation au format JSON.

Un profil de programmation définit:
- Les blocs horaires (time_blocks) avec leurs critères de contenu
- Les poids de notation (scoring_weights) pour évaluer la qualité d'un programme
- Les règles de contenu interdit (forbidden) et obligatoire (mandatory)
- Les stratégies de remplissage et bonus

Tu dois TOUJOURS répondre avec un JSON valide suivant le schéma fourni. Ne jamais inclure d'explications ou de texte en dehors du JSON."""


# JSON Schema example for the prompt
PROFILE_SCHEMA_EXAMPLE = """{
  "name": "Soirée Action",
  "version": "5.0",
  "libraries": [
    {
      "plex_library_id": "1",
      "name": "Films",
      "content_types": ["movie"]
    }
  ],
  "time_blocks": [
    {
      "name": "Prime Time",
      "start_time": "20:00",
      "end_time": "23:00",
      "criteria": {
        "content_types": ["movie"],
        "genres": {
          "include": ["Action", "Thriller"],
          "exclude": ["Horror"]
        },
        "duration": {
          "min_minutes": 90,
          "max_minutes": 150
        },
        "age_rating": {
          "max_rating": "R"
        }
      }
    }
  ],
  "scoring_weights": {
    "type": 1.0,
    "duration": 1.5,
    "genre": 2.0,
    "timing": 1.0,
    "strategy": 0.5,
    "age": 1.0,
    "rating": 1.0,
    "filter": 0.5,
    "bonus": 0.5
  },
  "forbidden": [
    {
      "field": "genre",
      "operator": "contains",
      "value": "Horror"
    }
  ],
  "mandatory": [
    {
      "field": "content_type",
      "operator": "equals",
      "value": "movie",
      "penalty": 5.0
    }
  ],
  "strategies": {
    "filler": {
      "enabled": true,
      "max_duration_minutes": 30,
      "content_types": ["short", "trailer"]
    }
  },
  "bonuses": [
    {
      "condition": {
        "field": "tmdb_rating",
        "operator": ">=",
        "value": 8.0
      },
      "bonus_points": 2.0,
      "description": "High-rated content bonus"
    }
  ]
}"""


def get_generation_prompt(user_request: str, available_libraries: list[dict[str, Any]] | None = None) -> str:
    """
    Build the prompt for profile generation.

    Args:
        user_request: User's natural language request
        available_libraries: Optional list of available Plex libraries

    Returns:
        Complete prompt string
    """
    libraries_info = ""
    if available_libraries:
        libraries_info = "\n\nBibliothèques Plex disponibles:\n"
        for lib in available_libraries:
            libraries_info += f"- ID: {lib.get('id')}, Nom: {lib.get('name')}, Type: {lib.get('type')}\n"

    return f"""Génère un profil de programmation JSON basé sur cette demande:

"{user_request}"
{libraries_info}
Le JSON doit suivre ce schéma (exemple):

{PROFILE_SCHEMA_EXAMPLE}

Règles importantes:
1. Les heures sont au format "HH:MM" (24h)
2. Les genres doivent être en anglais (Action, Comedy, Drama, Horror, Thriller, etc.)
3. Les age_rating sont: G, PG, PG-13, R, NC-17
4. Les content_types sont: movie, episode, show
5. Les opérateurs pour forbidden/mandatory: equals, not_equals, contains, not_contains, >=, <=, >, <
6. Les champs disponibles: genre, content_type, age_rating, tmdb_rating, year, studio, keyword, duration

Génère UNIQUEMENT le JSON, sans explications."""


def get_refinement_prompt(
    original_profile: dict[str, Any],
    validation_errors: list[str],
    attempt: int,
) -> str:
    """
    Build the prompt for profile refinement after validation failure.

    Args:
        original_profile: The profile that failed validation
        validation_errors: List of validation error messages
        attempt: Current attempt number

    Returns:
        Refinement prompt string
    """
    import json

    errors_text = "\n".join(f"- {error}" for error in validation_errors)

    return f"""Le profil JSON suivant contient des erreurs de validation. Corrige-les.

Profil actuel:
{json.dumps(original_profile, indent=2, ensure_ascii=False)}

Erreurs de validation:
{errors_text}

Tentative {attempt}/3. Génère un JSON corrigé sans les erreurs ci-dessus.
Génère UNIQUEMENT le JSON corrigé, sans explications."""


def get_modification_prompt(
    current_profile: dict[str, Any],
    modification_request: str,
) -> str:
    """
    Build the prompt for modifying an existing profile.

    Args:
        current_profile: The current profile to modify
        modification_request: User's modification request

    Returns:
        Modification prompt string
    """
    import json

    return f"""Modifie le profil de programmation suivant selon cette demande:

"{modification_request}"

Profil actuel:
{json.dumps(current_profile, indent=2, ensure_ascii=False)}

Applique UNIQUEMENT les modifications demandées. Garde le reste du profil intact.
Génère UNIQUEMENT le JSON modifié, sans explications."""


def get_time_blocks_prompt(
    schedule_description: str,
    content_types: list[str] | None = None,
) -> str:
    """
    Build the prompt for generating time blocks from a schedule description.

    Args:
        schedule_description: Natural language description of the schedule
        content_types: Available content types

    Returns:
        Time blocks generation prompt
    """
    types_info = ""
    if content_types:
        types_info = f"\nTypes de contenu disponibles: {', '.join(content_types)}"

    return f"""Génère les blocs horaires JSON pour cette grille de programmation:

"{schedule_description}"
{types_info}

Format attendu (array de time_blocks):
[
  {{
    "name": "Nom du bloc",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "criteria": {{
      "content_types": ["movie"],
      "genres": {{"include": [], "exclude": []}},
      "duration": {{"min_minutes": 0, "max_minutes": 180}},
      "age_rating": {{"max_rating": "PG-13"}}
    }}
  }}
]

Génère UNIQUEMENT le JSON (array), sans explications."""


# Recommended models for different use cases
RECOMMENDED_MODELS = {
    "profile_generation": [
        "llama3.1:8b",
        "llama3:8b",
        "mistral:7b",
        "mixtral:8x7b",
        "codellama:13b",
    ],
    "quick_modification": [
        "llama3.1:8b",
        "mistral:7b",
        "phi3:mini",
    ],
    "complex_schedule": [
        "llama3.1:70b",
        "mixtral:8x7b",
        "llama3:70b",
    ],
}


def get_recommended_model(task: str = "profile_generation") -> str:
    """
    Get the recommended model for a task.

    Args:
        task: Type of task (profile_generation, quick_modification, complex_schedule)

    Returns:
        Recommended model name
    """
    models = RECOMMENDED_MODELS.get(task, RECOMMENDED_MODELS["profile_generation"])
    return models[0] if models else "llama3.1:8b"
