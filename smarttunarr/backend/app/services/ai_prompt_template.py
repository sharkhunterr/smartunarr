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


# JSON Schema example for the prompt - matches actual profile schema v6
PROFILE_SCHEMA_EXAMPLE = """{
  "name": "Soirée Action",
  "version": "6.0",
  "libraries": [
    {"id": "1", "name": "Films", "type": "movie", "weight": 1.0, "enabled": true},
    {"id": "3", "name": "Séries", "type": "show", "weight": 0.5, "enabled": true}
  ],
  "description": "Profil pour soirée films d'action",
  "time_blocks": [
    {
      "name": "Prime Time",
      "description": "Soirée films d'action",
      "start_time": "20:00",
      "end_time": "23:00",
      "criteria": {
        "preferred_types": ["movie"],
        "allowed_types": ["movie", "episode"],
        "excluded_types": [],
        "preferred_genres": ["Action", "Thriller"],
        "allowed_genres": ["Action", "Thriller", "Adventure", "Sci-Fi"],
        "forbidden_genres": ["Horror", "Documentary"],
        "min_duration_min": 90,
        "max_duration_min": 150,
        "max_age_rating": "R",
        "allowed_age_ratings": ["G", "PG", "PG-13", "R"],
        "min_tmdb_rating": 6.0,
        "preferred_tmdb_rating": 7.5,
        "min_vote_count": 100,
        "max_release_age_years": 20,
        "exclude_keywords": ["gore", "extreme"],
        "include_keywords": ["blockbuster", "action-packed"]
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
    "rating": 1.5,
    "filter": 0.5,
    "bonus": 0.5,
    "keywords": 5,
    "collections": 5,
    "cast": 5,
    "temporal": 5
  },
  "mandatory_forbidden_criteria": {
    "mandatory": {
      "min_duration_min": 60,
      "min_tmdb_rating": 5.0,
      "min_vote_count": 50,
      "required_genres": [],
      "allowed_age_ratings": ["G", "PG", "PG-13", "R"]
    },
    "forbidden": {
      "types": [],
      "keywords": ["gore", "snuff"],
      "genres": ["Adult"],
      "age_ratings": ["NC-17"],
      "collections": []
    },
    "preferred": {
      "genres": ["Action", "Thriller"],
      "keywords": ["critically acclaimed"],
      "collections": [],
      "studios": [],
      "actors": [],
      "directors": []
    }
  },
  "strategies": {
    "maintain_sequence": false,
    "maximize_variety": true,
    "marathon_mode": false,
    "avoid_repeats_days": 7,
    "filler_insertion": {
      "enabled": true,
      "types": ["short", "trailer"],
      "max_duration_min": 30
    },
    "bonuses": {
      "holiday_bonus": false,
      "recent_release_bonus": true,
      "popular_content_bonus": true
    }
  },
  "enhanced_criteria": {
    "keywords_safety": {"enabled": false},
    "collections_franchises": {"enabled": false},
    "temporal_intelligence": {"enabled": false},
    "quality_indicators": {"enabled": false}
  },
  "default_iterations": 5,
  "default_randomness": 0.3
}"""

# Reference information for the AI
SCHEMA_REFERENCE = """
RÉFÉRENCE DES VALEURS POSSIBLES:

TYPES DE CONTENU (content types):
- movie: Film
- episode: Épisode de série
- show: Série complète

GENRES (en anglais, TMDB standard):
Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music, Mystery, Romance, Science Fiction, Thriller, TV Movie, War, Western

CLASSIFICATIONS D'ÂGE (age_rating):
- G: Tout public
- PG: Supervision parentale suggérée
- PG-13: Déconseillé aux moins de 13 ans
- R: Restreint (17+ accompagné)
- NC-17: Interdit aux moins de 17 ans
- NR: Non classé

POIDS DE NOTATION (scoring_weights) - valeurs de 0.0 à 5.0 pour les premiers, 0-100 pour les autres:
Poids principaux (0.0-5.0):
- type, duration, genre, timing, strategy, age, rating, filter, bonus
Poids additionnels v6 (0-100):
- keywords, collections, cast, temporal

STRATÉGIES:
- maintain_sequence: Garder l'ordre des épisodes de série
- maximize_variety: Éviter les répétitions de genres consécutifs
- marathon_mode: Programmer plusieurs épisodes/films similaires à la suite
- avoid_repeats_days: Jours minimum avant de reprogrammer le même contenu

PARAMÈTRES PAR DÉFAUT:
- default_iterations: Nombre d'itérations (entier, 1-100, ex: 5)
- default_randomness: Niveau d'aléatoire (décimal entre 0.0 et 1.0, ex: 0.3 = 30%)

FORMAT DES HEURES: "HH:MM" (format 24h, ex: "20:00", "06:30")
"""


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
        libraries_info = "\n\nBIBLIOTHÈQUES PLEX DISPONIBLES (utilise ces IDs dans le champ 'libraries'):\n"
        for lib in available_libraries:
            lib_type = lib.get('type', 'movie')
            libraries_info += f'  {{"id": "{lib.get("id")}", "name": "{lib.get("name")}", "type": "{lib_type}", "weight": 1.0, "enabled": true}}\n'

    return f"""Génère un profil de programmation TV au format JSON basé sur cette demande:

"{user_request}"
{libraries_info}
{SCHEMA_REFERENCE}

EXEMPLE DE STRUCTURE JSON VALIDE:
{PROFILE_SCHEMA_EXAMPLE}

RÈGLES CRITIQUES:
1. Version DOIT être "6.0"
2. Le champ "libraries" DOIT utiliser "id" (pas "plex_library_id")
3. Les heures au format "HH:MM" (24h)
4. Les genres en ANGLAIS (Action, Comedy, Drama, Horror, Thriller, Animation, etc.)
5. Inclure: description, scoring_weights (avec keywords, collections, cast, temporal), mandatory_forbidden_criteria, strategies, enhanced_criteria
6. default_randomness: décimal entre 0.0 et 1.0 (ex: 0.3)
7. Utiliser les bibliothèques fournies ci-dessus si disponibles

Génère UNIQUEMENT le JSON complet et valide, sans explications ni commentaires."""


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


