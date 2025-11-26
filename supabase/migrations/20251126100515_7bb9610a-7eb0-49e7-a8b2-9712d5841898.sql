-- Add secret_element column to game_turns table
ALTER TABLE game_turns
ADD COLUMN secret_element text;

-- Add comment explaining the field
COMMENT ON COLUMN game_turns.secret_element IS 'The secret element selected by storyteller. Can be either a UUID (element ID) or custom:{text} format for custom elements.';