-- Allow turn_mode to be NULL so storyteller must choose mode each round
ALTER TABLE game_turns ALTER COLUMN turn_mode DROP NOT NULL;
ALTER TABLE game_turns ALTER COLUMN turn_mode DROP DEFAULT;