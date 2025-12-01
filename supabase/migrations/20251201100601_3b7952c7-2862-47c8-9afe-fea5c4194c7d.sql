-- Insert default themes
INSERT INTO themes (name, icon) VALUES
('Work', 'briefcase'),
('Home', 'home'),
('Travel', 'plane'),
('Sports', 'bike'),
('Party', 'wine'),
('Space', 'rocket'),
('Horror', 'skull'),
('Magic', 'sparkles');

-- Get theme IDs for inserting elements
DO $$
DECLARE
    work_id uuid;
    home_id uuid;
    travel_id uuid;
    sports_id uuid;
    party_id uuid;
    space_id uuid;
    horror_id uuid;
    magic_id uuid;
BEGIN
    SELECT id INTO work_id FROM themes WHERE name = 'Work';
    SELECT id INTO home_id FROM themes WHERE name = 'Home';
    SELECT id INTO travel_id FROM themes WHERE name = 'Travel';
    SELECT id INTO sports_id FROM themes WHERE name = 'Sports';
    SELECT id INTO party_id FROM themes WHERE name = 'Party';
    SELECT id INTO space_id FROM themes WHERE name = 'Space';
    SELECT id INTO horror_id FROM themes WHERE name = 'Horror';
    SELECT id INTO magic_id FROM themes WHERE name = 'Magic';

    -- Work elements
    INSERT INTO elements (name, icon, theme_id) VALUES
    ('Meeting', 'users', work_id),
    ('Deadline', 'clock', work_id),
    ('Boss', 'crown', work_id),
    ('Coffee', 'coffee', work_id),
    ('Email', 'mail', work_id),
    ('Promotion', 'trending-up', work_id);

    -- Home elements
    INSERT INTO elements (name, icon, theme_id) VALUES
    ('Kitchen', 'utensils', home_id),
    ('Garden', 'flower', home_id),
    ('Pet', 'dog', home_id),
    ('Couch', 'sofa', home_id),
    ('TV', 'tv', home_id),
    ('Neighbor', 'user', home_id);

    -- Travel elements
    INSERT INTO elements (name, icon, theme_id) VALUES
    ('Airport', 'plane-landing', travel_id),
    ('Hotel', 'building', travel_id),
    ('Beach', 'sun', travel_id),
    ('Map', 'map', travel_id),
    ('Suitcase', 'briefcase', travel_id),
    ('Passport', 'book', travel_id);

    -- Sports elements
    INSERT INTO elements (name, icon, theme_id) VALUES
    ('Ball', 'circle', sports_id),
    ('Trophy', 'trophy', sports_id),
    ('Coach', 'whistle', sports_id),
    ('Team', 'users', sports_id),
    ('Stadium', 'building-2', sports_id),
    ('Medal', 'award', sports_id);

    -- Party elements
    INSERT INTO elements (name, icon, theme_id) VALUES
    ('Dance', 'music', party_id),
    ('Cake', 'cake', party_id),
    ('Gift', 'gift', party_id),
    ('Balloon', 'circle', party_id),
    ('DJ', 'headphones', party_id),
    ('Confetti', 'sparkles', party_id);

    -- Space elements
    INSERT INTO elements (name, icon, theme_id) VALUES
    ('Alien', 'user', space_id),
    ('Rocket', 'rocket', space_id),
    ('Planet', 'globe', space_id),
    ('Star', 'star', space_id),
    ('Astronaut', 'user', space_id),
    ('Moon', 'moon', space_id);

    -- Horror elements
    INSERT INTO elements (name, icon, theme_id) VALUES
    ('Ghost', 'ghost', horror_id),
    ('Zombie', 'skull', horror_id),
    ('Vampire', 'moon', horror_id),
    ('Haunted House', 'home', horror_id),
    ('Scream', 'volume-2', horror_id),
    ('Blood', 'droplet', horror_id);

    -- Magic elements
    INSERT INTO elements (name, icon, theme_id) VALUES
    ('Wizard', 'wand', magic_id),
    ('Potion', 'flask', magic_id),
    ('Dragon', 'flame', magic_id),
    ('Spell', 'sparkles', magic_id),
    ('Crystal', 'gem', magic_id),
    ('Fairy', 'star', magic_id);
END $$;