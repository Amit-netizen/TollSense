-- TollSense Database Schema
-- Run automatically by Docker on first start

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    class       VARCHAR(20) NOT NULL CHECK (class IN ('motorcycle', 'car', 'lcv', 'bus', 'truck', 'hcm')),
    axle_count  INTEGER NOT NULL DEFAULT 2,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id   UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    origin       VARCHAR(200) NOT NULL,
    destination  VARCHAR(200) NOT NULL,
    distance_km  NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Toll estimates table
CREATE TABLE IF NOT EXISTS toll_estimates (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    toll_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0,
    fuel_cost    NUMERIC(10, 2) NOT NULL DEFAULT 0,
    flagged      BOOLEAN NOT NULL DEFAULT FALSE,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Corridors table
CREATE TABLE IF NOT EXISTS corridors (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(200) NOT NULL UNIQUE,
    avg_toll     NUMERIC(10, 2) NOT NULL DEFAULT 0,
    trip_count   INTEGER NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users table (for auth)
CREATE TABLE IF NOT EXISTS users (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email        VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(200) NOT NULL,
    name         VARCHAR(100) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_created_at ON trips(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_toll_estimates_trip_id ON toll_estimates(trip_id);
CREATE INDEX IF NOT EXISTS idx_toll_estimates_flagged ON toll_estimates(flagged);

-- Seed default user (password: admin123)
INSERT INTO users (email, password_hash, name)
VALUES ('admin@tollsense.io', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Fleet Admin')
ON CONFLICT (email) DO NOTHING;

-- Seed vehicles
INSERT INTO vehicles (id, name, class, axle_count) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Honda Activa', 'motorcycle', 2),
  ('11111111-1111-1111-1111-111111111102', 'Maruti Swift', 'car', 2),
  ('11111111-1111-1111-1111-111111111103', 'Tata Ace', 'lcv', 2),
  ('11111111-1111-1111-1111-111111111104', 'Volvo Bus B11R', 'bus', 3),
  ('11111111-1111-1111-1111-111111111105', 'Ashok Leyland 3520', 'truck', 6),
  ('11111111-1111-1111-1111-111111111106', 'BharatBenz 4028T', 'hcm', 6)
ON CONFLICT DO NOTHING;

-- Seed sample trips with toll estimates
DO $$
DECLARE
  v_trip_id UUID;
  routes TEXT[][] := ARRAY[
    ARRAY['Mumbai', 'Pune', '148'],
    ARRAY['Delhi', 'Agra', '205'],
    ARRAY['Bangalore', 'Chennai', '346'],
    ARRAY['Hyderabad', 'Vijayawada', '275'],
    ARRAY['Chennai', 'Coimbatore', '497'],
    ARRAY['Mumbai', 'Surat', '284'],
    ARRAY['Delhi', 'Jaipur', '281'],
    ARRAY['Pune', 'Nashik', '212'],
    ARRAY['Bangalore', 'Mysore', '143'],
    ARRAY['Hyderabad', 'Bangalore', '568'],
    ARRAY['Mumbai', 'Nagpur', '838'],
    ARRAY['Delhi', 'Chandigarh', '246'],
    ARRAY['Chennai', 'Madurai', '462'],
    ARRAY['Ahmedabad', 'Surat', '265'],
    ARRAY['Kolkata', 'Bhubaneswar', '440']
  ];
  vehicle_ids UUID[] := ARRAY[
    '11111111-1111-1111-1111-111111111101'::UUID,
    '11111111-1111-1111-1111-111111111102'::UUID,
    '11111111-1111-1111-1111-111111111103'::UUID,
    '11111111-1111-1111-1111-111111111104'::UUID,
    '11111111-1111-1111-1111-111111111105'::UUID
  ];
  statuses TEXT[] := ARRAY['completed', 'completed', 'completed', 'in_progress', 'pending'];
  toll_amount NUMERIC;
  fuel_cost NUMERIC;
  is_flagged BOOLEAN;
  dist NUMERIC;
  i INTEGER;
  days_ago INTEGER;
BEGIN
  FOR i IN 1..array_length(routes, 1) LOOP
    dist := routes[i][3]::NUMERIC;
    toll_amount := ROUND((dist * (0.5 + random() * 1.5))::NUMERIC, 2);
    fuel_cost := ROUND((dist * (3.5 + random() * 2))::NUMERIC, 2);
    is_flagged := toll_amount > 400;
    days_ago := (random() * 29)::INTEGER;

    INSERT INTO trips (vehicle_id, origin, destination, distance_km, status, created_at, updated_at)
    VALUES (
      vehicle_ids[1 + (i % 5)],
      routes[i][1],
      routes[i][2],
      dist,
      statuses[1 + (i % 5)],
      NOW() - (days_ago || ' days')::INTERVAL,
      NOW() - (days_ago || ' days')::INTERVAL
    )
    RETURNING id INTO v_trip_id;

    INSERT INTO toll_estimates (trip_id, toll_amount, fuel_cost, flagged)
    VALUES (v_trip_id, toll_amount, fuel_cost, is_flagged);

    INSERT INTO corridors (name, avg_toll, trip_count)
    VALUES (routes[i][1] || ' → ' || routes[i][2], toll_amount, 1 + (i % 4))
    ON CONFLICT (name) DO UPDATE
      SET avg_toll = EXCLUDED.avg_toll,
          trip_count = corridors.trip_count + 1,
          updated_at = NOW();
  END LOOP;
END $$;
