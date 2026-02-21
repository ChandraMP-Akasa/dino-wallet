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

DROP SCHEMA IF EXISTS dinowallet;
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

INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (1, 'system', NULL, 1, 0.000000, '2026-02-20 22:04:44.184676');
INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (2, 'system', NULL, 2, 0.000000, '2026-02-20 22:04:44.184676');
INSERT INTO dinowallet.wallets (id, owner_type, owner_id, asset_id, balance_cached, created_at) VALUES (3, 'system', NULL, 3, 0.000000, '2026-02-20 22:04:44.184676');


--
-- Name: assets_id_seq; Type: SEQUENCE SET; Schema: dinowallet; Owner: -
--

SELECT pg_catalog.setval('dinowallet.assets_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: dinowallet; Owner: -
--

SELECT pg_catalog.setval('dinowallet.users_id_seq', 21, true);


--
-- Name: variables_id_seq; Type: SEQUENCE SET; Schema: dinowallet; Owner: -
--

SELECT pg_catalog.setval('dinowallet.variables_id_seq', 2, true);


--
-- Name: wallets_id_seq; Type: SEQUENCE SET; Schema: dinowallet; Owner: -
--

SELECT pg_catalog.setval('dinowallet.wallets_id_seq', 12, true);


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

