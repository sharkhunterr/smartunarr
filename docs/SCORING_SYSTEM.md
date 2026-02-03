# SmarTunarr - Systeme de Scoring v7

## Vue d'ensemble

Le systeme de scoring de SmarTunarr v7 utilise **9 criteres ponderes** pour evaluer la pertinence d'un contenu dans un bloc horaire. Chaque critere:

1. Produit un **score de base** entre 0 et 100
2. Applique optionnellement des **regles M/F/P** (Mandatory/Forbidden/Preferred)
3. Est multiplie par un **multiplicateur de critere** configurable

Le score final est calcule comme une moyenne ponderee avec ajustements.

---

## Architecture du Systeme de Scoring

```
                         +------------------+
                         |   Contenu Media  |
                         | (titre, genres,  |
                         |  duree, rating)  |
                         +--------+---------+
                                  |
                                  v
         +------------------------+------------------------+
         |                        |                        |
         v                        v                        v
+--------+-------+    +-----------+-----------+    +------+------+
| 9 Criteres     |    | Regles M/F/P          |    | Multiplieurs|
| (calcul 0-100) |    | (par critere)         |    | de criteres |
+--------+-------+    +-----------+-----------+    +------+------+
         |                        |                        |
         v                        v                        v
+--------+--------------------------------------------------+------+
|                       Score Final                               |
|  = SUM(score * poids * multiplier) / SUM(poids * multiplier)    |
|  + ajustements M/F/P                                            |
|  * multiplicateur keywords                                       |
+------------------------------------------------------------------+
```

---

## Systeme M/F/P (Mandatory / Forbidden / Preferred)

### Principe

Chaque critere peut avoir des **regles optionnelles** qui modifient le score:

| Type | Description | Effet |
|------|-------------|-------|
| **M (Mandatory)** | Valeurs obligatoires | Si non respecte: penalite configurable |
| **F (Forbidden)** | Valeurs interdites | Si detecte: penalite severe + potentielle exclusion |
| **P (Preferred)** | Valeurs preferees | Si match: bonus configurable |

### MFP Policy (Configuration globale par bloc)

Chaque bloc horaire peut definir une politique MFP:

```json
"mfp_policy": {
  "mandatory_matched_bonus": 5.0,      // Bonus si mandatory respecte
  "mandatory_missed_penalty": -30.0,   // Penalite si mandatory manque
  "forbidden_detected_penalty": -150.0, // Penalite si forbidden detecte
  "preferred_matched_bonus": 10.0       // Bonus si preferred match
}
```

### Regles par Critere

Chaque critere peut avoir ses propres regles M/F/P:

```json
"criteria": {
  "genre_rules": {
    "mandatory_values": ["Family"],           // Au moins un obligatoire
    "mandatory_penalty": -50.0,               // Penalite si manquant
    "forbidden_values": ["Horror", "Thriller"], // Interdits
    "forbidden_penalty": -150.0,              // Penalite si detecte
    "preferred_values": ["Animation", "Adventure"], // Preferes
    "preferred_bonus": 20.0                   // Bonus si match
  },
  "type_rules": {
    "mandatory_values": ["movie"],
    "mandatory_penalty": -20.0,
    "forbidden_values": ["trailer"],
    "forbidden_penalty": -50.0,
    "preferred_values": ["movie"],
    "preferred_bonus": 10.0
  }
}
```

### Ordre d'evaluation M/F/P

1. **Forbidden** (priorite max): Si detecte -> penalite severe
2. **Mandatory**: Si non respecte -> penalite moderee
3. **Preferred**: Si match -> bonus

---

## Multiplicateurs de Criteres

Chaque critere peut avoir un **multiplicateur** qui amplifie son impact:

```json
"criterion_multipliers": {
  "type": 1.0,
  "duration": 1.0,
  "genre": 1.5,      // Genre compte 50% de plus
  "timing": 1.2,     // Timing plus important
  "strategy": 0.8,   // Strategie moins importante
  "age": 2.0,        // Age tres important (familles)
  "rating": 1.2,
  "filter": 1.0,
  "bonus": 1.3
}
```

**Fonctionnement:**
- `multiplier > 1.0`: Le critere a plus d'impact
- `multiplier < 1.0`: Le critere a moins d'impact
- `multiplier = 1.0`: Comportement normal

