-- Fix guessed_elements column to accept text instead of uuid
ALTER TABLE game_guesses 
ALTER COLUMN guessed_elements TYPE text[] 
USING guessed_elements::text[];