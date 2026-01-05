from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import hashlib
import random
import math
import uuid

app = FastAPI(title="Competition Engine", version="1.0.0")

# Pydantic Models

class Context(BaseModel):
    sport: str
    format: str
    repechage: bool = True
    draw_seed: Optional[str] = None
    engine_mode: str = "deterministic"

class SeedingThresholds(BaseModel):
    min_16: int = 8
    lt_16: int = 4

class Rules(BaseModel):
    seeding_mode: str = "auto"
    max_seeds: int = 8
    seeding_thresholds: SeedingThresholds = SeedingThresholds()
    separate_by: List[str] = ["club"]
    avoid_rematch_days: int = 0
    byes_policy: str = "prefer_high_seeds"

class Participant(BaseModel):
    athlete_id: str
    club_id: Optional[str] = None
    nation_code: Optional[str] = None
    ranking_points: Optional[int] = None
    seed: Optional[int] = None
    meta: Optional[Dict[str, Any]] = None

class RecentPair(BaseModel):
    a: str
    b: str
    date: str

class History(BaseModel):
    recent_pairs: List[RecentPair] = []

class GenerateBracketRequest(BaseModel):
    context: Context
    rules: Rules
    participants: List[Participant]
    history: History = History()

class ParticipantSlot(BaseModel):
    athlete_id: str
    slot: int
    seed: Optional[int] = None

class Match(BaseModel):
    id: str
    match_type: str
    round: int
    position: int
    athlete_red: Optional[str] = None
    athlete_white: Optional[str] = None
    is_bye: bool = False
    next_match_id: Optional[str] = None
    metadata: Dict[str, Any] = {}

class RepechageMatch(BaseModel):
    id: str
    match_type: str
    round: int
    position: int
    source_loser_match_id: str
    metadata: Dict[str, Any] = {}

class Quality(BaseModel):
    club_collisions_r1: int = 0
    nation_collisions_r1: int = 0

class Summary(BaseModel):
    participants: int
    size: int
    rounds: int
    byes: int
    repechage: bool
    quality: Quality

class GenerateBracketResponse(BaseModel):
    engine_version: str = "1.0.0"
    summary: Summary
    participants_slots: List[ParticipantSlot]
    matches: List[Match]
    repechage_matches: List[RepechageMatch] = []

# Utility functions

def next_power_of_two(n: int) -> int:
    return 1 << (n - 1).bit_length()

