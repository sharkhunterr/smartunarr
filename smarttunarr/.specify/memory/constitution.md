<!--
Sync Impact Report
==================
Version change: 0.0.0 → 1.0.0 (Initial ratification)

Added sections:
- 8 Core Principles defining project governance
- Technical Stack section
- Integration & API Standards section
- Development Workflow section
- Governance rules

Templates requiring updates:
- .specify/templates/plan-template.md: ⚠ pending (verify scoring references)
- .specify/templates/spec-template.md: ⚠ pending (add scoring criteria section)
- .specify/templates/tasks-template.md: ⚠ pending (add scoring/profile task types)

Follow-up TODOs: None
-->

# SmartTunarr Constitution

## Core Principles

### I. Scoring-First Architecture

Le système de notation est le cœur du projet SmartTunarr. Toute décision de programmation DOIT être justifiée par un score calculé selon le système hiérarchique à 3 niveaux:

- **Niveau Programme** (180 points max): Type, durée, genre, timing, stratégie, classification d'âge, rating multi-source, filtres de contenu, bonus contextuels
- **Niveau Bloc** (100 points): Moyenne des programmes, conformité stratégie, déviation timing, conformité filtres
- **Niveau Global** (100 points): Cohérence inter-blocs, diversité globale

Toute modification du système de scoring DOIT être documentée avec les impacts sur les scores existants.

### II. Profile-Driven Configuration

Toute configuration de programmation DOIT être définie via des profils JSON validables:

- Les profils définissent: bibliothèques sources, critères mandatory/forbidden/preferred, blocs horaires, stratégies, paramètres de scoring
- Chaque profil DOIT être validé par un schéma JSON avant utilisation
- Les profils DOIVENT être versionnés et exportables/importables
- Un profil template DOIT toujours exister comme référence

### III. Mandatory/Forbidden Compliance (NON-NÉGOCIABLE)

Le respect des règles mandatory/forbidden est une contrainte absolue:

- **Forbidden** = Exclusion immédiate (score 0 ou pénalité maximale)
- **Mandatory (required=true)** = Présence obligatoire, absence = forte pénalité
- **Mandatory (required=false)** = Bonus si présent, pas de pénalité si absent
- Les critères supportés: genres, âge, rating, mots-clés, studios, collections, budget, revenus
- Toute violation d'un critère forbidden DOIT être visible dans le rapport de notation

### IV. Multi-Source Metadata Strategy

La gestion des métadonnées suit une stratégie configurable:

- **Cache-only**: Utilise uniquement le cache SQLite local (performance maximale)
- **TMDB-only**: Requêtes directes à TMDB (données fraîches)
- **Cache + Enrichissement TMDB**: Cache prioritaire, enrichissement TMDB si manquant
- **Plex-only**: Métadonnées directement depuis les bibliothèques Plex
- **Hybrid**: Combinaison configurable des sources

Chaque source DOIT implémenter l'interface `MetadataAdapter` pour garantir l'interchangeabilité.

### V. Block-Based Scheduling

La programmation est organisée en blocs horaires:

- Chaque bloc DOIT avoir: nom, heure début, heure fin, critères de scoring spécifiques
- Le système DOIT gérer les blocs traversant minuit (ex: 21:00-06:00)
- L'assignation de contenu aux blocs est séquentielle et basée sur la durée réelle
- La réassignation DOIT être effectuée après correction des durées par métadonnées

### VI. Iterative Optimization

La génération de programmes optimaux utilise un processus itératif:

- Le nombre d'itérations DOIT être configurable par l'utilisateur
- Chaque itération génère une proposition de programme avec score global
- Un facteur d'aléatoire DOIT être configurable pour éviter les résultats identiques
- Le meilleur programme (score le plus élevé) est sélectionné automatiquement
- Le remplacement de contenu forbidden par un meilleur contenu DOIT être proposé

### VII. Responsive UI/UX

L'interface web DOIT respecter ces standards:

- Design responsive: desktop, tablette, smartphone
- Thèmes: light, dark, system (détection automatique)
- Internationalisation: système de traduction multi-langue
- Affichage des programmes: titre, note colorée, heure début/fin, blocs horaires visuels
- Accessibilité: contrastes suffisants, navigation clavier, ARIA labels

### VIII. AI Integration Ready

L'intégration IA via Ollama est une fonctionnalité de première classe:

- Le prompt utilisateur DOIT être transformé en profil JSON valide
- Le JSON généré DOIT passer la validation de schéma avant exécution
- En cas d'échec de validation, le système DOIT proposer une correction ou demander reformulation
- L'historique des prompts et résultats DOIT être conservé
- La configuration Ollama (endpoint, modèle) DOIT être dans les paramètres services

## Technical Stack

### Backend
- **Runtime**: Python 3.11+ avec FastAPI
- **Base de données**: SQLite pour le cache métadonnées (30,000+ films supportés)
- **API externe**: TMDB API, Plex API, Tunarr API
- **IA**: Ollama (local LLM) pour génération de profils

### Frontend
- **Framework**: Framework moderne (Vue.js/React) avec TypeScript
- **Style**: CSS moderne avec variables pour thèmes
- **État**: Gestion d'état centralisée pour les sessions de programmation

### Infrastructure
- **Déploiement**: Docker unique (monolithe containerisé)
- **Configuration**: Variables d'environnement + fichiers de configuration
- **Logs**: Logging structuré avec niveaux configurables

## Integration & API Standards

### Tunarr Integration
- Toute interaction avec Tunarr DOIT passer par `TunarrService`
- La programmation de chaînes utilise l'API Tunarr existante
- Le système DOIT pouvoir lire les programmes existants pour notation

### Plex Integration
- L'accès aux bibliothèques Plex DOIT passer par `PlexAdapter`
- Les métadonnées Plex sont considérées comme source primaire pour le contenu

### Services Configuration
Les services suivants DOIVENT être configurables via l'interface:
- Plex: URL, token
- TMDB: API key
- Tunarr: URL, credentials
- Ollama: endpoint, modèle par défaut

## Development Workflow

### Code Quality
- Tests unitaires OBLIGATOIRES pour le système de scoring
- Tests d'intégration pour les adaptateurs (Plex, TMDB, Tunarr)
- Validation de schéma JSON pour tous les profils
- Couverture de code minimale: 80% pour le scoring core

### Documentation
- Documentation utilisateur pour la configuration Docker
- Documentation API pour les endpoints REST
- Documentation des profils JSON avec exemples
- Changelog maintenu pour chaque version

### Legacy Compatibility
- Le nouveau système DOIT pouvoir reproduire les scores de l'ancien système
- Les engines de compatibilité (`exact_scoring_engine`, `legacy_exact_engine`) DOIVENT être maintenus
- Les profils v4 existants DOIVENT rester compatibles

## Governance

Cette constitution régit toutes les décisions de développement du projet SmartTunarr.

### Règles d'amendement
1. Toute modification de la constitution DOIT être documentée dans le Sync Impact Report
2. Les changements de principes de scoring DOIVENT inclure une analyse d'impact sur les scores existants
3. L'ajout de nouvelles sources de métadonnées DOIT suivre le pattern Adapter existant

### Versioning
- **MAJOR**: Changement de structure de scoring, suppression de critère mandatory/forbidden
- **MINOR**: Ajout de nouveau critère, nouvelle source de données, nouvelle fonctionnalité UI
- **PATCH**: Corrections de bugs, améliorations de performance, clarifications documentation

### Compliance
- Chaque PR DOIT vérifier la conformité avec cette constitution
- Les violations de principes NON-NÉGOCIABLES bloquent le merge
- Le fichier `docs/` contient les guides de développement détaillés

**Version**: 1.0.0 | **Ratified**: 2026-01-27 | **Last Amended**: 2026-01-27
