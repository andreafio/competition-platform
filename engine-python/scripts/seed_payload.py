import json, random, hashlib
from datetime import date

def stable_seed(payload: dict) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + hashlib.sha256(raw).hexdigest()

def generate_participants(n=27, clubs=8, null_club_rate=0.1, null_rank_rate=0.15):
    random.seed(42)
    club_ids = [f"club_{i}" for i in range(clubs)]
    weights = [max(1, (clubs - i)) for i in range(clubs)]  # pochi club grandi, molti piccoli
    participants = []
    for i in range(n):
        club = random.choices(club_ids, weights=weights, k=1)[0]
        if random.random() < null_club_rate:
            club = None
        ranking = random.randint(1, 3000)
        if random.random() < null_rank_rate:
            ranking = None

        participants.append({
            "athlete_id": f"athlete_{i}",
            "club_id": club,
            "nation_code": "ITA",
            "ranking_points": ranking,
            "seed": None,
            "meta": {"belt": random.choice(["white","brown","black"])}
        })
    return participants

def build_payload(n=27):
    payload = {
        "context": {
            "sport": "judo",
            "format": "single_elim",
            "repechage": True,
            "draw_seed": None,
            "engine_mode": "deterministic"
        },
        "rules": {
            "seeding_mode": "auto",
            "max_seeds": 8,
            "seeding_thresholds": {"min_16": 8, "lt_16": 4},
            "separate_by": ["club"],
            "avoid_rematch_days": 0,
            "byes_policy": "prefer_high_seeds"
        },
        "participants": generate_participants(n=n)
    }
    payload["context"]["draw_seed"] = stable_seed(payload)
    return payload

if __name__ == "__main__":
    payload = build_payload(n=27)
    with open('temp/engine_payload.json', 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)
    print("Payload saved to temp/engine_payload.json")