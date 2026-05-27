-- 花マスタ (種類ごとの不変知識)
CREATE TABLE IF NOT EXISTS flowers (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  names         JSONB NOT NULL,
  meanings      JSONB NOT NULL,
  birth_days    JSONB NOT NULL DEFAULT '[]'::jsonb,
  seasons       JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_color TEXT,
  image_url     TEXT,
  notes         TEXT
);

-- 在庫 (日々動く)
CREATE TABLE IF NOT EXISTS inventory (
  id            SERIAL PRIMARY KEY,
  flower_id     INT NOT NULL REFERENCES flowers(id) ON DELETE CASCADE,
  color         TEXT,
  stock         INT NOT NULL DEFAULT 0,
  received_at   DATE NOT NULL,
  price         INT,
  photo_url     TEXT,
  note          TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_received_at ON inventory(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_flower_id ON inventory(flower_id);
