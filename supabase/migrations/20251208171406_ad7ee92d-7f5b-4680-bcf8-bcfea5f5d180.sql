-- 1. Create missing "Lifestyle" core theme
INSERT INTO themes (name, icon, is_core, pack_id)
VALUES ('Lifestyle', '🏃', true, NULL);

-- 2. Link expansion themes to packs
-- Link Sports and Party to Gold pack
UPDATE themes SET pack_id = '9e4419e2-50f9-40d5-aa13-3ca331a7e166' WHERE name IN ('Sports', 'Party');

-- Link Magic and Horror to Premium pack  
UPDATE themes SET pack_id = '647e3dd4-48bb-4d91-9dbd-6f2feebc5ae3' WHERE name IN ('Magic', 'Horror');

-- Link Space to Base pack (as additional base theme)
UPDATE themes SET pack_id = '78abf071-9563-4acc-b84f-0e0f359d61b1' WHERE name = 'Space';