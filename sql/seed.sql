--
-- PostgreSQL database dump
--

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: dinowallet; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA dinowallet;

--
-- Name: order_status_enum; Type: TYPE; Schema: dinowallet; Owner: -
--

CREATE TYPE dinowallet.order_status_enum AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
);


--
-- Name: order_type_enum; Type: TYPE; Schema: dinowallet; Owner: -
--

CREATE TYPE dinowallet.order_type_enum AS ENUM (
    'topup',
    'bonus',
    'spend'
);


--
-- Name: owner_type_enum; Type: TYPE; Schema: dinowallet; Owner: -
--

CREATE TYPE dinowallet.owner_type_enum AS ENUM (
    'system',
    'user'
);


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: dinowallet; Owner: -
--

CREATE FUNCTION dinowallet.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assets; Type: TABLE; Schema: dinowallet; Owner: -
--

CREATE TABLE dinowallet.assets (
    id bigint NOT NULL,
    name character varying(100) NOT NULL,
    precision_value integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT assets_precision_value_check CHECK ((precision_value >= 0))
);


--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: dinowallet; Owner: -
--

CREATE SEQUENCE dinowallet.assets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assets_id_seq; Type: SEQUENCE OWNED BY; Schema: dinowallet; Owner: -
--

ALTER SEQUENCE dinowallet.assets_id_seq OWNED BY dinowallet.assets.id;


--
-- Name: conversion; Type: TABLE; Schema: dinowallet; Owner: -
--

CREATE TABLE dinowallet.conversion (
    from_asset_id bigint NOT NULL,
    to_asset_id bigint NOT NULL,
    rate numeric(20,10) NOT NULL,
    CONSTRAINT conversion_rate_check CHECK ((rate > (0)::numeric))
);


--
-- Name: ledger; Type: TABLE; Schema: dinowallet; Owner: -
--

CREATE TABLE dinowallet.ledger (
    order_id uuid NOT NULL,
    wallet_id bigint NOT NULL,
    debit_amount numeric(20,6) DEFAULT 0 NOT NULL,
    credit_amount numeric(20,6) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id uuid NOT NULL,
    CONSTRAINT ledger_check CHECK ((((debit_amount > (0)::numeric) AND (credit_amount = (0)::numeric)) OR ((credit_amount > (0)::numeric) AND (debit_amount = (0)::numeric))))
);


--
-- Name: orders; Type: TABLE; Schema: dinowallet; Owner: -
--

CREATE TABLE dinowallet.orders (
    id uuid NOT NULL,
    user_id bigint NOT NULL,
    asset_id bigint NOT NULL,
    type dinowallet.order_type_enum NOT NULL,
    amount numeric(20,6) NOT NULL,
    status dinowallet.order_status_enum DEFAULT 'pending'::dinowallet.order_status_enum NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '00:10:00'::interval) NOT NULL,
    failed_reason text,
    last_attempt_at timestamp without time zone,
    CONSTRAINT orders_amount_positive CHECK ((amount > (0)::numeric))
);


--
-- Name: users; Type: TABLE; Schema: dinowallet; Owner: -
--