**Calcul:**
```
weighted_score = score * poids * multiplier
```

---

## Les 9 Criteres de Scoring

### 1. Type (`type`)
**Poids par defaut: 15**

Evalue si le type de contenu (movie, episode, filler) correspond aux preferences du bloc.

| Situation | Score |
|-----------|-------|
| Type prefere du bloc (`preferred_types`) | 100 |
| Type autorise du bloc (`allowed_types`) | 75 |
| Type non liste mais pas exclu | 75 |
| Type exclu (`excluded_types`) | 0 |

**Regles M/F/P supportees:**
```json
"type_rules": {
  "mandatory_values": ["movie"],    // Types obligatoires
  "forbidden_values": ["trailer"],  // Types interdits
  "preferred_values": ["movie"]     // Types preferes
}
```

---

### 2. Duree (`duration`)
**Poids par defaut: 20**

Mesure l'adequation de la duree du contenu par rapport aux limites du bloc.

| Situation | Score |
|-----------|-------|
| Duree ideale (milieu de la plage) | 100 |
| Duree dans la plage min-max | 70-100 |
| Duree < minimum | 0-50 (proportionnel) |
| Duree > maximum | 50-100 (penalite selon exces) |

**Regles M/F/P supportees:**
```json
"duration_rules": {
  "mandatory_values": null,
  "forbidden_values": ["very_long", "short"],  // Categories interdites
  "preferred_values": ["standard", "long"]     // Categories preferees
}
```

**Categories de duree:**
- `short`: < 60 min
- `standard`: 60-120 min
- `long`: 120-180 min
- `very_long`: > 180 min

---

### 3. Genre (`genre`)
**Poids par defaut: 15**

Analyse la correspondance des genres avec les preferences du bloc.

| Situation | Score |
|-----------|-------|
| Genre prefere trouve | 75-100 |
| Pas de metadonnees | 50 (neutre) |
| Aucun genre prefere, pas de forbidden | 65-75 |
| Genre interdit detecte | **0 (VIOLATION)** |

**Regles M/F/P supportees:**
```json
"genre_rules": {
  "mandatory_values": null,
  "forbidden_values": ["Horror", "Thriller", "Crime"],
  "forbidden_penalty": -150.0,
  "preferred_values": ["Family", "Animation", "Adventure"],
  "preferred_bonus": 20.0
}
```

---

### 4. Timing (`timing`) - NOUVEAU SYSTEME ADAPTATIF
**Poids par defaut: 10**

Evalue le respect des horaires du bloc avec une **courbe adaptative** basee sur des seuils en minutes.

#### Qui est evalue?

| Position | Evaluation |
|----------|------------|
| **Premier du bloc** | Retard au demarrage (`late_start_minutes`) |
| **Dernier du bloc** | Debordement (`overflow_minutes`) |
| **Milieu du bloc** | Critere **skipped** (non applicable) |

#### Courbe Adaptative

Le score suit une courbe fluide entre les seuils P/M/F:

```
Score
  |
100├───────╮
   |       │
 85├───────┼──────╮ <- Seuil P (Preferred)
   |       │      │
 50├───────┼──────┼──────╮ <- Seuil M (Mandatory)
   |       │      │      │
  5├───────┼──────┼──────┼──────╮ <- Seuil F (Forbidden)
   |       │      │      │      │
  0├───────┴──────┴──────┴──────┴────> Minutes
   0       P      M      F
```

| Zone | Score | Description |
|------|-------|-------------|
| 0 min | 100 | Timing parfait |
| 0 -> P | 100 -> 85 | Zone preferee (petit declin) |
| P -> M | 85 -> 50 | Zone mandatory (declin modere) |
| M -> F | 50 -> 5 | Zone post-mandatory (declin abrupt) |
| > F | 0 | Zone interdite |

#### Configuration timing_rules

```json
"timing_rules": {
  "preferred_max_minutes": 15,      // Bonus si <= 15 min
  "preferred_bonus": 10.0,
  "mandatory_max_minutes": 45,      // OK si <= 45 min
  "mandatory_penalty": -30.0,       // Penalite si > 45 min
  "forbidden_max_minutes": 120,     // INTERDIT si > 120 min
  "forbidden_penalty": -50.0
}
```