def get_improvement_prompt(
    current_programs: list[dict[str, Any]],
    user_feedback: str,
    all_iterations: list[dict[str, Any]] | None = None,
) -> str:
    """
    Build the prompt for AI-assisted programming improvement.

    Args:
        current_programs: Current best iteration programs
        user_feedback: User's feedback/improvement request
        all_iterations: All iterations data (optional, for context)

    Returns:
        Improvement prompt string
    """
    import json

    # Summarize current programs for the prompt
    programs_summary = []
    for prog in current_programs[:50]:  # Limit to avoid too long prompts
        programs_summary.append({
            "title": prog.get("title", ""),
            "type": prog.get("type", "movie"),
            "score": prog.get("score", {}).get("total", 0) if prog.get("score") else 0,
            "genres": prog.get("genres", [])[:3],  # Limit genres
            "start_time": prog.get("start_time", "")[:16],  # Just date+hour:min
            "duration_min": round(prog.get("duration_min", 0)),
            "block": prog.get("block_name", ""),
            "forbidden_violated": prog.get("score", {}).get("forbidden_violated", False) if prog.get("score") else False,
        })

    # Build iteration summary if available
    iterations_info = ""
    if all_iterations and len(all_iterations) > 1:
        iterations_summary = []
        for it in all_iterations[:10]:  # Show top 10 iterations
            iterations_summary.append({
                "iteration": it.get("iteration", 0),
                "score": round(it.get("average_score", 0), 1),
                "programs": it.get("program_count", 0),
                "is_optimized": it.get("is_optimized", False),
                "is_improved": it.get("is_improved", False),
            })
        iterations_info = f"""
TOUTES LES ITÉRATIONS DISPONIBLES (triées par score décroissant):
{json.dumps(iterations_summary, indent=2, ensure_ascii=False)}
"""

    return f"""Tu es un assistant expert en programmation TV. L'utilisateur te demande d'améliorer une programmation générée.

PROGRAMMATION ACTUELLE (résumé):
{json.dumps(programs_summary, indent=2, ensure_ascii=False)}
{iterations_info}
DEMANDE DE L'UTILISATEUR:
"{user_feedback}"

Analyse la programmation actuelle et la demande de l'utilisateur, puis suggère des améliorations concrètes.

Réponds en JSON avec ce format:
{{
  "analysis": "Ton analyse de la programmation actuelle et des problèmes identifiés",
  "suggestions": [
    {{
      "type": "replace|reorder|remove|add",
      "target": "titre ou bloc concerné",
      "reason": "pourquoi ce changement",
      "suggestion": "ce que tu suggères à la place"
    }}
  ],
  "profile_adjustments": {{
    "scoring_weights": {{"critère": "augmenter|diminuer|inchangé"}},
    "time_blocks": ["ajustements suggérés pour les blocs horaires"],
    "forbidden": ["contenus/genres à ajouter aux interdits"],
    "preferred": ["contenus/genres à favoriser"]
  }},
  "summary": "Résumé en une phrase des améliorations principales"
}}

Génère UNIQUEMENT le JSON, sans explications supplémentaires."""


def get_ai_improvement_prompt(
    current_programs: list[dict[str, Any]],
    user_feedback: str,
    all_iterations: list[dict[str, Any]] | None = None,
) -> str:
    """Build a simple prompt for AI programming improvement."""

    # Format current programs simply
    current_list = []
    for prog in current_programs:
        title = prog.get('title', '')
        block = prog.get("block_name", "")
        studios = ", ".join(prog.get("studios", [])) if prog.get("studios") else ""
        current_list.append(f'"{title}" - {block}' + (f" - Studios: {studios}" if studios else ""))

    # Collect alternatives from other iterations
    current_titles = {p.get("title", "") for p in current_programs}
    alternatives = []
    if all_iterations:
        seen = set()
        for it in all_iterations:
            for prog in it.get("programs", []):
                title = prog.get("title", "")
                if title and title not in current_titles and title not in seen:
                    seen.add(title)
                    studios = ", ".join(prog.get("studios", [])) if prog.get("studios") else ""
                    alternatives.append(f'"{title}"' + (f" - Studios: {studios}" if studios else ""))

    return f"""PROGRAMMATION ACTUELLE:
{chr(10).join(current_list)}

ALTERNATIVES DISPONIBLES:
{chr(10).join(alternatives)}

DEMANDE: {user_feedback}

Réponds en JSON:
{{"analysis": "...", "modifications": [{{"action": "replace", "original_title": "titre actuel", "replacement_title": "titre alternatif", "reason": "..."}}], "summary": "..."}}

Utilise UNIQUEMENT les titres ci-dessus."""


# Recommended models for different use cases
RECOMMENDED_MODELS = {
    "profile_generation": [
        "qwen3:14b",
        "llama3.1:8b",
        "llama3:8b",
        "mistral:7b",
        "mixtral:8x7b",
        "codellama:13b",
    ],
    "quick_modification": [
        "qwen3:14b",
        "llama3.1:8b",
        "mistral:7b",
        "phi3:mini",
    ],
    "complex_schedule": [
        "qwen3:14b",
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
