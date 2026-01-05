import pytest
from fastapi.testclient import TestClient
from app.main import app
from hypothesis import given, strategies as st

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_generate_bracket_basic():
    request_data = {
        "context": {
            "sport": "judo",
            "format": "single_elim",
            "repechage": True
        },
        "rules": {
            "seeding_mode": "off"
        },
        "participants": [
            {"athlete_id": "a1", "ranking_points": 100},
            {"athlete_id": "a2", "ranking_points": 90}
        ]
    }
    response = client.post("/v1/brackets/generate", json=request_data, headers={"Authorization": "Bearer test"})
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["participants"] == 2
    assert data["summary"]["size"] == 2
    assert len(data["matches"]) == 1  # Final match
    assert data["matches"][0]["match_type"] == "final"

@given(st.lists(st.fixed_dictionaries({
    "athlete_id": st.text(min_size=1),
    "ranking_points": st.integers(0, 1000),
    "club_id": st.one_of(st.none(), st.text()),
    "nation_code": st.one_of(st.none(), st.text()),
}), min_size=1, max_size=32))
def test_no_duplicate_athletes(participants):
    # Ensure unique athlete_ids
    unique_ids = set(p["athlete_id"] for p in participants)
    if len(unique_ids) != len(participants):
        pytest.skip("Duplicate athlete_ids in generated data")
    
    request_data = {
        "context": {
            "sport": "judo",
            "format": "single_elim",
            "repechage": False
        },
        "rules": {
            "seeding_mode": "off"
        },
        "participants": participants
    }
    response = client.post("/v1/brackets/generate", json=request_data, headers={"Authorization": "Bearer test"})
    assert response.status_code == 200
    data = response.json()
    
    # Check no duplicate athletes in slots
    athlete_ids = [slot["athlete_id"] for slot in data["participants_slots"]]
    assert len(athlete_ids) == len(set(athlete_ids))
    
    # Check matches have unique athletes
    for match in data["matches"]:
        athletes = []
        if match["athlete_red"]:
            athletes.append(match["athlete_red"])
        if match["athlete_white"]:
            athletes.append(match["athlete_white"])
        assert len(athletes) == len(set(athletes))

def test_determinism():
    request_data = {
        "context": {
            "sport": "judo",
            "format": "single_elim",
            "draw_seed": "fixed_seed"
        },
        "rules": {"seeding_mode": "off"},
        "participants": [
            {"athlete_id": "a1", "ranking_points": 100},
            {"athlete_id": "a2", "ranking_points": 90},
            {"athlete_id": "a3", "ranking_points": 80}
        ]
    }
    response1 = client.post("/v1/brackets/generate", json=request_data, headers={"Authorization": "Bearer test"})
    response2 = client.post("/v1/brackets/generate", json=request_data, headers={"Authorization": "Bearer test"})
    assert response1.json() == response2.json()

def test_auto_seeding():
    request_data = {
        "context": {"sport": "judo", "format": "single_elim"},
        "rules": {"seeding_mode": "auto", "max_seeds": 2},
        "participants": [
            {"athlete_id": "a1", "ranking_points": 100},
            {"athlete_id": "a2", "ranking_points": 90},
            {"athlete_id": "a3", "ranking_points": 80}
        ]
    }
    response = client.post("/v1/brackets/generate", json=request_data, headers={"Authorization": "Bearer test"})
    assert response.status_code == 200
    data = response.json()
    slots = data["participants_slots"]
    seeded = [s for s in slots if s["seed"]]
    assert len(seeded) == 2