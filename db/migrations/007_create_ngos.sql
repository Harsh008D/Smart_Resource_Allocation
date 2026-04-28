CREATE TABLE IF NOT EXISTS ngos (
    ngo_id     VARCHAR(20)      PRIMARY KEY,
    name       VARCHAR(255)     NOT NULL,
    email      VARCHAR(255)     UNIQUE NOT NULL,
    latitude   DOUBLE PRECISION NOT NULL,
    longitude  DOUBLE PRECISION NOT NULL,
    skill_tags TEXT[]           NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Seed 20 NGOs across India for demo
INSERT INTO ngos (ngo_id, name, email, latitude, longitude, skill_tags) VALUES
  ('NGO1',  'Mumbai Relief Foundation',    'ngo1@example.com',  18.9388, 72.8354, ARRAY['food','medical']),
  ('NGO2',  'Delhi Aid Society',           'ngo2@example.com',  28.6139, 77.2090, ARRAY['shelter','education']),
  ('NGO3',  'Bangalore Care Network',      'ngo3@example.com',  12.9716, 77.5946, ARRAY['medical','water']),
  ('NGO4',  'Hyderabad Volunteers',        'ngo4@example.com',  17.3850, 78.4867, ARRAY['food','shelter']),
  ('NGO5',  'Chennai Seva Trust',          'ngo5@example.com',  13.0827, 80.2707, ARRAY['education','medical']),
  ('NGO6',  'Kolkata Helping Hands',       'ngo6@example.com',  22.5726, 88.3639, ARRAY['food','water']),
  ('NGO7',  'Pune Community Service',      'ngo7@example.com',  18.5204, 73.8567, ARRAY['shelter','food']),
  ('NGO8',  'Ahmedabad Relief Corps',      'ngo8@example.com',  23.0225, 72.5714, ARRAY['medical','education']),
  ('NGO9',  'Jaipur Aid Foundation',       'ngo9@example.com',  26.9124, 75.7873, ARRAY['water','food']),
  ('NGO10', 'Lucknow Welfare Society',     'ngo10@example.com', 26.8467, 80.9462, ARRAY['shelter','medical']),
  ('NGO11', 'Surat Disaster Relief',       'ngo11@example.com', 21.1702, 72.8311, ARRAY['food','shelter']),
  ('NGO12', 'Nagpur Care Foundation',      'ngo12@example.com', 21.1458, 79.0882, ARRAY['medical','water']),
  ('NGO13', 'Patna Community Trust',       'ngo13@example.com', 25.5941, 85.1376, ARRAY['education','food']),
  ('NGO14', 'Bhopal Relief Network',       'ngo14@example.com', 23.2599, 77.4126, ARRAY['shelter','water']),
  ('NGO15', 'Indore Seva Samiti',          'ngo15@example.com', 22.7196, 75.8577, ARRAY['food','medical']),
  ('NGO16', 'Coimbatore Aid Society',      'ngo16@example.com', 11.0168, 76.9558, ARRAY['water','education']),
  ('NGO17', 'Kochi Welfare Foundation',    'ngo17@example.com',  9.9312, 76.2673, ARRAY['medical','food']),
  ('NGO18', 'Guwahati Relief Trust',       'ngo18@example.com', 26.1445, 91.7362, ARRAY['shelter','food']),
  ('NGO19', 'Chandigarh Aid Network',      'ngo19@example.com', 30.7333, 76.7794, ARRAY['education','medical']),
  ('NGO20', 'Kanpur Community Service',    'ngo20@example.com', 26.4499, 80.3319, ARRAY['food','water'])
ON CONFLICT (ngo_id) DO NOTHING;
