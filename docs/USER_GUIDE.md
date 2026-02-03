# User Guide

Complete guide to using SmarTunarr.

---

## Overview

SmarTunarr is an intelligent TV channel programming system that helps you create optimized schedules for your Tunarr channels using content from your Plex library.

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Profile** | JSON configuration defining scheduling rules |
| **Time Block** | A period with specific content criteria |
| **Scoring** | 9-criterion evaluation of content fitness |
| **Programming** | The process of generating a schedule |

---

## Dashboard

The dashboard provides an overview of your SmarTunarr instance:

- **Service Status**: Connection status for Plex, Tunarr, TMDB, Ollama
- **Recent Activity**: Latest programming executions
- **Quick Actions**: Common tasks

---

## Profiles

Profiles define how content should be scheduled throughout the day.

### Creating a Profile

1. Navigate to **Profiles**
2. Click **New Profile**
3. Enter profile name and description
4. Add time blocks

### Time Blocks

Each time block defines:

- **Time Range**: Start and end times
- **Content Criteria**: What content is acceptable
- **Scoring Weights**: How to prioritize criteria

#### Example Time Blocks

**Morning Kids (06:00 - 09:00)**
```json
{
  "name": "morning_kids",
  "start_time": "06:00",
  "end_time": "09:00",
  "criteria": {
    "preferred_types": ["movie", "episode"],
    "preferred_genres": ["Animation", "Family", "Adventure"],
    "max_age_rating": "PG",
    "max_duration_min": 120
  }
}
```

**Prime Time Movies (20:00 - 23:00)**
```json
{
  "name": "prime_time",
  "start_time": "20:00",
  "end_time": "23:00",
  "criteria": {
    "preferred_types": ["movie"],
    "preferred_genres": ["Action", "Drama", "Thriller"],
    "min_tmdb_rating": 7.0,
    "min_duration_min": 90
  }
}
```

**Late Night (23:00 - 06:00)**
```json
{
  "name": "late_night",
  "start_time": "23:00",
  "end_time": "06:00",
  "criteria": {
    "preferred_types": ["movie"],
    "allowed_genres": ["Horror", "Thriller", "Action"],
    "max_age_rating": "R"
  }
}
```

### Profile Actions

| Action | Description |
|--------|-------------|
| **Edit** | Modify profile settings |
| **Duplicate** | Create a copy |
| **Export** | Download as JSON |
| **Delete** | Remove profile |

### Importing Profiles

1. Click **Import**
2. Select a JSON file
3. Review and confirm

---

## Programming

Generate optimized schedules for your Tunarr channels.

### Starting Programming

1. Navigate to **Programming**
2. Select a **Channel** from Tunarr
3. Select a **Profile**
4. Configure options:
   - **Iterations**: Number of scheduling attempts (more = better results)
   - **Date Range**: Start and end dates
5. Click **Start Programming**

### Understanding Results

The programming engine:

1. Fetches content from Plex
2. Runs N iterations with different content combinations
3. Scores each iteration using the profile criteria
4. Returns the best-scoring schedule

### Result Display

| Column | Description |
|--------|-------------|
| **Time** | Scheduled start time |
| **Title** | Content title |
| **Type** | Movie/Episode |
| **Duration** | Runtime |
| **Score** | Fitness score (0-100) |

### Applying Results

1. Review the generated schedule
2. Click **Apply to Tunarr**
3. Confirm the action
4. Schedule is pushed to Tunarr

---

## Scoring

Analyze existing channel programming against a profile.

### Running Analysis

1. Navigate to **Scoring**
2. Select a **Channel**
3. Select a **Profile**
4. Click **Analyze**

### Understanding Scores

See [SCORING_SYSTEM.md](SCORING_SYSTEM.md) for detailed scoring documentation.

#### Score Interpretation

| Score | Quality | Color |
|-------|---------|-------|
| 80-100 | Excellent | Green |
| 60-79 | Good | Lime |
| 40-59 | Average | Yellow |
| 20-39 | Poor | Orange |
| 0-19 | Inadequate | Red |

#### 9 Scoring Criteria

1. **Type**: Content type matches preferences
2. **Duration**: Fits within block constraints
3. **Genre**: Genre alignment
4. **Timing**: Start/end time compliance
5. **Strategy**: Programming strategy adherence
6. **Age**: Age rating compliance
7. **Rating**: TMDB rating threshold
8. **Filter**: Keyword/studio filtering
9. **Bonus**: Additional scoring factors

### Expanded Details

Click on any row to see detailed criterion breakdown:

- Individual criterion scores
- M/F/P (Mandatory/Forbidden/Preferred) status
- Multiplier effects
- Violation flags

