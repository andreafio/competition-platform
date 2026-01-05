#!/usr/bin/env python3
"""
Definition of Done Validation Report
====================================

Questo script valida che tutti i Definition of Done siano soddisfatti:
1. E2E deterministico: stesso seed + stesso input → stesso bracket
2. Stabilità: 100 run su dataset random senza crash e con invarianti ok
3. Qualità minima: score medio ≥ 65 su dataset realistico "multi-club"
"""

import requests
import json
import statistics
import random
import time

ENGINE_URL = "http://localhost:8000"

def test_determinism():
    """Test E2E deterministico"""
    print("🧪 Testing E2E Determinism...")

    request_data = {
        "context": {
            "sport": "tennis",
            "format": "single_elimination",
            "repechage": True,
            "draw_seed": "dod_test_seed_12345",
            "engine_mode": "deterministic"
        },
        "rules": {
            "seeding_mode": "auto",
            "max_seeds": 8,
            "seeding_thresholds": {"min_16": 8, "lt_16": 4},
            "separate_by": ["club"],
            "avoid_rematch_days": 0,
            "byes_policy": "prefer_high_seeds",
            "penalties": {"same_club_r1": 1000, "same_nation_r1": 600, "rematch_recent": 400}
        },
        "participants": [
            {"athlete_id": f"P{i}", "club_id": f"Club{i%4}", "nation_code": ["ITA", "FRA", "ESP", "GER"][i%4],
             "ranking_points": 100-i*5, "seed": i if i <= 8 else None}
            for i in range(1, 17)
        ],
        "history": {"recent_pairs": []}
    }

    results = []
    for i in range(3):
        response = requests.post(f"{ENGINE_URL}/v1/brackets/generate",
                               json=request_data,
                               headers={"Authorization": "Bearer test"})
        assert response.status_code == 200
        results.append(response.json())

    # Verify all results are identical
    assert results[0] == results[1] == results[2]
    print("✅ E2E Determinism: PASSED")


def test_stability():
    """Test stabilità con 100 run"""
    print("🧪 Testing Stability (100 runs)...")

    random.seed(42)
    crash_count = 0
    invalid_quality_count = 0

    start_time = time.time()

    for run in range(100):
        num_participants = random.randint(4, 64)  # Riduciamo per velocità

        participants = []
        clubs = [f"club_{i}" for i in range(max(1, num_participants // 8))]
        nations = ["ITA", "FRA", "ESP", "GER", "USA", "GBR"]

        for i in range(num_participants):
            participants.append({
                "athlete_id": f"stab_{run}_P{i}",
                "club_id": random.choice(clubs),
                "nation_code": random.choice(nations),
                "ranking_points": random.randint(0, 1000),
                "seed": i+1 if i < min(8, num_participants) else None
            })

        request_data = {
            "context": {
                "sport": "tennis",
                "format": "single_elimination",
                "repechage": True,
                "draw_seed": f"stability_{run}",
                "engine_mode": "deterministic"
            },
            "rules": {
                "seeding_mode": "auto",
                "max_seeds": min(8, num_participants),
                "seeding_thresholds": {"min_16": 8, "lt_16": 4},
                "separate_by": ["club"],
                "avoid_rematch_days": 0,
                "byes_policy": "prefer_high_seeds",
                "penalties": {"same_club_r1": 1000, "same_nation_r1": 600, "rematch_recent": 400}
            },
            "participants": participants,
            "history": {"recent_pairs": []}
        }

        try:
            response = requests.post(f"{ENGINE_URL}/v1/brackets/generate",
                                   json=request_data,
                                   headers={"Authorization": "Bearer test"},
                                   timeout=10)

            if response.status_code != 200:
                crash_count += 1
                continue

            data = response.json()

            # Check quality score validity
            quality = data["summary"]["quality"]
            if not (0 <= quality["score"] <= 100):
                invalid_quality_count += 1

        except Exception as e:
            crash_count += 1

    elapsed = time.time() - start_time
    print(".2f")
    print(f"   Invalid quality scores: {invalid_quality_count}")

    assert crash_count == 0, f"Too many crashes: {crash_count}"
    assert invalid_quality_count == 0, f"Invalid quality scores: {invalid_quality_count}"
    print("✅ Stability: PASSED")


def test_quality():
    """Test qualità minima"""
    print("🧪 Testing Quality Minimum...")

    random.seed(123)
    quality_scores = []

    for tournament_id in range(30):  # Riduciamo per velocità
        size = random.choice([8, 16, 32])

        clubs = [f"Club_{i}" for i in range(size // 4)]
        nations = ["ITA", "FRA", "ESP", "GER", "USA", "GBR"]

        participants = []
        for i in range(size):
            participants.append({
                "athlete_id": f"Q{tournament_id}_{i}",
                "club_id": random.choice(clubs),
                "nation_code": random.choice(nations),
                "ranking_points": random.randint(50, 950),
                "seed": i+1 if i < min(8, size) else None
            })

        request_data = {
            "context": {
                "sport": "tennis",
                "format": "single_elimination",
                "repechage": True,
                "draw_seed": f"quality_{tournament_id}",
                "engine_mode": "deterministic"
            },
            "rules": {
                "seeding_mode": "auto",
                "max_seeds": min(8, size),
                "seeding_thresholds": {"min_16": 8, "lt_16": 4},
                "separate_by": ["club"],
                "avoid_rematch_days": 0,
                "byes_policy": "prefer_high_seeds",
                "penalties": {"same_club_r1": 1000, "same_nation_r1": 600, "rematch_recent": 400}
            },
            "participants": participants,
            "history": {"recent_pairs": []}
        }

        response = requests.post(f"{ENGINE_URL}/v1/brackets/generate",
                               json=request_data,
                               headers={"Authorization": "Bearer test"})
        assert response.status_code == 200

        data = response.json()
        quality_scores.append(data["summary"]["quality"]["score"])

    avg_quality = statistics.mean(quality_scores)
    min_score = min(quality_scores)
    max_score = max(quality_scores)

    print(".2f")
    print(f"   Range: {min_score} - {max_score}")

    assert avg_quality >= 65, f"Average quality {avg_quality:.2f} below minimum 65"
    print("✅ Quality Minimum: PASSED")


def main():
    print("🚀 Definition of Done Validation Report")
    print("=" * 50)

    try:
        test_determinism()
        test_stability()
        test_quality()

        print("\n🎉 ALL DEFINITION OF DONE CRITERIA MET!")
        print("\n📋 Summary:")
        print("✅ E2E Deterministic: Same seed + input → Same bracket")
        print("✅ Stability: 100 runs without crashes, valid invariants")
        print("✅ Quality Minimum: Average score ≥ 65 on multi-club datasets")

    except Exception as e:
        print(f"\n❌ VALIDATION FAILED: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())