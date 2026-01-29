# Feature Specification: SmartTunarr - Intelligent TV Channel Programming System

**Feature Branch**: `001-tv-channel-programming`
**Created**: 2026-01-27
**Status**: Draft
**Version**: 1.0.0

## Executive Summary

SmartTunarr est un systeme intelligent de programmation de chaines TV pour Tunarr. Il permet de generer, optimiser et noter des programmes TV via un systeme de scoring hierarchique sophistique, des profils de configuration JSON, et une integration IA optionnelle via Ollama.

## User Scenarios & Testing

### User Story 1 - Programmer une chaine via profil JSON (Priority: P1)

En tant qu'administrateur, je veux pouvoir programmer une chaine Tunarr en utilisant un profil de configuration JSON qui definit mes criteres de selection (genres preferes, contenus interdits, blocs horaires, etc.) afin d'obtenir automatiquement la meilleure programmation possible.

**Why this priority**: C'est la fonctionnalite core du projet - sans elle, aucune autre fonctionnalite n'a de sens.

**Independent Test**: L'utilisateur charge un profil JSON, selectionne une chaine, lance la programmation et obtient un programme optimise avec score.

**Acceptance Scenarios**:

1. **Given** un profil JSON valide et une chaine Tunarr configuree, **When** je lance la programmation avec 10 iterations, **Then** le systeme genere 10 propositions et selectionne celle avec le meilleur score global.

2. **Given** un profil avec des contenus forbidden (genre "Horror"), **When** la programmation est generee, **Then** aucun contenu Horror n'apparait dans le programme final.

3. **Given** un profil avec des contenus mandatory (genre "Animation"), **When** la programmation est generee, **Then** des contenus Animation sont inclus et leur absence genere une penalite visible.

4. **Given** un profil avec des blocs horaires definis (Morning 06:00-12:00, Afternoon 12:00-18:00), **When** la programmation est affichee, **Then** chaque contenu est assigne au bon bloc avec heure de debut/fin precise.

---

### User Story 2 - Noter un programme existant (Priority: P1)

En tant qu'administrateur, je veux pouvoir analyser et noter un programme deja en place sur une chaine Tunarr pour obtenir un rapport detaille de conformite avec mes criteres.

**Why this priority**: Fonctionnalite complementaire essentielle pour evaluer les programmes existants sans modification.

**Independent Test**: L'utilisateur selectionne une chaine existante, lance la notation, et obtient un tableau detaille avec tous les scores.

**Acceptance Scenarios**:

1. **Given** une chaine Tunarr avec un programme existant, **When** je lance la notation, **Then** j'obtiens un score global et le detail par programme (type, genre, timing, etc.).

2. **Given** un programme avec des violations forbidden, **When** je consulte le rapport, **Then** chaque violation est clairement identifiee avec le critere viole.

3. **Given** un rapport de notation complet, **When** j'exporte le tableau, **Then** j'obtiens toutes les colonnes: titre, score total, score type, score genre, score timing, forbidden, mandatory, bonus, etc.

---

### User Story 3 - Programmer via IA (Ollama) (Priority: P2)

En tant qu'utilisateur, je veux pouvoir decrire en langage naturel le type de programmation souhaitee et laisser l'IA generer le profil JSON correspondant.

**Why this priority**: Fonctionnalite avancee qui simplifie l'utilisation mais necessite le systeme de base fonctionnel.

**Independent Test**: L'utilisateur ecrit un prompt, le systeme genere un JSON, le valide, puis execute la programmation.

**Acceptance Scenarios**:

1. **Given** un service Ollama configure, **When** j'ecris "Je veux une programmation familiale avec des films d'animation et de comedie, sans violence", **Then** le systeme genere un profil JSON avec Animation et Comedy en preferred, et des mots-cles violence en forbidden.

2. **Given** un JSON genere invalide, **When** la validation echoue, **Then** le systeme affiche les erreurs et propose une correction ou reformulation.

3. **Given** un JSON genere valide, **When** je confirme, **Then** la programmation s'execute automatiquement avec ce profil.

---

### User Story 4 - Gerer les profils de programmation (Priority: P2)

En tant qu'administrateur, je veux pouvoir creer, modifier, importer et exporter mes profils de programmation avec des parametres par defaut associes.

**Why this priority**: Essentiel pour la reutilisation et le partage de configurations.

**Independent Test**: L'utilisateur peut CRUD complet sur les profils, les associer a des labels, definir des defaults.

**Acceptance Scenarios**:

1. **Given** l'interface de gestion des profils, **When** j'importe un fichier JSON, **Then** le profil est valide et ajoute a ma liste.

2. **Given** un profil existant, **When** je l'exporte, **Then** j'obtiens un fichier JSON telechargeable avec tous les parametres.

3. **Given** un profil, **When** je lui associe des parametres par defaut (iterations: 20, randomness: 0.3), **Then** ces valeurs sont pre-remplies lors de son utilisation.

4. **Given** plusieurs profils, **When** je leur assigne des labels (kids, cinephile, blockbuster), **Then** je peux filtrer ma liste par label.