CREATE TABLE dinowallet.users (
    id bigint NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    type character varying DEFAULT 'user'::character varying NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: dinowallet; Owner: -
--

CREATE SEQUENCE dinowallet.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: dinowallet; Owner: -
--

ALTER SEQUENCE dinowallet.users_id_seq OWNED BY dinowallet.users.id;


--
-- Name: variables; Type: TABLE; Schema: dinowallet; Owner: -
--

CREATE TABLE dinowallet.variables (
    id bigint NOT NULL,
    name character varying,
    value json
);


--
-- Name: variables_id_seq; Type: SEQUENCE; Schema: dinowallet; Owner: -
--

ALTER TABLE dinowallet.variables ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME dinowallet.variables_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: wallets; Type: TABLE; Schema: dinowallet; Owner: -
--

CREATE TABLE dinowallet.wallets (
    id bigint NOT NULL,
    owner_type dinowallet.owner_type_enum DEFAULT 'user'::dinowallet.owner_type_enum NOT NULL,
    owner_id bigint,
    asset_id bigint NOT NULL,
    balance_cached numeric(20,6) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: wallets_id_seq; Type: SEQUENCE; Schema: dinowallet; Owner: -
--

CREATE SEQUENCE dinowallet.wallets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: wallets_id_seq; Type: SEQUENCE OWNED BY; Schema: dinowallet; Owner: -
--

ALTER SEQUENCE dinowallet.wallets_id_seq OWNED BY dinowallet.wallets.id;


--
-- Name: assets id; Type: DEFAULT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.assets ALTER COLUMN id SET DEFAULT nextval('dinowallet.assets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.users ALTER COLUMN id SET DEFAULT nextval('dinowallet.users_id_seq'::regclass);


--
-- Name: wallets id; Type: DEFAULT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.wallets ALTER COLUMN id SET DEFAULT nextval('dinowallet.wallets_id_seq'::regclass);


--
-- Data for Name: assets; Type: TABLE DATA; Schema: dinowallet; Owner: -
--

INSERT INTO dinowallet.assets (id, name, precision_value, created_at) VALUES (1, 'credits', 0, '2026-02-20 22:04:44.184676');
INSERT INTO dinowallet.assets (id, name, precision_value, created_at) VALUES (2, 'rewards', 0, '2026-02-20 22:04:44.184676');
INSERT INTO dinowallet.assets (id, name, precision_value, created_at) VALUES (3, 'gems', 0, '2026-02-20 22:04:44.184676');


--
-- Data for Name: conversion; Type: TABLE DATA; Schema: dinowallet; Owner: -
--

INSERT INTO dinowallet.conversion (from_asset_id, to_asset_id, rate) VALUES (1, 2, 10.0000000000);
INSERT INTO dinowallet.conversion (from_asset_id, to_asset_id, rate) VALUES (1, 3, 1.0000000000);
INSERT INTO dinowallet.conversion (from_asset_id, to_asset_id, rate) VALUES (1, 1, 1.0000000000);


--
-- Data for Name: ledger; Type: TABLE DATA; Schema: dinowallet; Owner: -
--

INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('30d05c64-3855-4f6e-9443-c49ebc992e02', 1, 100.000000, 0.000000, '2026-02-21 14:54:08.074611', 'eb1f7874-02fd-4543-bd83-a35df8e51309');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('30d05c64-3855-4f6e-9443-c49ebc992e02', 11, 0.000000, 100.000000, '2026-02-21 14:54:08.074611', 'c0d304ee-7e9d-45e4-9fc7-242a8cbe5418');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('7cdbbb43-0c03-4c4b-a113-551aeba0afda', 1, 100.000000, 0.000000, '2026-02-21 15:33:47.987984', 'fdc150a7-601a-401a-a20d-4450406f2664');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('7cdbbb43-0c03-4c4b-a113-551aeba0afda', 12, 0.000000, 100.000000, '2026-02-21 15:33:47.987984', '8978aa42-737d-4348-bade-33fa54fdd89c');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('37f1f65c-9006-480c-9c99-d162a474c7af', 11, 100.000000, 0.000000, '2026-02-21 23:38:11.826235', '22b6fdbf-dcbb-4fa1-b105-fafd3c78096d');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('37f1f65c-9006-480c-9c99-d162a474c7af', 1, 0.000000, 100.000000, '2026-02-21 23:38:11.826235', 'c7ac8dd9-8d35-4214-96a0-d4b68ce04ca1');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('89bb943a-e2fc-4326-9610-965323d626cb', 12, 100.000000, 0.000000, '2026-02-21 23:51:28.061912', 'fafe46a5-1e29-44e1-b923-d3220b421ac0');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('89bb943a-e2fc-4326-9610-965323d626cb', 1, 0.000000, 100.000000, '2026-02-21 23:51:28.061912', 'c0a570e8-5e8f-4a6a-9d83-9a284b5fe8b0');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('7b739f4e-9e1e-47ab-a78d-88e7c4fa16f3', 1, 100.000000, 0.000000, '2026-02-22 02:16:31.373875', 'a22816bc-d0ea-40b7-a024-efb0eb966b46');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('7b739f4e-9e1e-47ab-a78d-88e7c4fa16f3', 12, 0.000000, 100.000000, '2026-02-22 02:16:31.373875', '58d97543-0cd9-4dca-bac1-bd90c69b6325');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('f3ff7c06-b870-463c-9d20-b67072d9bd1f', 12, 10.000000, 0.000000, '2026-02-22 02:18:15.916917', '07af3aaa-00ce-4417-9374-410960b772ca');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('f3ff7c06-b870-463c-9d20-b67072d9bd1f', 13, 0.000000, 100.000000, '2026-02-22 02:18:15.916917', 'cd33cc87-8c9c-4ad8-8a9f-32fb4b4906da');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('1746f714-e3a3-4504-bb57-0aa246d3ea7b', 1, 100.000000, 0.000000, '2026-02-22 02:28:32.990287', 'ade58cc2-39e5-484b-96c6-b7a3e59af457');
INSERT INTO dinowallet.ledger (order_id, wallet_id, debit_amount, credit_amount, created_at, id) VALUES ('1746f714-e3a3-4504-bb57-0aa246d3ea7b', 16, 0.000000, 100.000000, '2026-02-22 02:28:32.990287', 'ae9c0afe-0e31-4313-85c1-eeee731254bc');


--
-- Data for Name: orders; Type: TABLE DATA; Schema: dinowallet; Owner: -
--

INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('30d05c64-3855-4f6e-9443-c49ebc992e02', 20, 1, 'bonus', 100.000000, 'completed', '2026-02-21 14:54:08.074611', 0, '2026-02-21 16:59:31.496884+05:30', NULL, NULL);
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('7cdbbb43-0c03-4c4b-a113-551aeba0afda', 21, 1, 'bonus', 100.000000, 'completed', '2026-02-21 15:33:47.987984', 0, '2026-02-21 16:59:31.496884+05:30', NULL, NULL);
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('6c72063e-60bd-405e-8df7-0458d1a56639', 20, 1, 'spend', 100.000000, 'failed', '2026-02-21 21:52:55.192371', 0, '2026-02-21 22:02:55.192371+05:30', NULL, NULL);
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('da5ce56a-8ecd-43fd-b1f3-4762f1aff580', 20, 1, 'spend', 100.000000, 'failed', '2026-02-21 22:56:52.738415', 1, '2026-02-21 23:06:52.738415+05:30', NULL, NULL);
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('37f1f65c-9006-480c-9c99-d162a474c7af', 20, 1, 'spend', 100.000000, 'completed', '2026-02-21 23:37:47.684511', 1, '2026-02-21 23:47:47.684511+05:30', NULL, NULL);
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('b108f4c9-a870-4e42-9bf4-a0de601bad0b', 20, 1, 'spend', 100.000000, 'failed', '2026-02-21 23:38:39.359766', 1, '2026-02-21 23:48:39.359766+05:30', NULL, NULL);
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('95c7e7d1-e14d-46b4-8ca5-8739b7f4b02c', 20, 1, 'spend', 100.000000, 'failed', '2026-02-21 23:45:27.888249', 3, '2026-02-21 23:55:27.888249+05:30', NULL, NULL);
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('89bb943a-e2fc-4326-9610-965323d626cb', 21, 1, 'spend', 100.000000, 'completed', '2026-02-21 23:48:59.648241', 2, '2026-02-21 23:58:59.648241+05:30', 'Order not found or inaccessible', '2026-02-21 23:50:56.770863');
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('7b739f4e-9e1e-47ab-a78d-88e7c4fa16f3', 21, 1, 'topup', 100.000000, 'completed', '2026-02-22 02:16:31.373875', 0, '2026-02-22 02:26:31.373875+05:30', NULL, NULL);
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('f3ff7c06-b870-463c-9d20-b67072d9bd1f', 21, 1, 'spend', 10.000000, 'completed', '2026-02-22 02:18:15.916917', 0, '2026-02-22 02:28:15.916917+05:30', NULL, NULL);
INSERT INTO dinowallet.orders (id, user_id, asset_id, type, amount, status, created_at, attempts, expires_at, failed_reason, last_attempt_at) VALUES ('1746f714-e3a3-4504-bb57-0aa246d3ea7b', 26, 1, 'bonus', 100.000000, 'completed', '2026-02-22 02:28:32.990287', 0, '2026-02-22 02:38:32.990287+05:30', NULL, NULL);


--
-- Data for Name: users; Type: TABLE DATA; Schema: dinowallet; Owner: -
--

INSERT INTO dinowallet.users (id, username, password_hash, email, phone, created_at, updated_at, type) VALUES (1, 'chandra', '$2b$12$EyB8f/5F6/WZjRlDBVWt2elkVfvI49Q.IRR9./EtNyl2E.pLoalKO', 'ishupandey17@gmail.com', NULL, '2026-02-20 23:28:36.100445', '2026-02-20 23:28:36.100445', 'user');
INSERT INTO dinowallet.users (id, username, password_hash, email, phone, created_at, updated_at, type) VALUES (20, 'mahima', '$2b$12$TVkDXRhCYZCkkk7Gcxy2COO7SY8eoadQgigmXZ2/1/h9Ivq03Amgu', 'mahimaverma@gmail.com', NULL, '2026-02-21 14:54:08.074611', '2026-02-21 14:54:08.074611', 'user');
INSERT INTO dinowallet.users (id, username, password_hash, email, phone, created_at, updated_at, type) VALUES (21, 'surya', '$2b$12$SjqA3BM3g/uzZoGCEbzd1uFC/00x/Mu4nRG/CIb4ajkLnPHD4nQgW', 'surya@gmail.com', NULL, '2026-02-21 15:33:47.987984', '2026-02-21 15:33:47.987984', 'user');
INSERT INTO dinowallet.users (id, username, password_hash, email, phone, created_at, updated_at, type) VALUES (26, 'bhandari', '$2b$12$Cb/fmTs1jzBaNO6l51hmb.k6Hs/m55oZnhVBJf4tOwRQnJB237tMq', 'bhandari@gmail.com', NULL, '2026-02-22 02:28:32.990287', '2026-02-22 02:28:32.990287', 'user');


--
-- Data for Name: variables; Type: TABLE DATA; Schema: dinowallet; Owner: -
--

INSERT INTO dinowallet.variables (id, name, value) OVERRIDING SYSTEM VALUE VALUES (1, 'bonus', '{
	"value": 100
}');
INSERT INTO dinowallet.variables (id, name, value) OVERRIDING SYSTEM VALUE VALUES (2, 'owner_type', '{
  "system": "system",
  "user": "user"
}');


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: dinowallet; Owner: -
--

INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (2, 'system', NULL, 2, 0.000000, '2026-02-20 22:04:44.184676');
INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (3, 'system', NULL, 3, 0.000000, '2026-02-20 22:04:44.184676');
INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (11, 'user', 20, 1, 0.000000, '2026-02-21 14:54:08.074611');
INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (12, 'user', 21, 1, 90.000000, '2026-02-21 15:33:47.987984');
INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (13, 'user', 21, 2, 100.000000, '2026-02-22 02:18:15.916917');
INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (1, 'system', NULL, 1, -200.000000, '2026-02-20 22:04:44.184676');
INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (16, 'user', 26, 1, 100.000000, '2026-02-22 02:28:32.990287');


--
-- Name: assets_id_seq; Type: SEQUENCE SET; Schema: dinowallet; Owner: -
--

SELECT pg_catalog.setval('dinowallet.assets_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: dinowallet; Owner: -
--

SELECT pg_catalog.setval('dinowallet.users_id_seq', 26, true);


--
-- Name: variables_id_seq; Type: SEQUENCE SET; Schema: dinowallet; Owner: -
--

SELECT pg_catalog.setval('dinowallet.variables_id_seq', 2, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: dinowallet; Owner: -
--

SELECT pg_catalog.setval('dinowallet.wallets_id_seq', 16, true);


--
-- Name: assets assets_name_key; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.assets
    ADD CONSTRAINT assets_name_key UNIQUE (name);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: conversion conversion_pkey; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.conversion
    ADD CONSTRAINT conversion_pkey PRIMARY KEY (from_asset_id, to_asset_id);


--
-- Name: ledger ledger_pk; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.ledger
    ADD CONSTRAINT ledger_pk PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: wallets owner_asset_wallet_uniquekey; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.wallets
    ADD CONSTRAINT owner_asset_wallet_uniquekey UNIQUE (owner_id, asset_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: variables variables_pk; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.variables
    ADD CONSTRAINT variables_pk PRIMARY KEY (id);


--
-- Name: wallets wallets_owner_type_owner_id_asset_id_key; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.wallets
    ADD CONSTRAINT wallets_owner_type_owner_id_asset_id_key UNIQUE (owner_type, owner_id, asset_id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: idx_ledger_order; Type: INDEX; Schema: dinowallet; Owner: -
--

CREATE INDEX idx_ledger_order ON dinowallet.ledger USING btree (order_id);


--
-- Name: idx_ledger_wallet; Type: INDEX; Schema: dinowallet; Owner: -
--

CREATE INDEX idx_ledger_wallet ON dinowallet.ledger USING btree (wallet_id);


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: dinowallet; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON dinowallet.users FOR EACH ROW EXECUTE FUNCTION dinowallet.update_updated_at_column();


--
-- Name: conversion conversion_from_asset_id_fkey; Type: FK CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.conversion
    ADD CONSTRAINT conversion_from_asset_id_fkey FOREIGN KEY (from_asset_id) REFERENCES dinowallet.assets(id) ON DELETE CASCADE;


--
-- Name: conversion conversion_to_asset_id_fkey; Type: FK CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.conversion
    ADD CONSTRAINT conversion_to_asset_id_fkey FOREIGN KEY (to_asset_id) REFERENCES dinowallet.assets(id) ON DELETE CASCADE;


--
-- Name: ledger ledger_order_id_fkey; Type: FK CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.ledger
    ADD CONSTRAINT ledger_order_id_fkey FOREIGN KEY (order_id) REFERENCES dinowallet.orders(id) ON DELETE CASCADE;


--
-- Name: ledger ledger_wallet_id_fkey; Type: FK CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.ledger
    ADD CONSTRAINT ledger_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES dinowallet.wallets(id) ON DELETE CASCADE;


--
-- Name: orders orders_asset_id_fkey; Type: FK CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.orders
    ADD CONSTRAINT orders_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES dinowallet.assets(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES dinowallet.users(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_asset_id_fkey; Type: FK CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.wallets
    ADD CONSTRAINT wallets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES dinowallet.assets(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_owner_id_fkey; Type: FK CONSTRAINT; Schema: dinowallet; Owner: -
--

ALTER TABLE ONLY dinowallet.wallets
    ADD CONSTRAINT wallets_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES dinowallet.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