#### Exemple pratique

Pour un bloc `late_night_mature` (23:00-07:00) avec:
- P=25min, M=75min, F=180min

| Debordement | Score Base | M/F/P | Score Final |
|-------------|------------|-------|-------------|
| 0 min | 100 | P (+10) | ~110 -> 100 |
| 10 min | ~94 | P (+10) | ~100 |
| 25 min | 85 | P (+10) | ~95 |
| 50 min | ~67 | M (+5) | ~72 |
| 75 min | 50 | M-Miss (-30) | ~20 |
| 120 min | ~27 | M-Miss (-30) | ~0 |
| 180 min | 5 | F (-50) | 0 |

---

### 5. Strategie (`strategy`)
**Poids par defaut: 10**

Evalue la conformite aux strategies de programmation.

| Strategie | Effet |
|-----------|-------|
| `maintain_sequence` | Episodes favorises, -5 pour films |
| `maximize_variety` | +5 si >2 genres |
| `marathon_mode` | +10 si partie d'une collection |
| `filler_insertion` | +5 pour contenus de type filler |

**Regles M/F/P supportees:**
```json
"strategy_rules": {
  "mandatory_values": null,
  "forbidden_values": null,
  "preferred_values": ["collection", "franchise"]
}
```

---

### 6. Age (`age`)
**Poids par defaut: 15**

Verifie la conformite de la classification d'age.

| Classification | Niveau |
|----------------|--------|
| G, TV-G, TV-Y, TP | 0 (le plus restrictif) |
| PG, TV-PG | 1 |
| PG-13, TV-14, +12 | 2 |
| R, TV-MA, +16 | 3 |
| NC-17, +18 | 4 |

| Situation | Score |
|-----------|-------|
| En dessous du max | 100 |
| Exactement au max | 90 |
| Pas de restriction | 80 |
| Au-dessus du max | **0 (VIOLATION)** |
| Pas de metadonnees | 75 (neutre) |

**Regles M/F/P supportees:**
```json
"age_rules": {
  "mandatory_values": null,
  "forbidden_values": ["R", "NC-17", "+16", "+18", "TV-MA"],
  "forbidden_penalty": -150.0,
  "preferred_values": ["G", "PG", "TV-G", "TV-PG", "TP"],
  "preferred_bonus": 15.0
}
```

---

### 7. Note TMDB (`rating`)
**Poids par defaut: 10**

Evalue la note TMDB par rapport aux seuils configures.

| Situation | Score |
|-----------|-------|
| >= `preferred_tmdb_rating` | 70-100 |
| Entre min et preferred | 50-90 (proportionnel) |
| < `min_tmdb_rating` | 0-40 (proportionnel) |
| Pas de note | 50 (neutre) |

**Penalite de confiance:** Si `vote_count < min_vote_count`, penalite jusqu'a -30 points.

**Regles M/F/P supportees:**
```json
"rating_rules": {
  "mandatory_values": ["excellent", "good"],  // Categories de note
  "mandatory_penalty": -40.0,
  "forbidden_values": ["poor"],
  "forbidden_penalty": -60.0,
  "preferred_values": ["excellent"],
  "preferred_bonus": 25.0
}
```

**Categories de note:**
- `excellent`: >= 8.0
- `good`: >= 7.0
- `average`: >= 5.0
- `poor`: < 5.0

---

### 8. Filtre (`filter`)
**Poids par defaut: 10**

Evalue les correspondances de **mots-cles TMDB** et **studios**.

| Situation | Score |
|-----------|-------|
| Mot-cle/studio interdit trouve | 0 |
| Pas de metadonnees | 75 (neutre) |
| Score de base | 75 |
| Mot-cle prefere trouve | +5 a +15 |
| Studio prefere trouve | +5 a +10 |

**Regles M/F/P supportees:**
```json
"filter_rules": {
  "mandatory_values": ["blockbuster", "franchise"],  // Mots-cles requis
  "mandatory_penalty": -35.0,
  "forbidden_values": ["horror", "gore", "violent"],
  "forbidden_penalty": -100.0,
  "preferred_values": ["marvel", "disney", "pixar", "dreamworks"],
  "preferred_bonus": 25.0
}
```

