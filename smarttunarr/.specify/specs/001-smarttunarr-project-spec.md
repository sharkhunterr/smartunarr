# Project Specification: SmartTunarr

**Project**: SmartTunarr - Intelligent TV Channel Programming System
**Created**: 2026-01-27
**Status**: Draft
**Version**: 1.0.0

## Executive Summary

SmartTunarr est un système intelligent de programmation de chaînes TV pour Tunarr. Il permet de générer, optimiser et noter des programmes TV via un système de scoring hiérarchique sophistiqué, des profils de configuration JSON, et une intégration IA optionnelle via Ollama.

## User Scenarios & Testing

### User Story 1 - Programmer une chaîne via profil JSON (Priority: P1)

En tant qu'administrateur, je veux pouvoir programmer une chaîne Tunarr en utilisant un profil de configuration JSON qui définit mes critères de sélection (genres préférés, contenus interdits, blocs horaires, etc.) afin d'obtenir automatiquement la meilleure programmation possible.

**Why this priority**: C'est la fonctionnalité core du projet - sans elle, aucune autre fonctionnalité n'a de sens.

**Independent Test**: L'utilisateur charge un profil JSON, sélectionne une chaîne, lance la programmation et obtient un programme optimisé avec score.

**Acceptance Scenarios**:

1. **Given** un profil JSON valide et une chaîne Tunarr configurée, **When** je lance la programmation avec 10 itérations, **Then** le système génère 10 propositions et sélectionne celle avec le meilleur score global.

2. **Given** un profil avec des contenus forbidden (genre "Horror"), **When** la programmation est générée, **Then** aucun contenu Horror n'apparaît dans le programme final.

3. **Given** un profil avec des contenus mandatory (genre "Animation"), **When** la programmation est générée, **Then** des contenus Animation sont inclus et leur absence génère une pénalité visible.

4. **Given** un profil avec des blocs horaires définis (Morning 06:00-12:00, Afternoon 12:00-18:00), **When** la programmation est affichée, **Then** chaque contenu est assigné au bon bloc avec heure de début/fin précise.

---

### User Story 2 - Noter un programme existant (Priority: P1)

En tant qu'administrateur, je veux pouvoir analyser et noter un programme déjà en place sur une chaîne Tunarr pour obtenir un rapport détaillé de conformité avec mes critères.

**Why this priority**: Fonctionnalité complémentaire essentielle pour évaluer les programmes existants sans modification.

**Independent Test**: L'utilisateur sélectionne une chaîne existante, lance la notation, et obtient un tableau détaillé avec tous les scores.

**Acceptance Scenarios**:

1. **Given** une chaîne Tunarr avec un programme existant, **When** je lance la notation, **Then** j'obtiens un score global et le détail par programme (type, genre, timing, etc.).

2. **Given** un programme avec des violations forbidden, **When** je consulte le rapport, **Then** chaque violation est clairement identifiée avec le critère violé.

3. **Given** un rapport de notation complet, **When** j'exporte le tableau, **Then** j'obtiens toutes les colonnes: titre, score total, score type, score genre, score timing, forbidden, mandatory, bonus, etc.

---

### User Story 3 - Programmer via IA (Ollama) (Priority: P2)

En tant qu'utilisateur, je veux pouvoir décrire en langage naturel le type de programmation souhaitée et laisser l'IA générer le profil JSON correspondant.

**Why this priority**: Fonctionnalité avancée qui simplifie l'utilisation mais nécessite le système de base fonctionnel.

**Independent Test**: L'utilisateur écrit un prompt, le système génère un JSON, le valide, puis exécute la programmation.

**Acceptance Scenarios**:

1. **Given** un service Ollama configuré, **When** j'écris "Je veux une programmation familiale avec des films d'animation et de comédie, sans violence", **Then** le système génère un profil JSON avec Animation et Comedy en preferred, et des mots-clés violence en forbidden.

2. **Given** un JSON généré invalide, **When** la validation échoue, **Then** le système affiche les erreurs et propose une correction ou reformulation.

3. **Given** un JSON généré valide, **When** je confirme, **Then** la programmation s'exécute automatiquement avec ce profil.

---

### User Story 4 - Gérer les profils de programmation (Priority: P2)

En tant qu'administrateur, je veux pouvoir créer, modifier, importer et exporter mes profils de programmation avec des paramètres par défaut associés.

**Why this priority**: Essentiel pour la réutilisation et le partage de configurations.

**Independent Test**: L'utilisateur peut CRUD complet sur les profils, les associer à des labels, définir des defaults.

**Acceptance Scenarios**:

1. **Given** l'interface de gestion des profils, **When** j'importe un fichier JSON, **Then** le profil est validé et ajouté à ma liste.