def stable_hash(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()

def get_seed_positions(size: int, num_seeds: int) -> List[int]:
    # Standard seed positions for single elimination
    positions = {
        4: [0, 3, 1, 2],  # For size=4: 1 at 0, 4 at 3, 2 at 1, 3 at 2
        8: [0, 7, 3, 4, 1, 6, 2, 5],  # 1,8,4,5,2,7,3,6
        16: [0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10],  # Standard 16
    }
    if num_seeds in positions and len(positions[num_seeds]) >= num_seeds:
        return positions[num_seeds][:num_seeds]
    # Fallback: place in order
    return list(range(num_seeds))

def seeded_random(seed: str):
    random.seed(int(hashlib.md5(seed.encode()).hexdigest(), 16) % (2**32))

def calculate_penalty(slot: int, participant: Participant, slots: List, all_participants: List[Participant], rules: Rules, history: History) -> float:
    penalty = 0.0
    # Find opponent in round 1
    opponent_slot = slot ^ 1  # XOR for paired slots
    if opponent_slot < len(slots) and slots[opponent_slot]:
        opponent_id = slots[opponent_slot]
        opponent = next((p for p in all_participants if p.athlete_id == opponent_id), None)
        if opponent:
            # Club collision
            if rules.separate_by and 'club' in rules.separate_by and participant.club_id and opponent.club_id == participant.club_id:
                penalty += 1000
            # Nation collision
            if rules.separate_by and 'nation' in rules.separate_by and participant.nation_code and opponent.nation_code == participant.nation_code:
                penalty += 100
            # Rematch
            for pair in history.recent_pairs:
                if (pair.a == participant.athlete_id and pair.b == opponent.athlete_id) or (pair.a == opponent.athlete_id and pair.b == participant.athlete_id):
                    # Check date
                    penalty += 50
    return penalty

# Algorithm implementation

@app.post("/v1/brackets/generate")
def generate_bracket(
    request: GenerateBracketRequest,
    authorization: str = Header(..., alias="Authorization"),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key")
):
    try:
        # Basic auth check (stub)
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Get draw_seed
        draw_seed = request.context.draw_seed
        if not draw_seed:
            # Compute stable hash
            data = f"{request.context.sport}{request.context.format}{request.rules.model_dump_json()}{[p.model_dump_json() for p in request.participants]}"
            draw_seed = stable_hash(data)
        
        seeded_random(draw_seed)
        
        participants = request.participants
        n = len(participants)
        size = next_power_of_two(n)
        rounds = int(math.log2(size))
        byes = size - n
        
        # Seeding
        seeds = {}
        if request.rules.seeding_mode == "manual":
            for p in participants:
                if p.seed:
                    if p.seed in seeds:
                        raise HTTPException(status_code=400, detail="Duplicate seed")
                    seeds[p.seed] = p.athlete_id
        elif request.rules.seeding_mode == "auto":
            threshold = request.rules.seeding_thresholds.min_16 if n >= 16 else request.rules.seeding_thresholds.lt_16
            max_seeds = min(request.rules.max_seeds, threshold)
            sorted_p = sorted(participants, key=lambda x: x.ranking_points or 0, reverse=True)
            for i in range(max_seeds):
                seeds[i+1] = sorted_p[i].athlete_id
        
        # Assign slots
        slots = [None] * size
        seeded_ids = set(seeds.values())
        unseeded = [p for p in participants if p.athlete_id not in seeded_ids]
        
        # Place seeds using standard positions
        seed_positions = get_seed_positions(size, len(seeds))
        for seed_num, athlete_id in seeds.items():
            if seed_num - 1 < len(seed_positions):
                slots[seed_positions[seed_num - 1]] = athlete_id
        
        # Greedy placement for unseeded
        available_slots = [i for i in range(size) if slots[i] is None]
        for p in unseeded:
            best_slot = min(available_slots, key=lambda slot: calculate_penalty(slot, p, slots, participants, request.rules, request.history))
            slots[best_slot] = p.athlete_id
            available_slots.remove(best_slot)
        
        # For now, skip advanced greedy scoring, collisions, rematches
        
        # Create matches
        matches = []
        match_counter = 0
        def new_match_id():
            nonlocal match_counter
            match_counter += 1
            return f"match-{match_counter}-{draw_seed[:8]}"
        
        # Round 1
        for pos in range(size // 2):
            m_id = new_match_id()
            red = slots[pos*2] if pos*2 < len(slots) else None
            white = slots[pos*2 + 1] if pos*2 + 1 < len(slots) else None
            is_bye = (red is None or white is None)
            match_type = "final" if rounds == 1 else "main"
            matches.append(Match(
                id=m_id,
                match_type=match_type,
                round=1,
                position=pos+1,
                athlete_red=red,
                athlete_white=white,
                is_bye=is_bye,
                metadata={"path": f"R1:M{pos+1}"}
            ))
        
        # Subsequent rounds
        current_round_matches = matches[:]
        for r in range(2, rounds+1):
            next_round_matches = []
            for pos in range(len(current_round_matches) // 2):
                m_id = new_match_id()
                next_round_matches.append(Match(
                    id=m_id,
                    match_type="main" if r < rounds else "final",
                    round=r,
                    position=pos+1,
                    metadata={"path": f"R{r}:M{pos+1}"}
                ))
                # Link previous
                current_round_matches[pos*2].next_match_id = m_id
                current_round_matches[pos*2 + 1].next_match_id = m_id
            matches.extend(next_round_matches)
            current_round_matches = next_round_matches
        
        # Repechage (stub)
        repechage_matches = []
        if request.context.repechage:
            # Simple repechage: one round for bronze
            bronze_match_id = new_match_id()
            repechage_matches.append(RepechageMatch(
                id=bronze_match_id,
                match_type="repechage",
                round=1,
                position=1,
                source_loser_match_id=matches[0].id if matches else None,  # Stub
                metadata={"path": "REP:R1:M1"}
            ))
            # Link to main final
            if matches and len(matches) > 1:
                final_match = next((m for m in matches if m.match_type == "final"), None)
                if final_match:
                    final_match.next_match_id = bronze_match_id  # Not accurate, but placeholder
        
        # Participants slots
        participants_slots = []
        for slot, athlete_id in enumerate(slots):
            if athlete_id:
                seed = next((s for s, aid in seeds.items() if aid == athlete_id), None)
                participants_slots.append(ParticipantSlot(athlete_id=athlete_id, slot=slot+1, seed=seed))
        
        # Quality (stub)
        club_collisions = 0
        nation_collisions = 0
        for i in range(0, size, 2):
            if slots[i] and slots[i+1]:
                p1 = next((p for p in participants if p.athlete_id == slots[i]), None)
                p2 = next((p for p in participants if p.athlete_id == slots[i+1]), None)
                if p1 and p2:
                    if p1.club_id and p2.club_id == p1.club_id:
                        club_collisions += 1
                    if p1.nation_code and p2.nation_code == p1.nation_code:
                        nation_collisions += 1
        quality = Quality(club_collisions_r1=club_collisions, nation_collisions_r1=nation_collisions)
        
        summary = Summary(
            participants=n,
            size=size,
            rounds=rounds,
            byes=byes,
            repechage=request.context.repechage,
            quality=quality
        )
        
        return GenerateBracketResponse(
            summary=summary,
            participants_slots=participants_slots,
            matches=matches,
            repechage_matches=repechage_matches
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}