---

### User Story 5 - Visualiser les programmes (Priority: P2)

En tant qu'utilisateur, je veux voir les programmes generes ou notes avec un affichage clair incluant les blocs horaires, les scores colores, et les heures precises.

**Why this priority**: La visualisation est essentielle pour comprendre et valider les resultats.

**Independent Test**: L'utilisateur voit une timeline/grille avec tous les elements visuels requis.

**Acceptance Scenarios**:

1. **Given** un programme genere, **When** je l'affiche, **Then** chaque element montre: titre, heure debut, heure fin, note (si activee), couleur selon la note (vert = bon, rouge = mauvais).

2. **Given** un affichage avec notation activee, **When** je consulte un element, **Then** je vois le detail du score (breakdown par critere).

3. **Given** des blocs horaires definis, **When** j'affiche le programme, **Then** les blocs sont visuellement delimites avec leur nom (Morning, Prime Time, etc.).

---

### User Story 6 - Configurer les services (Priority: P2)

En tant qu'administrateur, je veux configurer les connexions aux services externes (Plex, TMDB, Tunarr, Ollama) via une interface dediee.

**Why this priority**: Prerequis technique pour que les autres fonctionnalites marchent.

**Independent Test**: L'utilisateur configure chaque service et teste la connexion.

**Acceptance Scenarios**:

1. **Given** l'onglet Parametres > Services, **When** je configure Plex (URL + token), **Then** je peux tester la connexion et voir les bibliotheques disponibles.

2. **Given** une cle API TMDB, **When** je la sauvegarde, **Then** l'enrichissement des metadonnees est active.

3. **Given** la configuration Tunarr (URL + credentials), **When** je teste, **Then** je vois la liste des chaines disponibles.

4. **Given** un endpoint Ollama configure, **When** je teste, **Then** je vois les modeles disponibles et peux en selectionner un par defaut.

---

### User Story 7 - Consulter l'historique (Priority: P3)

En tant qu'utilisateur, je veux voir l'historique de toutes les programmations et notations effectuees.

**Why this priority**: Fonctionnalite de confort pour le suivi et l'audit.

**Independent Test**: L'utilisateur consulte une liste chronologique avec filtres.

**Acceptance Scenarios**:

1. **Given** plusieurs programmations effectuees, **When** je consulte l'historique, **Then** je vois date, type (programmation/notation), chaine, profil utilise, score global.

2. **Given** un element d'historique, **When** je clique dessus, **Then** je peux voir le detail complet de l'operation.

3. **Given** l'historique, **When** je filtre par chaine ou par date, **Then** la liste est filtree en consequence.

---

### User Story 8 - Changer theme et langue (Priority: P3)

En tant qu'utilisateur, je veux pouvoir changer le theme (light/dark/system) et la langue de l'interface.

**Why this priority**: Confort utilisateur, non bloquant.

**Independent Test**: L'utilisateur change le theme et la langue, les changements sont persistes.

**Acceptance Scenarios**:

1. **Given** l'interface en mode light, **When** je selectionne dark, **Then** l'interface passe en dark theme immediatement.

2. **Given** le mode system selectionne, **When** mon OS passe en dark mode, **Then** l'interface suit automatiquement.

3. **Given** l'interface en francais, **When** je selectionne English, **Then** tous les textes de l'UI passent en anglais.

---

### Edge Cases

- Que se passe-t-il si la connexion Tunarr est perdue pendant une programmation?
- Comment gerer un profil JSON avec une syntaxe invalide?
- Que faire si Ollama genere un JSON non conforme au schema apres 3 tentatives?
- Comment gerer un programme qui depasse minuit (bloc 21:00-06:00)?
- Que se passe-t-il si une bibliotheque Plex referencee dans le profil n'existe plus?
- Comment gerer les conflits entre criteres mandatory contradictoires?
- Que faire si le cache TMDB est corrompu?

## Requirements

### Functional Requirements

#### Core - Programmation

- **FR-001**: Le systeme DOIT pouvoir lire les programmes existants d'une chaine Tunarr via son API
- **FR-002**: Le systeme DOIT pouvoir ecrire/programmer une chaine Tunarr via son API
- **FR-003**: Le systeme DOIT calculer un score hierarchique (Programme -> Bloc -> Global) pour chaque programme
- **FR-004**: Le systeme DOIT supporter N iterations de generation avec selection du meilleur score
- **FR-005**: Le systeme DOIT supporter un facteur d'aleatoire configurable pour varier les resultats
- **FR-006**: Le systeme DOIT proposer le remplacement de contenu forbidden par un meilleur contenu

#### Core - Scoring

- **FR-010**: Le systeme DOIT calculer 9 criteres au niveau programme (type, duree, genre, timing, strategie, age, rating, filtres, bonus contextuels)
- **FR-011**: Le systeme DOIT appliquer les regles mandatory/forbidden strictement (forbidden = exclusion, mandatory = penalite si absent)
- **FR-012**: Le systeme DOIT fournir un tableau de notation detaille avec toutes les colonnes de scores
- **FR-013**: Le systeme DOIT supporter les criteres: genres, age, rating TMDB, mots-cles, studios, collections, budget, revenus, votes