2. **Given** un profil existant, **When** je l'exporte, **Then** j'obtiens un fichier JSON téléchargeable avec tous les paramètres.

3. **Given** un profil, **When** je lui associe des paramètres par défaut (iterations: 20, randomness: 0.3), **Then** ces valeurs sont pré-remplies lors de son utilisation.

4. **Given** plusieurs profils, **When** je leur assigne des labels (kids, cinephile, blockbuster), **Then** je peux filtrer ma liste par label.

---

### User Story 5 - Visualiser les programmes (Priority: P2)

En tant qu'utilisateur, je veux voir les programmes générés ou notés avec un affichage clair incluant les blocs horaires, les scores colorés, et les heures précises.

**Why this priority**: La visualisation est essentielle pour comprendre et valider les résultats.

**Independent Test**: L'utilisateur voit une timeline/grille avec tous les éléments visuels requis.

**Acceptance Scenarios**:

1. **Given** un programme généré, **When** je l'affiche, **Then** chaque élément montre: titre, heure début, heure fin, note (si activée), couleur selon la note (vert = bon, rouge = mauvais).

2. **Given** un affichage avec notation activée, **When** je consulte un élément, **Then** je vois le détail du score (breakdown par critère).

3. **Given** des blocs horaires définis, **When** j'affiche le programme, **Then** les blocs sont visuellement délimités avec leur nom (Morning, Prime Time, etc.).

---

### User Story 6 - Configurer les services (Priority: P2)

En tant qu'administrateur, je veux configurer les connexions aux services externes (Plex, TMDB, Tunarr, Ollama) via une interface dédiée.

**Why this priority**: Prérequis technique pour que les autres fonctionnalités marchent.

**Independent Test**: L'utilisateur configure chaque service et teste la connexion.

**Acceptance Scenarios**:

1. **Given** l'onglet Paramètres > Services, **When** je configure Plex (URL + token), **Then** je peux tester la connexion et voir les bibliothèques disponibles.

2. **Given** une clé API TMDB, **When** je la sauvegarde, **Then** l'enrichissement des métadonnées est activé.

3. **Given** la configuration Tunarr (URL + credentials), **When** je teste, **Then** je vois la liste des chaînes disponibles.

4. **Given** un endpoint Ollama configuré, **When** je teste, **Then** je vois les modèles disponibles et peux en sélectionner un par défaut.

---

### User Story 7 - Consulter l'historique (Priority: P3)

En tant qu'utilisateur, je veux voir l'historique de toutes les programmations et notations effectuées.

**Why this priority**: Fonctionnalité de confort pour le suivi et l'audit.

**Independent Test**: L'utilisateur consulte une liste chronologique avec filtres.

**Acceptance Scenarios**:

1. **Given** plusieurs programmations effectuées, **When** je consulte l'historique, **Then** je vois date, type (programmation/notation), chaîne, profil utilisé, score global.

2. **Given** un élément d'historique, **When** je clique dessus, **Then** je peux voir le détail complet de l'opération.

3. **Given** l'historique, **When** je filtre par chaîne ou par date, **Then** la liste est filtrée en conséquence.

---

### User Story 8 - Changer thème et langue (Priority: P3)

En tant qu'utilisateur, je veux pouvoir changer le thème (light/dark/system) et la langue de l'interface.

**Why this priority**: Confort utilisateur, non bloquant.

**Independent Test**: L'utilisateur change le thème et la langue, les changements sont persistés.

**Acceptance Scenarios**:

1. **Given** l'interface en mode light, **When** je sélectionne dark, **Then** l'interface passe en dark theme immédiatement.

2. **Given** le mode system sélectionné, **When** mon OS passe en dark mode, **Then** l'interface suit automatiquement.

3. **Given** l'interface en français, **When** je sélectionne English, **Then** tous les textes de l'UI passent en anglais.

---

### Edge Cases

- Que se passe-t-il si la connexion Tunarr est perdue pendant une programmation?
- Comment gérer un profil JSON avec une syntaxe invalide?
- Que faire si Ollama génère un JSON non conforme au schéma après 3 tentatives?
- Comment gérer un programme qui dépasse minuit (bloc 21:00-06:00)?
- Que se passe-t-il si une bibliothèque Plex référencée dans le profil n'existe plus?
- Comment gérer les conflits entre critères mandatory contradictoires?
- Que faire si le cache TMDB est corrompu?

## Requirements

### Functional Requirements

#### Core - Programmation

