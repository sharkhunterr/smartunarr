# SmartTunarr - Système de Scoring v6

## Vue d'ensemble

Le système de scoring de SmartTunarr v6 utilise **9 critères pondérés** pour évaluer la pertinence d'un contenu dans un bloc horaire. Chaque critère produit un score entre **0 et 100**, puis le score final est calculé comme une moyenne pondérée + des multiplicateurs (keywords) + des pénalités (mandatory/forbidden).

## Comparaison avec l'ancien système (README_SCORING.md)

| Aspect | Ancien système | SmartTunarr v6 |
|--------|----------------|----------------|
| **Critères** | 8 critères (Type, Durée, Genre, Timing, Stratégie, Âge, Rating, Filtres) | 9 critères + système mandatory/forbidden + multiplicateur keywords |
| **Architecture** | Python monolithique (`universal_scoring_tester.py`) | Backend FastAPI modulaire avec critères séparés |
| **Pondération** | Fixe (ex: Genre=25pts, Type=20pts) | Configurable par profil via `scoring_weights` |
| **Mandatory/Forbidden** | Pénalités intégrées aux critères | Système séparé post-scoring avec violations explicites |
| **Mots-clés** | Intégré au critère "Filtres" | Système dédié avec multiplicateur global (±50%/+10%) |
| **Temps réel** | Analyse de décalages | Critère `timing` avec overflow et late start |

---

## Les 9 Critères de Scoring

### 1. Type (`type`)
**Poids par défaut : 15 (configurable)**

Évalue si le type de contenu (movie, episode, filler) correspond aux préférences du bloc.

| Situation | Score |
|-----------|-------|
| Type préféré du bloc (`preferred_types`) | 100 |
| Type autorisé du bloc (`allowed_types`) | 75 |
| Type non listé mais pas exclu | 75 |
| Type exclu (`excluded_types`) | 0 |
| Type interdit au niveau profil | 0 |

**Exemple :**
```json
"criteria": {
  "preferred_types": ["movie"],
  "allowed_types": ["movie", "episode"],
  "excluded_types": ["trailer"]
}
```

---

### 2. Durée (`duration`)
**Poids par défaut : 20**

Mesure l'adéquation de la durée du contenu par rapport aux limites du bloc.

| Situation | Score |
|-----------|-------|
| Durée idéale (milieu de la plage) | 100 |
| Durée dans la plage min-max | 70-100 |
| Durée < minimum | 0-50 (proportionnel) |
| Durée > maximum | 50-100 (pénalité selon excès) |
| Pas de durée | 0 |

**Formule :**
- Si dans la plage : `70 + (fit_ratio * 30)`
- Si trop court : `(duration / min_duration) * 50`
- Si trop long : `100 - (excès / max_duration) * 100`

---

### 3. Genre (`genre`)
**Poids par défaut : 15**

Analyse la correspondance des genres avec les préférences du bloc.

| Situation | Score |
|-----------|-------|
| Genre préféré trouvé + bonus | 100 |
| Pas de métadonnées | 50 (neutre) |
| Genre préféré trouvé | 75 + bonus |
| Aucun genre préféré, pas de forbidden | 65-75 |
| Genre obligatoire manquant | -40 |
| Genre interdit détecté | **0 (VIOLATION)** |

**Logique :**
1. Vérifier les genres `forbidden` → Score 0 si trouvé
2. Vérifier les genres `mandatory` → Pénalité de 40 si manquant
3. Calculer le ratio de correspondance `preferred` → Bonus proportionnel

---

### 4. Timing (`timing`)
**Poids par défaut : 10**

Évalue le respect des horaires du bloc (débordement, retard de démarrage).

| Situation | Score |
|-----------|-------|
| Parfait dans le bloc | 100 |
| Débordement 30min | ~75 |
| Débordement 60min | ~50 |
| Débordement 120min | ~25 |
| Débordement 180min+ | ~5 |

**Composition du score :**
- **Premier programme du bloc** : 40% overflow + 30% late_start + 30% time_of_day
- **Autres programmes** : 70% overflow + 30% time_of_day

