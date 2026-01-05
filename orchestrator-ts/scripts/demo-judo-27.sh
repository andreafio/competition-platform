#!/bin/bash

# Demo: Deterministic Judo Bracket Generation (27 athletes)
# Always generates the same bracket for consistent demos

echo "🏆 Athlos Competition Engine Demo"
echo "=================================="
echo ""

# Fixed draw seed for determinism
DRAW_SEED="demo-fixed-seed-2026"

# Generate bracket
echo "Generating bracket for 27 judo athletes..."
RESPONSE=$(curl -s -X POST http://localhost:8000/v1/brackets/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{
    "context": {
      "sport": "judo",
      "format": "individual",
      "repechage": true,
      "draw_seed": "'$DRAW_SEED'"
    },
    "rules": {
      "seeding_mode": "auto",
      "max_seeds": 8,
      "penalties": {
        "same_club_r1": 1000,
        "same_nation_r1": 600,
        "rematch_recent": 400
      }
    },
    "participants": [
      {"athlete_id": "1", "ranking_points": 1127, "club_id": "club_1", "nation_code": "ITA"},
      {"athlete_id": "2", "ranking_points": null, "club_id": "club_2", "nation_code": "ITA"},
      {"athlete_id": "3", "ranking_points": 953, "club_id": "club_3", "nation_code": "ITA"},
      {"athlete_id": "4", "ranking_points": 876, "club_id": "club_4", "nation_code": "ITA"},
      {"athlete_id": "5", "ranking_points": 789, "club_id": "club_5", "nation_code": "ITA"},
      {"athlete_id": "6", "ranking_points": 654, "club_id": "club_6", "nation_code": "ITA"},
      {"athlete_id": "7", "ranking_points": 543, "club_id": "club_1", "nation_code": "ITA"},
      {"athlete_id": "8", "ranking_points": 432, "club_id": "club_2", "nation_code": "ITA"},
      {"athlete_id": "9", "ranking_points": 321, "club_id": "club_3", "nation_code": "ITA"},
      {"athlete_id": "10", "ranking_points": 210, "club_id": "club_4", "nation_code": "ITA"},
      {"athlete_id": "11", "ranking_points": 199, "club_id": "club_5", "nation_code": "ITA"},
      {"athlete_id": "12", "ranking_points": 188, "club_id": "club_6", "nation_code": "ITA"},
      {"athlete_id": "13", "ranking_points": 177, "club_id": "club_1", "nation_code": "ITA"},
      {"athlete_id": "14", "ranking_points": 166, "club_id": "club_2", "nation_code": "ITA"},
      {"athlete_id": "15", "ranking_points": 155, "club_id": "club_3", "nation_code": "ITA"},
      {"athlete_id": "16", "ranking_points": 144, "club_id": "club_4", "nation_code": "ITA"},
      {"athlete_id": "17", "ranking_points": 133, "club_id": "club_5", "nation_code": "ITA"},
      {"athlete_id": "18", "ranking_points": 122, "club_id": "club_6", "nation_code": "ITA"},
      {"athlete_id": "19", "ranking_points": 111, "club_id": "club_1", "nation_code": "ITA"},
      {"athlete_id": "20", "ranking_points": 100, "club_id": "club_2", "nation_code": "ITA"},
      {"athlete_id": "21", "ranking_points": 89, "club_id": "club_3", "nation_code": "ITA"},
      {"athlete_id": "22", "ranking_points": 78, "club_id": "club_4", "nation_code": "ITA"},
      {"athlete_id": "23", "ranking_points": 67, "club_id": "club_5", "nation_code": "ITA"},
      {"athlete_id": "24", "ranking_points": 56, "club_id": "club_6", "nation_code": "ITA"},
      {"athlete_id": "25", "ranking_points": 45, "club_id": "club_1", "nation_code": "ITA"},
      {"athlete_id": "26", "ranking_points": 34, "club_id": "club_2", "nation_code": "ITA"},
      {"athlete_id": "27", "ranking_points": 23, "club_id": "club_3", "nation_code": "ITA"}
    ],
    "history": {"recent_pairs": []}
  }')

# Extract quality score
QUALITY_SCORE=$(echo $RESPONSE | jq -r '.summary.quality.score')
COLLISIONS_CLUB=$(echo $RESPONSE | jq -r '.summary.quality.club_collisions_r1')
COLLISIONS_NATION=$(echo $RESPONSE | jq -r '.summary.quality.nation_collisions_r1')
SEED_PROTECTION=$(echo $RESPONSE | jq -r '.summary.quality.seed_protection')
BYE_FAIRNESS=$(echo $RESPONSE | jq -r '.summary.quality.bye_fairness')

echo ""
echo "📊 Quality Analysis:"
echo "===================="
echo "Overall Score: $QUALITY_SCORE/100"
echo "Club Collisions (R1): $COLLISIONS_CLUB"
echo "Nation Collisions (R1): $COLLISIONS_NATION"
echo "Seed Protection: $SEED_PROTECTION"
echo "Bye Fairness: $BYE_FAIRNESS"
echo ""

# Save output
echo $RESPONSE > demo-bracket-output.json
echo "💾 Output saved to demo-bracket-output.json"
echo ""

echo "✅ Demo complete! This bracket is always identical for the same input."
echo "   Perfect for sales demos and onboarding presentations."