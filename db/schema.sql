CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    photo_url TEXT,
    identified_foods JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE glucose_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    value NUMERIC NOT NULL,
    is_simulated BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE research_papers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    abstract_text TEXT,
    journal TEXT,
    year INTEGER,
    topic_tags TEXT[]
);

CREATE TABLE recommendations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_id     UUID REFERENCES meals(id),
    user_id     UUID REFERENCES users(id),
    recommendation_text TEXT NOT NULL,
    research_pubmed_id  TEXT,                       -- NULL when source = 'ada_fallback'
    glucose_at_time     NUMERIC,                    -- mg/dL reading used for the tip
    source      TEXT NOT NULL DEFAULT 'gpt4o',       -- 'gpt4o' | 'ada_fallback'
    timestamp   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