- **FR-001**: Le système DOIT pouvoir lire les programmes existants d'une chaîne Tunarr via son API
- **FR-002**: Le système DOIT pouvoir écrire/programmer une chaîne Tunarr via son API
- **FR-003**: Le système DOIT calculer un score hiérarchique (Programme → Bloc → Global) pour chaque programme
- **FR-004**: Le système DOIT supporter N itérations de génération avec sélection du meilleur score
- **FR-005**: Le système DOIT supporter un facteur d'aléatoire configurable pour varier les résultats
- **FR-006**: Le système DOIT proposer le remplacement de contenu forbidden par un meilleur contenu

#### Core - Scoring

- **FR-010**: Le système DOIT calculer 9 critères au niveau programme (type, durée, genre, timing, stratégie, âge, rating, filtres, bonus contextuels)
- **FR-011**: Le système DOIT appliquer les règles mandatory/forbidden strictement (forbidden = exclusion, mandatory = pénalité si absent)
- **FR-012**: Le système DOIT fournir un tableau de notation détaillé avec toutes les colonnes de scores
- **FR-013**: Le système DOIT supporter les critères: genres, âge, rating TMDB, mots-clés, studios, collections, budget, revenus, votes

#### Core - Profils

- **FR-020**: Les profils DOIVENT être au format JSON et validés par un schéma
- **FR-021**: Les profils DOIVENT définir: bibliothèques sources, critères mandatory/forbidden/preferred, blocs horaires, stratégies
- **FR-022**: Le système DOIT permettre l'import/export de profils
- **FR-023**: Le système DOIT permettre d'associer des paramètres par défaut à un profil
- **FR-024**: Le système DOIT supporter les labels/tags pour organiser les profils

#### Metadata

- **FR-030**: Le système DOIT supporter le mode Cache-only (SQLite local)
- **FR-031**: Le système DOIT supporter le mode TMDB-only (requêtes directes)
- **FR-032**: Le système DOIT supporter le mode Cache + Enrichissement TMDB
- **FR-033**: Le système DOIT supporter le mode Plex-only
- **FR-034**: Le système DOIT enrichir le cache local avec les données TMDB récupérées

#### UI

- **FR-040**: L'interface DOIT être responsive (desktop, tablette, smartphone)
- **FR-041**: L'interface DOIT supporter 3 thèmes: light, dark, system
- **FR-042**: L'interface DOIT supporter l'internationalisation (multi-langue)
- **FR-043**: L'affichage des programmes DOIT inclure: titre, note colorée, heure début/fin, blocs horaires visuels
- **FR-044**: L'interface DOIT avoir une section Paramètres pour les services et logs

#### IA Integration

- **FR-050**: Le système DOIT permettre de saisir un prompt en langage naturel
- **FR-051**: Le système DOIT envoyer le prompt à Ollama avec un exemple de profil JSON
- **FR-052**: Le système DOIT valider le JSON généré par l'IA
- **FR-053**: Le système DOIT proposer correction ou reformulation si le JSON est invalide
- **FR-054**: Le système DOIT conserver l'historique des prompts et résultats

#### Historique & Logs

- **FR-060**: Le système DOIT enregistrer toutes les programmations effectuées
- **FR-061**: Le système DOIT enregistrer toutes les notations effectuées
- **FR-062**: Le système DOIT permettre de consulter l'historique avec filtres (date, chaîne, profil)
- **FR-063**: Le système DOIT exposer les logs applicatifs dans l'interface

#### Infrastructure

- **FR-070**: L'application DOIT fonctionner dans un conteneur Docker unique
- **FR-071**: L'application DOIT être configurable via variables d'environnement
- **FR-072**: L'application DOIT fournir une documentation de déploiement

### Key Entities

- **Profile**: Configuration JSON définissant les critères de programmation (bibliothèques, mandatory/forbidden, blocs, stratégies)
- **Program**: Liste ordonnée de contenus avec leurs métadonnées et scores
- **Content**: Élément média (film, série, bande-annonce) avec métadonnées
- **TimeBlock**: Bloc horaire avec nom, heure début/fin, critères spécifiques
- **ScoringResult**: Résultat de notation avec scores détaillés par critère
- **Channel**: Chaîne Tunarr avec son programme actuel
- **Service**: Configuration de connexion à un service externe (Plex, TMDB, Tunarr, Ollama)
- **HistoryEntry**: Enregistrement d'une opération (programmation ou notation) avec métadonnées

## Technical Architecture

### Backend (Python/FastAPI)

