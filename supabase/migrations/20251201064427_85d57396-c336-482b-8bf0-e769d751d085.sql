-- Delete all data except tenants table
-- Order matters due to foreign key constraints

-- Game-related tables (delete children first)
DELETE FROM game_guesses;
DELETE FROM game_turns;
DELETE FROM game_audio;
DELETE FROM game_rounds;
DELETE FROM game_players;
DELETE FROM game_sessions;

-- Customer-related tables
DELETE FROM customer_audio;
DELETE FROM customer_licenses;
DELETE FROM customers;

-- License-related tables
DELETE FROM license_code_packs;
DELETE FROM license_codes;

-- Theme and element tables
DELETE FROM elements;
DELETE FROM themes;

-- Pack table
DELETE FROM packs;

-- User roles
DELETE FROM user_roles;