---

### 9. Bonus (`bonus`)
**Poids par defaut: 5**

Applique des bonus contextuels bases sur divers facteurs.

| Bonus | Condition | Points |
|-------|-----------|--------|
| Sortie recente (<=2 ans) | `year >= current - 2` | +20 |
| Assez recent (<=5 ans) | `year >= current - 5` | +10 |
| Contenu ancien (>20 ans) | `year < current - 20` | -5 |
| Blockbuster (ROI 3x+) | `revenue > budget * 3` | +15 |
| Succes commercial (2x+) | `revenue > budget * 2` | +10 |
| Collection | Fait partie d'une collection | +5 a +10 |
| Tres populaire | `vote_count > 10000` | +10 |

**Regles M/F/P supportees:**
```json
"bonus_rules": {
  "mandatory_values": ["blockbuster", "popular"],
  "mandatory_penalty": -45.0,
  "forbidden_values": ["old", "classic", "vintage"],
  "forbidden_penalty": -80.0,
  "preferred_values": ["blockbuster", "recent", "collection"],
  "preferred_bonus": 30.0
}
```

---

## Exemple Complet de Bloc Horaire

```json
{
  "name": "prime_time_blockbuster",
  "description": "Prime Time - Les plus gros succes",
  "start_time": "19:00",
  "end_time": "23:00",
  "criteria": {
    "preferred_types": ["movie"],
    "allowed_types": ["movie"],
    "preferred_genres": ["Action", "Adventure", "Science Fiction"],
    "allowed_genres": ["Action", "Adventure", "Sci-Fi", "Drama", "Thriller"],
    "min_duration_min": 100,
    "max_duration_min": 220,
    "min_tmdb_rating": 7.0,
    "preferred_tmdb_rating": 8.0,
    "min_vote_count": 5000,

    "type_rules": {
      "mandatory_values": ["movie"],
      "mandatory_penalty": -40.0,
      "preferred_values": ["movie"],
      "preferred_bonus": 15.0
    },
    "duration_rules": {
      "mandatory_values": ["standard", "long", "epic"],
      "mandatory_penalty": -25.0,
      "preferred_values": ["long", "epic"],
      "preferred_bonus": 15.0
    },
    "genre_rules": {
      "preferred_values": ["Action", "Adventure", "Science Fiction", "Drama"],
      "preferred_bonus": 25.0
    },
    "timing_rules": {
      "preferred_max_minutes": 10,
      "preferred_bonus": 10.0,
      "mandatory_max_minutes": 40,
      "mandatory_penalty": -30.0,
      "forbidden_max_minutes": 120,
      "forbidden_penalty": -50.0
    },
    "age_rules": {
      "forbidden_values": ["NC-17", "X", "+18", "18+"],
      "forbidden_penalty": -200.0,
      "preferred_values": ["PG-13", "R", "TV-14"],
      "preferred_bonus": 10.0
    },
    "rating_rules": {
      "mandatory_values": ["excellent", "good"],
      "mandatory_penalty": -40.0,
      "forbidden_values": ["poor", "average"],
      "forbidden_penalty": -60.0,
      "preferred_values": ["excellent"],
      "preferred_bonus": 25.0
    },
    "filter_rules": {
      "mandatory_values": ["blockbuster", "franchise", "superhero"],
      "mandatory_penalty": -35.0,
      "preferred_values": ["blockbuster", "epic", "superhero", "marvel", "dc"],
      "preferred_bonus": 25.0
    },
    "bonus_rules": {
      "mandatory_values": ["blockbuster", "popular"],
      "mandatory_penalty": -45.0,
      "preferred_values": ["blockbuster", "recent", "collection"],
      "preferred_bonus": 30.0
    },

    "mfp_policy": {
      "mandatory_matched_bonus": 5.0,
      "mandatory_missed_penalty": -30.0,
      "forbidden_detected_penalty": -350.0,
      "preferred_matched_bonus": 10.0
    },
    "criterion_multipliers": {
      "type": 1.2,
      "duration": 1.1,
      "genre": 1.4,
      "timing": 1.2,
      "strategy": 0.8,
      "age": 1.3,
      "rating": 1.5,
      "filter": 1.2,
      "bonus": 1.3
    }
  }
}
```