**Time of day (heuristiques) :**
- Films : meilleurs le soir (100) et la nuit (90), moins le matin (50)
- Épisodes : bons partout (75-90)
- Trailers : fillers acceptables (80)

---

### 5. Stratégie (`strategy`)
**Poids par défaut : 10**

Évalue la conformité aux stratégies de programmation.

| Stratégie | Effet |
|-----------|-------|
| `maintain_sequence` | Épisodes favorisés, -5 pour films |
| `maximize_variety` | +5 si >2 genres |
| `marathon_mode` | +10 si fait partie d'une collection |
| `filler_insertion` | +5 pour contenus de type filler |

**Score de base : 100**, avec ajustements selon les stratégies activées.

---

### 6. Âge (`age`)
**Poids par défaut : 15**

Vérifie la conformité de la classification d'âge.

| Classification | Niveau |
|----------------|--------|
| G, TV-G, TV-Y | 0 (le plus restrictif) |
| PG, TV-PG | 1 |
| PG-13, TV-14 | 2 |
| R, TV-MA | 3 |
| NC-17 | 4 |

| Situation | Score |
|-----------|-------|
| En dessous du max | 100 |
| Exactement au max | 90 |
| Pas de restriction | 80 |
| Au-dessus du max | **0 (VIOLATION)** |
| Pas de métadonnées | 75 (neutre) |

---

### 7. Note TMDB (`rating`)
**Poids par défaut : 10**

Évalue la note TMDB par rapport aux seuils configurés.

| Situation | Score |
|-----------|-------|
| ≥ `preferred_tmdb_rating` | 70-100 |
| Entre min et preferred | 50-90 (proportionnel) |
| < `min_tmdb_rating` | 0-40 (proportionnel) |
| Pas de note | 50 (neutre) |

**Pénalité de confiance :** Si `vote_count < min_vote_count`, pénalité jusqu'à -30 points.

---

### 8. Filtre (`filter`)
**Poids par défaut : 10**

**⚠️ Ce critère est différent des "filtres mandatory/forbidden".**

Évalue les correspondances de **mots-clés TMDB** et **studios** au niveau du bloc/profil.

| Situation | Score |
|-----------|-------|
| Mot-clé/studio interdit trouvé | 0 |
| Pas de métadonnées | 75 (neutre) |
| Score de base | 75 |
| Mot-clé préféré trouvé | +5 à +15 |
| Studio préféré trouvé | +5 à +10 |
| Maximum | 100 |

**Configuration :**
```json
"criteria": {
  "forbidden_keywords": ["violence", "gore"],
  "preferred_keywords": ["family", "adventure"],
  "forbidden_studios": [],
  "preferred_studios": ["Disney", "Pixar"]
}
```

**Note importante :** Ce critère vérifie les mots-clés TMDB du contenu, pas les mots-clés de titre (qui sont gérés par le système mandatory/forbidden).

---

### 9. Bonus (`bonus`)
**Poids par défaut : 5**

Applique des bonus contextuels basés sur divers facteurs.

| Bonus | Condition | Points |
|-------|-----------|--------|
| Sortie récente (≤2 ans) | `year >= current - 2` | +20 |
| Assez récent (≤5 ans) | `year >= current - 5` | +10 |
| Contenu ancien (>20 ans) | `year < current - 20` | -5 |
| Blockbuster (ROI 3x+) | `revenue > budget * 3` | +15 |
| Succès commercial (2x+) | `revenue > budget * 2` | +10 |
| Rentable | `revenue > budget` | +5 |
| Collection | Fait partie d'une collection | +5 à +10 |
| Très populaire | `vote_count > 10000` | +10 |
| Populaire | `vote_count > 5000` | +5 |
| Saison | Mots-clés holiday en Oct-Déc | +15 |

