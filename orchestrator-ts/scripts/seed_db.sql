-- Minimal schema for Athlos Competition Platform

-- Events table (basic)
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    name TEXT,
    sport TEXT,
    start_date DATE,
    end_date DATE
);

-- Athletes table
CREATE TABLE IF NOT EXISTS athletes (
    id SERIAL PRIMARY KEY,
    club_id TEXT,
    nation_code TEXT,
    ranking_points INTEGER,
    meta JSONB
);

-- Event divisions
CREATE TABLE IF NOT EXISTS event_divisions (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id),
    code TEXT
);

-- Event registrations
CREATE TABLE IF NOT EXISTS event_registrations (
    event_id INTEGER,
    athlete_id INTEGER REFERENCES athletes(id),
    division_id INTEGER REFERENCES event_divisions(id),
    status TEXT,
    seed INTEGER,
    PRIMARY KEY (event_id, athlete_id, division_id)
);

-- Bracket jobs
CREATE TABLE IF NOT EXISTS bracket_jobs (
    id SERIAL PRIMARY KEY,
    event_id INTEGER,
    division_id INTEGER,
    webhook_url TEXT,
    webhook_secret TEXT,
    overrides JSONB,
    status TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    data JSONB
);

-- Insert test data

-- Event
INSERT INTO events (name, sport, start_date, end_date) VALUES
('Test Competition', 'judo', '2026-01-01', '2026-01-02');

-- Athletes: 27 athletes, 6 clubs
INSERT INTO athletes (club_id, nation_code, ranking_points, meta) VALUES
('club_1', 'ITA', 1127, '{"belt": "white"}'),
('club_2', 'ITA', NULL, '{"belt": "brown"}'),
('club_3', 'ITA', 953, '{"belt": "white"}'),
('club_4', 'ITA', 876, '{"belt": "blue"}'),
('club_5', 'ITA', 789, '{"belt": "purple"}'),
('club_6', 'ITA', 654, '{"belt": "brown"}'),
('club_1', 'ITA', 543, '{"belt": "black"}'),
('club_2', 'ITA', 432, '{"belt": "white"}'),
('club_3', 'ITA', 321, '{"belt": "blue"}'),
('club_4', 'ITA', 210, '{"belt": "purple"}'),
('club_5', 'ITA', 199, '{"belt": "brown"}'),
('club_6', 'ITA', 188, '{"belt": "black"}'),
('club_1', 'ITA', 177, '{"belt": "white"}'),
('club_2', 'ITA', 166, '{"belt": "blue"}'),
('club_3', 'ITA', 155, '{"belt": "purple"}'),
('club_4', 'ITA', 144, '{"belt": "brown"}'),
('club_5', 'ITA', 133, '{"belt": "black"}'),
('club_6', 'ITA', 122, '{"belt": "white"}'),
('club_1', 'ITA', 111, '{"belt": "blue"}'),
('club_2', 'ITA', 100, '{"belt": "purple"}'),
('club_3', 'ITA', 89, '{"belt": "brown"}'),
('club_4', 'ITA', 78, '{"belt": "black"}'),
('club_5', 'ITA', 67, '{"belt": "white"}'),
('club_6', 'ITA', 56, '{"belt": "blue"}'),
('club_1', 'ITA', 45, '{"belt": "purple"}'),
('club_2', 'ITA', 34, '{"belt": "brown"}'),
('club_3', 'ITA', 23, '{"belt": "black"}');

-- Division
INSERT INTO event_divisions (event_id, code) VALUES
(1, 'JUDO|MALE|U18|60KG');

-- Registrations: all to div1, status confirmed
INSERT INTO event_registrations (event_id, athlete_id, division_id, status, seed) VALUES
(1, 1, 1, 'confirmed', NULL),
(1, 2, 1, 'confirmed', NULL),
(1, 3, 1, 'confirmed', NULL),
(1, 4, 1, 'confirmed', NULL),
(1, 5, 1, 'confirmed', NULL),
(1, 6, 1, 'confirmed', NULL),
(1, 7, 1, 'confirmed', NULL),
(1, 8, 1, 'confirmed', NULL),
(1, 9, 1, 'confirmed', NULL),
(1, 10, 1, 'confirmed', NULL),
(1, 11, 1, 'confirmed', NULL),
(1, 12, 1, 'confirmed', NULL),
(1, 13, 1, 'confirmed', NULL),
(1, 14, 1, 'confirmed', NULL),
(1, 15, 1, 'confirmed', NULL),
(1, 16, 1, 'confirmed', NULL),
(1, 17, 1, 'confirmed', NULL),
(1, 18, 1, 'confirmed', NULL),
(1, 19, 1, 'confirmed', NULL),
(1, 20, 1, 'confirmed', NULL),
(1, 21, 1, 'confirmed', NULL),
(1, 22, 1, 'confirmed', NULL),
(1, 23, 1, 'confirmed', NULL),
(1, 24, 1, 'confirmed', NULL),
(1, 25, 1, 'confirmed', NULL),
(1, 26, 1, 'confirmed', NULL),
(1, 27, 1, 'confirmed', NULL);