---

## Calcul du Score Final

### Etape 1: Score par Critere

Pour chaque critere:
1. Calculer le score de base (0-100)
2. Appliquer les regles M/F/P si definies
3. Appliquer le multiplicateur de critere

```python
adjusted_score = base_score + mfp_adjustment
adjusted_score = max(0, min(100, adjusted_score))
weighted_score = adjusted_score * weight * multiplier
```

### Etape 2: Agregation

```python
total_weighted = sum(criterion.weighted_score for all criteria)
total_weights = sum(criterion.weight * criterion.multiplier for all criteria)
average_score = total_weighted / total_weights
```

### Etape 3: Ajustements Post-Scoring

1. **Violations Forbidden**: Si detectees -> score potentiellement a 0
2. **Multiplicateur Keywords**: Score *= keyword_multiplier (0.5 a 1.1)
3. **Clamping**: Score final entre 0 et 100

---

## Interpretation des Scores

| Score | Interpretation | Couleur UI |
|-------|----------------|------------|
| 80-100 | Excellent, parfaitement adapte | Vert |
| 60-79 | Bon, criteres principaux respectes | Lime |
| 40-59 | Moyen, quelques ajustements | Jaune |
| 20-39 | Faible, problemes de conformite | Orange |
| 0-19 | Inadapte, violations majeures | Rouge |
| 0 | Contenu interdit (forbidden violated) | Rouge + Icone |

---

## Affichage dans l'UI (ScoringPage)

### Tableau Principal

| Colonne | Description |
|---------|-------------|
| Heure | Heure de debut du programme |
| Titre | Titre du contenu |
| Type | Film/Serie |
| Duree | Duree en minutes |
| Genres | Genres du contenu |
| Timing | Retard/Debordement ou "OK" |
| Age | Classification d'age |
| Note | Note TMDB |
| Total | Score final |

### Ligne Expandable (Details)

Pour chaque critere, affiche:

| Colonne | Description |
|---------|-------------|
| Crit. | Nom du critere |
| Contenu | Valeur reelle du contenu |
| M (Obligatoire) | Valeurs mandatory + statut |
| F (Interdit) | Valeurs forbidden + statut |
| P (Prefere) | Valeurs preferred + statut |
| x | Multiplicateur du critere |
| Score | Score du critere (0-100) |

### Indicateurs M/F/P

| Indicateur | Signification |
|------------|---------------|
| `checkmark` Vert | Mandatory respecte / Pas de forbidden / Preferred match |
| `X` Rouge | Mandatory manque / Forbidden detecte |
| `O` Gris | Non applicable / Pas de regle definie |
| `star` Vert | Preferred match |

### Timing Specifique

Pour le critere Timing, affiche les seuils en minutes:
- `<=15min` (P): Bonus si debordement <= 15 min
- `<=45min` (M): OK si debordement <= 45 min
- `>120min` (F): Interdit si debordement > 120 min

---

## Gestion des Blocs Overnight

Les blocs qui traversent minuit (ex: 23:00-07:00) sont geres correctement:

| Heure Programme | Position dans le bloc |
|-----------------|----------------------|
| 23:30 | Partie "avant minuit" -> block_end = lendemain 07:00 |
| 05:47 | Partie "apres minuit" -> block_start = veille 23:00 |

Cela garantit un calcul correct du debordement meme pour les blocs overnight sur plusieurs jours.

---

## Migration depuis l'ancien systeme

| Ancien | Nouveau |
|--------|---------|
| `forbidden_genres` dans criteria | `genre_rules.forbidden_values` |
| `required_genres` dans mandatory_forbidden | `genre_rules.mandatory_values` |
| Penalites fixes | Penalites configurables par regle |
| Pas de multiplicateurs | `criterion_multipliers` configurable |
| Timing binaire | Courbe adaptative avec seuils P/M/F |

**Retrocompatibilite:**
- Les anciens champs (`forbidden_genres`, `preferred_genres`, etc.) fonctionnent toujours
- Les nouvelles `*_rules` sont optionnelles
- Si non definies, le comportement par defaut s'applique