```
smarttunarr/
├── api/                      # FastAPI endpoints
│   ├── routes/
│   │   ├── programming.py    # Endpoints programmation
│   │   ├── scoring.py        # Endpoints notation
│   │   ├── profiles.py       # CRUD profils
│   │   ├── channels.py       # Gestion chaînes
│   │   ├── services.py       # Configuration services
│   │   ├── history.py        # Historique
│   │   └── ai.py             # Intégration Ollama
│   └── websocket.py          # Progress en temps réel
├── core/
│   ├── scoring/              # Système de notation
│   │   ├── engine.py         # Moteur principal
│   │   ├── criteria/         # Critères individuels
│   │   └── result.py         # Structures résultat
│   ├── programming/          # Génération programmes
│   │   ├── generator.py      # Générateur itératif
│   │   ├── optimizer.py      # Optimisation
│   │   └── validator.py      # Validation
│   ├── blocks/               # Gestion blocs horaires
│   └── orchestrator.py       # Orchestration workflow
├── adapters/                 # Adaptateurs sources
│   ├── tunarr.py
│   ├── plex.py
│   └── metadata/
│       ├── cache.py
│       └── tmdb.py
├── services/                 # Services externes
│   ├── tunarr_service.py
│   ├── plex_service.py
│   ├── tmdb_service.py
│   └── ollama_service.py
├── models/                   # Modèles de données
├── schemas/                  # Schémas Pydantic + JSON validation
├── db/                       # SQLite cache + historique
└── config.py                 # Configuration
```

### Frontend (Vue.js/React + TypeScript)

```
frontend/
├── src/
│   ├── components/
│   │   ├── programming/      # Composants programmation
│   │   ├── scoring/          # Composants notation
│   │   ├── profiles/         # Gestion profils
│   │   ├── timeline/         # Affichage timeline
│   │   └── common/           # Composants partagés
│   ├── views/
│   │   ├── Programming.vue   # Page programmation
│   │   ├── Scoring.vue       # Page notation
│   │   ├── Profiles.vue      # Page profils
│   │   ├── History.vue       # Page historique
│   │   └── Settings.vue      # Page paramètres
│   ├── stores/               # État global
│   ├── services/             # Appels API
│   ├── i18n/                 # Traductions
│   └── themes/               # CSS thèmes
```

### Docker

```dockerfile
# Image unique contenant backend + frontend
FROM python:3.11-slim

# Frontend build (node)
# Backend (uvicorn/FastAPI)
# SQLite database volume
# Configuration via ENV
```

## Success Criteria

### Measurable Outcomes

- **SC-001**: La programmation d'une chaîne de 24h DOIT se compléter en moins de 2 minutes (10 itérations)
- **SC-002**: Le système DOIT supporter un cache de 30,000+ films sans dégradation
- **SC-003**: L'interface DOIT être utilisable sur un écran de 320px de large (smartphone)
- **SC-004**: Le score calculé DOIT être reproductible (même inputs = même score)
- **SC-005**: 100% des règles forbidden DOIVENT être respectées (aucun contenu forbidden dans le résultat final)
- **SC-006**: Les profils v4 existants du système legacy DOIVENT être compatibles

### Quality Attributes

- **Performance**: Réponse UI < 200ms, programmation < 2min
- **Fiabilité**: Aucune perte de données sur crash, reprise possible
- **Maintenabilité**: Couverture tests > 80% sur le core scoring
- **Sécurité**: Pas d'exposition de credentials dans les logs

## Appendix: Profil JSON Structure

```json
{
  "profile_name": "blockbuster_family",
  "version": "5.0",
  "libraries": [
    {"name": "Films", "type": "movie", "plex_id": "..."}
  ],
  "time_blocks": [
    {
      "name": "morning",
      "start_time": "06:00",
      "end_time": "12:00",
      "criteria": {}
    },
    {
      "name": "prime_time",
      "start_time": "20:00",
      "end_time": "23:00",
      "criteria": {}
    }
  ],
  "mandatory_forbidden_criteria": {
    "genre_criteria": {
      "mandatory_genres": {"required": true, "genres": ["Action", "Adventure"]},
      "forbidden_genres": {"enabled": true, "genres": ["Horror", "Thriller"]}
    },
    "age_criteria": {
      "mandatory_age": {"required": true, "allowed_ratings": ["G", "PG", "+12"]},
      "forbidden_age": {"enabled": true, "forbidden_ratings": ["+18"]}
    },
    "rating_criteria": {
      "mandatory_rating": {"required": false, "min_tmdb_rating": 6.5, "min_vote_count": 500}
    },
    "content_safety": {
      "forbidden_keywords": {"enabled": true, "dangerous_keywords": ["violence", "gore"]},
      "mandatory_keywords": {"required": false, "safe_keywords": ["family"]}
    }
  },
  "strategies": [
    {"type": "movie_sequence", "count": 4},
    {"type": "trailer_insert", "after": 1}
  ],
  "scoring_weights": {
    "type": 20,
    "duration": 15,
    "genre": 25,
    "timing": 20,
    "strategy": 20,
    "age": 20,
    "rating": 20,
    "filters": 20,
    "bonus": 20
  }
}
```
