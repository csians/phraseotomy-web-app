-- Change selected_elements from array to single text column
ALTER TABLE game_turns
ALTER COLUMN selected_elements TYPE text USING selected_elements[1];

-- Update default value
ALTER TABLE game_turns
ALTER COLUMN selected_elements SET DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN game_turns.selected_elements IS 'Selected elements for the turn. Can be UUID or custom:{text} format.';