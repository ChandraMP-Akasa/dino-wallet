
CREATE DATABASE IF NOT EXISTS dino_wallet;
USE dino_wallet;


CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE assets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    precision_value INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (precision_value >= 0)
) ENGINE=InnoDB;

CREATE TABLE conversion (
    from_asset_id BIGINT NOT NULL,
    to_asset_id BIGINT NOT NULL,
    rate DECIMAL(20,10) NOT NULL,
    PRIMARY KEY (from_asset_id, to_asset_id),
    CONSTRAINT fk_conversion_from FOREIGN KEY (from_asset_id)
        REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversion_to FOREIGN KEY (to_asset_id)
        REFERENCES assets(id) ON DELETE CASCADE,
    CHECK (rate > 0)
) ENGINE=InnoDB;


CREATE TABLE wallets (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_type ENUM('system','user') NOT NULL,
    owner_id BIGINT NULL,
    asset_id BIGINT NOT NULL,
    balance_cached DECIMAL(20,6) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_wallet (owner_type, owner_id, asset_id),
    CONSTRAINT fk_wallet_asset FOREIGN KEY (asset_id)
        REFERENCES assets(id) ON DELETE CASCADE,
    CONSTRAINT fk_wallet_user FOREIGN KEY (owner_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;


CREATE TABLE orders (
    id CHAR(36) PRIMARY KEY,
    user_id BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,
    type ENUM('topup','bonus','spend') NOT NULL,
    amount DECIMAL(20,6) NOT NULL,
    status ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_asset FOREIGN KEY (asset_id)
        REFERENCES assets(id)
) ENGINE=InnoDB;


CREATE TABLE ledger (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id CHAR(36) NOT NULL,
    wallet_id BIGINT NOT NULL,
    debit_amount DECIMAL(20,6) NOT NULL DEFAULT 0,
    credit_amount DECIMAL(20,6) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ledger_order FOREIGN KEY (order_id)
        REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_ledger_wallet FOREIGN KEY (wallet_id)
        REFERENCES wallets(id) ON DELETE CASCADE,
    CHECK (
        (debit_amount > 0 AND credit_amount = 0)
        OR
        (credit_amount > 0 AND debit_amount = 0)
    )
) ENGINE=InnoDB;

CREATE INDEX idx_ledger_order ON ledger(order_id);
CREATE INDEX idx_ledger_wallet ON ledger(wallet_id);


INSERT INTO assets (name, precision_value) VALUES
('credits', 0),
('rewards', 0),
('gems', 0);

INSERT INTO users (username, password_hash, email, phone) VALUES
('marry', 'password1', 'marry@gmail.com', null),
('beth', 'password2', 'beth@gmail.com', null);


INSERT INTO conversion (from_asset_id, to_asset_id, rate)
SELECT a1.id, a2.id, 10
FROM assets a1, assets a2
WHERE a1.name = 'credits' AND a2.name = 'rewards';

INSERT INTO conversion (from_asset_id, to_asset_id, rate)
SELECT a1.id, a2.id, 1
FROM assets a1, assets a2
WHERE a1.name = 'credits' AND a2.name = 'gems';

INSERT INTO wallets (owner_type, owner_id, asset_id)
SELECT 'system', NULL, id FROM assets;

INSERT INTO wallets (owner_type, owner_id, asset_id)
SELECT 'user', u.id, a.id
FROM users u
JOIN assets a ON a.name = 'credits';