**Enhanced Criteria (v6) :**
- `keywords_safety.safe_keywords` → Bonus configurable
- `keywords_safety.dangerous_keywords` → Pénalité (jusqu'à -100)
- `collections_franchises.preferred_collections` → Bonus
- `cast_crew.preferred_actors` → Bonus
- `educational_value.educational_keywords` → Bonus

---

## Système Mandatory/Forbidden (Post-scoring)

**Appliqué APRÈS le calcul des 9 critères, sur le score final.**

### Mandatory (Règles obligatoires)

Si les critères mandatory ne sont pas respectés, des **pénalités** sont appliquées :

| Règle | Pénalité |
|-------|----------|
| `min_duration_min` non respecté | -15 |
| `min_tmdb_rating` non respecté | -10 |
| `required_genres` manquant | -20 |

### Forbidden (Règles interdites)

Si un contenu viole une règle forbidden, le score **tombe à 0**.

| Règle | Effet |
|-------|-------|
| `content_ids` dans la liste | Score = 0 |
| `types` interdit | Score = 0 |
| `keywords` dans le titre | Score = 0 |
| `genres` interdit (global) | Score = 0 |
| `forbidden_genres` du bloc | Score = 0 |

---

## Multiplicateur de Mots-clés (Keyword Multiplier)

**Système distinct, appliqué sur le score final.**

Vérifie si le **titre** du contenu contient certains mots-clés.

| Match | Multiplicateur | Effet |
|-------|----------------|-------|
| `exclude_keywords` | 0.5 | -50% sur le score final |
| `include_keywords` | 1.1 | +10% sur le score final |
| `dangerous_keywords` (enhanced) | 0.5 | -50% sur le score final |
| Aucun match | 1.0 | Pas de modification |

**Priorité :** Les exclusions sont toujours prioritaires sur les inclusions.

**Configuration :**
```json
"mandatory_forbidden_criteria": {
  "exclude_keywords": ["bootleg", "cam"],
  "include_keywords": ["disney", "pixar"]
}
```

---

## Calcul du Score Final

```
1. Calculer les 9 scores de critères (0-100 chacun)
2. Calculer la moyenne pondérée : weighted_total = Σ(score × poids) / Σ(poids)
3. Vérifier les violations forbidden → Si oui, score = 0
4. Appliquer les pénalités mandatory → score -= pénalités
5. Appliquer le multiplicateur keywords → score *= multiplier
6. Clamper le score entre 0 et 100
```

**Formule :**
```
final_score = clamp(0, 100,
  (weighted_total - mandatory_penalties) × keyword_multiplier
)

Si forbidden_violated → final_score = 0
```

---

## Interprétation des Scores (identique à l'ancien système)

| Score | Interprétation |
|-------|----------------|
| 85-100 | Excellent, parfaitement adapté |
| 70-84 | Bon, critères principaux respectés |
| 50-69 | Moyen, quelques ajustements nécessaires |
| 30-49 | Faible, problèmes de conformité |
| 0-29 | Inadapté, violations majeures |
| 0 | Contenu interdit (forbidden violated) |

---

## Affichage dans l'UI (ProgrammingPage)

Dans le tableau de scores expandable, chaque ligne montre :

| Colonne | Description |
|---------|-------------|
| **Contenu** | Valeur réelle du contenu (ex: "Animation, Family") |
| **Bloc** | Ce qui est attendu par le bloc (ex: "Préf: Animation, Family") |
| **Match** | ✅ Bon, ⚠️ Acceptable, ❌ Violation |
| **Score** | Score du critère (0-100) |

**Lignes spéciales :**
- **Mots-clés** : Affiche les keywords TMDB du contenu vs les keywords configurés
- **Bonus** : Liste des bonus appliqués
- **Mots-clés (multiplicateur)** : Affiché uniquement si un match est trouvé (-50% ou +10%)

---

## Différences clés avec l'ancien système

1. **Modularité** : Chaque critère est une classe séparée, facilement extensible
2. **Pondération configurable** : Via `scoring_weights` dans le profil
3. **Enhanced Criteria v6** : Nouveaux bonus (collections, acteurs, éducatif, temporel)
4. **Séparation claire** : Mandatory/Forbidden vs Critères vs Multiplicateurs
5. **Visibilité** : L'UI affiche le détail complet de chaque critère
6. **Keywords TMDB** : Maintenant visibles et comparés dans l'UI
