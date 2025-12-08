-- Mark the 4 base themes as core themes
UPDATE themes SET is_core = true WHERE name IN ('Home', 'Work', 'Travel', 'Lifestyle');

-- If Lifestyle doesn't exist, we might need to check for similar names
UPDATE themes SET is_core = true WHERE name ILIKE '%home%' OR name ILIKE '%work%' OR name ILIKE '%travel%' OR name ILIKE '%lifestyle%';