### Exporting Results

- **CSV**: Spreadsheet format
- **JSON**: Machine-readable format

---

## AI Generation

Use AI to create and modify profiles from natural language.

### Requirements

- Ollama server running
- Model pulled (e.g., `llama3.2`)
- Connection configured in Settings

### Generating a Profile

1. Navigate to **Profiles** → **AI Generate**
2. Describe your desired schedule:
   ```
   I want a family-friendly channel. Mornings should have
   kids content like animation and cartoons. Afternoons can
   have adventure and comedy movies. Evenings should have
   quality dramas and action movies suitable for all ages.
   ```
3. Click **Generate**
4. Review and edit the generated profile
5. Save

### Modifying a Profile

1. Open an existing profile
2. Click **AI Modify**
3. Describe the changes:
   ```
   Add a late-night block from 11 PM to 6 AM with
   horror and thriller movies rated R.
   ```
4. Review changes
5. Save

---

## Scheduling

Automate programming generation on a schedule.

### Creating a Schedule

1. Navigate to **Scheduling**
2. Click **New Schedule**
3. Configure:
   - **Name**: Schedule identifier
   - **Type**: Programming or Scoring
   - **Channel**: Target Tunarr channel
   - **Profile**: Profile to use
   - **Frequency**: When to run

### Frequency Options

**Simple Mode:**
- Daily at specific time
- Weekly on specific days
- Custom days selection

**Expert Mode:**
- Cron expression

### Schedule Management

| Action | Description |
|--------|-------------|
| **Enable/Disable** | Toggle schedule active state |
| **Run Now** | Execute immediately |
| **Edit** | Modify settings |
| **Delete** | Remove schedule |

### Viewing Results

- Check **History** for execution logs
- Scheduled executions are marked with an icon

---

## History

Track all programming and scoring executions.

### History List

| Column | Description |
|--------|-------------|
| **Date** | Execution timestamp |
| **Type** | Programming/Scoring |
| **Channel** | Target channel |
| **Profile** | Profile used |
| **Status** | Success/Failed/Running |
| **Score** | Average score |
| **Scheduled** | Scheduled execution indicator |

### History Details

Click on any entry to view:

- Execution parameters
- Full results
- Error messages (if failed)
- Comparison with previous runs

### Comparison

Compare two history entries:

1. Select first entry
2. Click **Compare**
3. Select second entry
4. View differences

---

## Settings

Configure SmarTunarr and external services.

### Services

#### Plex
- **URL**: Server address
- **Token**: Authentication token
- **Test**: Verify connection

#### Tunarr
- **URL**: Server address
- **Username**: Optional
- **Password**: Optional
- **Test**: Verify connection

#### TMDB
- **API Key**: Your TMDB key
- **Test**: Verify connection

#### Ollama
- **URL**: Server address
- **Model**: Default model
- **Test**: Verify connection

### Application

- **Language**: Interface language
- **Theme**: Light/Dark/Auto

### Data Management

- **Export Config**: Backup configuration
- **Import Config**: Restore configuration
- **Clear History**: Remove old entries

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New profile |
| `Ctrl + S` | Save |
| `Ctrl + E` | Export |
| `Escape` | Close modal |

---

## Tips & Best Practices

### Profile Design

1. **Start simple**: Begin with 3-4 time blocks
2. **Test iterations**: Use 10-50 for testing, 100+ for production
3. **Balance criteria**: Don't over-constrain blocks
4. **Use M/F/P wisely**: Forbidden rules are strict

### Performance

1. **Reasonable iterations**: More isn't always better
2. **Cache metadata**: TMDB data is cached automatically
3. **Off-peak scheduling**: Schedule automation during quiet hours

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Low scores | Relax criteria or add more content |
| No content found | Check Plex library availability |
| Timing violations | Adjust block boundaries |
| Slow performance | Reduce iterations |

---

## Glossary

| Term | Definition |
|------|------------|
| **Block** | Time period with specific criteria |
| **Criterion** | Scoring factor (type, duration, genre, etc.) |
| **Iteration** | Single scheduling attempt |
| **M/F/P** | Mandatory/Forbidden/Preferred rules |
| **Profile** | Complete scheduling configuration |
| **Score** | Content fitness rating (0-100) |
| **Weight** | Criterion importance factor |
| **Multiplier** | Criterion impact amplifier |

---

## Next Steps

- [Scoring System](SCORING_SYSTEM.md) - Deep dive into scoring
- [API Reference](API.md) - Automation via API
- [Development Guide](DEVELOPMENT.md) - Contributing