#### Core - Profils

- **FR-020**: Les profils DOIVENT etre au format JSON et valides par un schema
- **FR-021**: Les profils DOIVENT definir: bibliotheques sources, criteres mandatory/forbidden/preferred, blocs horaires, strategies
- **FR-022**: Le systeme DOIT permettre l'import/export de profils
- **FR-023**: Le systeme DOIT permettre d'associer des parametres par defaut a un profil
- **FR-024**: Le systeme DOIT supporter les labels/tags pour organiser les profils

#### Metadata

- **FR-030**: Le systeme DOIT supporter le mode Cache-only (stockage local)
- **FR-031**: Le systeme DOIT supporter le mode TMDB-only (requetes directes)
- **FR-032**: Le systeme DOIT supporter le mode Cache + Enrichissement TMDB
- **FR-033**: Le systeme DOIT supporter le mode Plex-only
- **FR-034**: Le systeme DOIT enrichir le cache local avec les donnees TMDB recuperees

#### UI

- **FR-040**: L'interface DOIT etre responsive (desktop, tablette, smartphone)
- **FR-041**: L'interface DOIT supporter 3 themes: light, dark, system
- **FR-042**: L'interface DOIT supporter l'internationalisation (multi-langue)
- **FR-043**: L'affichage des programmes DOIT inclure: titre, note coloree, heure debut/fin, blocs horaires visuels
- **FR-044**: L'interface DOIT avoir une section Parametres pour les services et logs

#### IA Integration

- **FR-050**: Le systeme DOIT permettre de saisir un prompt en langage naturel
- **FR-051**: Le systeme DOIT envoyer le prompt a Ollama avec un exemple de profil JSON
- **FR-052**: Le systeme DOIT valider le JSON genere par l'IA
- **FR-053**: Le systeme DOIT proposer correction ou reformulation si le JSON est invalide
- **FR-054**: Le systeme DOIT conserver l'historique des prompts et resultats

#### Historique & Logs

- **FR-060**: Le systeme DOIT enregistrer toutes les programmations effectuees
- **FR-061**: Le systeme DOIT enregistrer toutes les notations effectuees
- **FR-062**: Le systeme DOIT permettre de consulter l'historique avec filtres (date, chaine, profil)
- **FR-063**: Le systeme DOIT exposer les logs applicatifs dans l'interface

#### Infrastructure

- **FR-070**: L'application DOIT fonctionner dans un conteneur unique
- **FR-071**: L'application DOIT etre configurable via variables d'environnement
- **FR-072**: L'application DOIT fournir une documentation de deploiement

### Key Entities

- **Profile**: Configuration JSON definissant les criteres de programmation (bibliotheques, mandatory/forbidden, blocs, strategies)
- **Program**: Liste ordonnee de contenus avec leurs metadonnees et scores
- **Content**: Element media (film, serie, bande-annonce) avec metadonnees
- **TimeBlock**: Bloc horaire avec nom, heure debut/fin, criteres specifiques
- **ScoringResult**: Resultat de notation avec scores detailles par critere
- **Channel**: Chaine Tunarr avec son programme actuel
- **Service**: Configuration de connexion a un service externe (Plex, TMDB, Tunarr, Ollama)
- **HistoryEntry**: Enregistrement d'une operation (programmation ou notation) avec metadonnees

## Success Criteria

### Measurable Outcomes

- **SC-001**: La programmation d'une chaine de 24h DOIT se completer en moins de 2 minutes (10 iterations)
- **SC-002**: Le systeme DOIT supporter un cache de 30,000+ films sans degradation de performance
- **SC-003**: L'interface DOIT etre utilisable sur un ecran de 320px de large (smartphone)
- **SC-004**: Le score calcule DOIT etre reproductible (memes inputs = meme score)
- **SC-005**: 100% des regles forbidden DOIVENT etre respectees (aucun contenu forbidden dans le resultat final)
- **SC-006**: Les profils v4 existants du systeme legacy DOIVENT etre compatibles
- **SC-007**: L'interface DOIT repondre en moins de 200ms pour les actions utilisateur standard

### Quality Attributes

- **Performance**: Reponse UI < 200ms, programmation < 2min
- **Fiabilite**: Aucune perte de donnees sur crash, reprise possible
- **Maintenabilite**: Couverture tests > 80% sur le core scoring
- **Securite**: Pas d'exposition de credentials dans les logs

## Assumptions

- Les services externes (Tunarr, Plex, TMDB, Ollama) sont accessibles via des APIs stables
- L'utilisateur dispose d'un compte Plex avec des bibliotheques de medias configurees
- Tunarr est deja installe et configure avec au moins une chaine
- Les donnees TMDB sont disponibles pour enrichir les metadonnees des contenus
- Un cache local est suffisant pour stocker les metadonnees de 30,000+ films

## Appendix: Profile JSON Structure

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
