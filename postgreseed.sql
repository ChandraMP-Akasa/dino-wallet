-- Create database (run separately if needed)
CREATE SCHEMA dinowallet;
SET search_path TO dinowallet;

-- =========================
-- ENUM TYPES
-- =========================

CREATE TYPE owner_type_enum AS ENUM ('system','user');
CREATE TYPE order_type_enum AS ENUM ('topup','bonus','spend');
CREATE TYPE order_status_enum AS ENUM ('pending','processing','completed','failed');

-- =========================
-- USERS
-- =========================

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- ASSETS
-- =========================

CREATE TABLE assets (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    precision_value INT NOT NULL DEFAULT 0 CHECK (precision_value >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- CONVERSION
-- =========================

CREATE TABLE conversion (
    from_asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    to_asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    rate NUMERIC(20,10) NOT NULL CHECK (rate > 0),
    PRIMARY KEY (from_asset_id, to_asset_id)
);

-- =========================
-- WALLETS
-- =========================

CREATE TABLE wallets (
    id BIGSERIAL PRIMARY KEY,
    owner_type owner_type_enum NOT NULL,
    owner_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    balance_cached NUMERIC(20,6) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_type, owner_id, asset_id)
);

-- =========================
-- ORDERS
-- =========================

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL REFERENCES assets(id),
    type order_type_enum NOT NULL,
    amount NUMERIC(20,6) NOT NULL,
    status order_status_enum NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- LEDGER
-- =========================

CREATE TABLE ledger (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    wallet_id BIGINT NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    debit_amount NUMERIC(20,6) NOT NULL DEFAULT 0,
    credit_amount NUMERIC(20,6) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (debit_amount > 0 AND credit_amount = 0)
        OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);

CREATE INDEX idx_ledger_order ON ledger(order_id);
CREATE INDEX idx_ledger_wallet ON ledger(wallet_id);

-- =========================
-- SEED DATA
-- =========================

INSERT INTO assets (name, precision_value) VALUES
('credits', 0),
('rewards', 0),
('gems', 0);


-- credits → rewards (1:10)
INSERT INTO conversion (from_asset_id, to_asset_id, rate)
SELECT a1.id, a2.id, 10
FROM assets a1
JOIN assets a2 ON a2.name = 'rewards'
WHERE a1.name = 'credits';

-- credits → gems (1:1)
INSERT INTO conversion (from_asset_id, to_asset_id, rate)
SELECT a1.id, a2.id, 1
FROM assets a1
JOIN assets a2 ON a2.name = 'gems'
WHERE a1.name = 'credits';

-- System wallets for all assets
INSERT INTO wallets (owner_type, owner_id, asset_id)
SELECT 'system', NULL, id FROM assets;

-- User wallets only for credits initially
INSERT INTO wallets (owner_type, owner_id, asset_id)
SELECT 'user', u.id, a.id
FROM users u
JOIN assets a ON a.name = 'credits';
