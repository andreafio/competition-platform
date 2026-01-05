# Competition Engine API

Stateless bracket generation engine for competition management platforms.

## Overview

The Competition Engine generates fair, optimized tournament brackets using advanced algorithms. It supports seeding, collision avoidance, and quality scoring to ensure competitive integrity.

## Quick Start

```bash
# Generate a bracket
curl -X POST http://localhost:8000/v1/brackets/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "context": {
      "sport": "fencing",
      "format": "individual",
      "repechage": false
    },
    "rules": {
      "seeding_mode": "auto",
      "max_seeds": 4,
      "penalties": {
        "same_club_r1": 1000,
        "same_nation_r1": 600,
        "rematch_recent": 400
      }
    },
    "participants": [
      {"athlete_id": "A1", "ranking_points": 100, "club_id": "C1", "nation_code": "ITA"},
      {"athlete_id": "A2", "ranking_points": 90, "club_id": "C2", "nation_code": "FRA"}
    ],
    "history": {"recent_pairs": []}
  }'
```

## API Reference

### POST /v1/brackets/generate

Generates a tournament bracket.

**Request Body:**
- `context`: Tournament context (sport, format, repechage)
- `rules`: Seeding and penalty rules
- `participants`: List of athletes with rankings
- `history`: Recent pairing history

**Response:**
- `summary`: Bracket metadata and quality scores
- `participants_slots`: Athlete positions
- `matches`: Tournament matches
- `repechage_matches`: Repechage matches (if enabled)

## Limits

- **Participants**: 4-256 athletes
- **Rounds**: Up to 8 rounds (256 participants)
- **Response Time**: <2 seconds for typical brackets
- **Determinism**: Same input = same output

## Quality Scoring

Each bracket includes quality metrics:
- **Score**: Overall quality (0-100)
- **Collisions**: Club/nation conflicts in Round 1
- **Seed Protection**: Top seed separation
- **Bye Fairness**: Bye distribution equity

## FAQ

### Why this bracket?

The algorithm optimizes for:
1. **Fairness**: Balanced competitions
2. **Competitiveness**: Avoid easy matches
3. **Integrity**: Minimize conflicts of interest
4. **Predictability**: Deterministic results

Quality scores help explain algorithmic decisions.

### Can I customize rules?

Yes, override penalties and seeding parameters to match your tournament philosophy.

### Is it deterministic?

Yes, identical inputs produce identical brackets. Use `draw_seed` for controlled randomization.

## Support

For integration support, contact the Athlos team.