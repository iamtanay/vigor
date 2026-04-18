-- ─────────────────────────────────────────────────────────────────────────────
-- Vigor Seed Data
-- Run AFTER schema migrations
-- Creates: 3 venues, 3 users, token bundles, venue slots
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed using service_role to bypass RLS
-- In Supabase Dashboard > SQL Editor, run as service_role

-- ─── Create auth users first (mimics Supabase Auth) ──────────────────────────

-- NOTE: In development, create these via Supabase Auth Dashboard or via
-- `supabase auth add-user`. The UUIDs below must match the auth.users you create.
-- Swap these UUIDs for real ones from your Supabase project.

DO $$
DECLARE
  admin_auth_id  UUID := '00000000-0000-0000-0000-000000000001';
  owner1_auth_id UUID := '00000000-0000-0000-0000-000000000002';
  owner2_auth_id UUID := '00000000-0000-0000-0000-000000000003';
  owner3_auth_id UUID := '00000000-0000-0000-0000-000000000004';
  user1_auth_id  UUID := '00000000-0000-0000-0000-000000000005';
  user2_auth_id  UUID := '00000000-0000-0000-0000-000000000006';
  user3_auth_id  UUID := '00000000-0000-0000-0000-000000000007';

  admin_id  UUID;
  owner1_id UUID;
  owner2_id UUID;
  owner3_id UUID;
  user1_id  UUID;
  user2_id  UUID;
  user3_id  UUID;
  venue1_id UUID;
  venue2_id UUID;
  venue3_id UUID;
  bundle_small_id  UUID;
  bundle_medium_id UUID;
  bundle_large_id  UUID;

  d DATE;
  h INTEGER;
BEGIN

-- ─── Seed auth.users (required to satisfy foreign key on users.auth_id) ──────

INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
VALUES
  (admin_auth_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@joinvigor.co',           crypt('Password123!', gen_salt('bf')),
   NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   FALSE, '', '', '', ''),
  (owner1_auth_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'owner@ironrepublic.in',        crypt('Password123!', gen_salt('bf')),
   NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   FALSE, '', '', '', ''),
  (owner2_auth_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'owner@centurionfitness.in',    crypt('Password123!', gen_salt('bf')),
   NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   FALSE, '', '', '', ''),
  (owner3_auth_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'owner@fitzone.in',             crypt('Password123!', gen_salt('bf')),
   NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   FALSE, '', '', '', ''),
  (user1_auth_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user1@joinvigor.co',           crypt('Password123!', gen_salt('bf')),
   NOW(), NOW(), NOW(), '{"provider":"phone","providers":["phone"]}'::jsonb, '{}'::jsonb,
   FALSE, '', '', '', ''),
  (user2_auth_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user2@joinvigor.co',           crypt('Password123!', gen_salt('bf')),
   NOW(), NOW(), NOW(), '{"provider":"phone","providers":["phone"]}'::jsonb, '{}'::jsonb,
   FALSE, '', '', '', ''),
  (user3_auth_id,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user3@joinvigor.co',           crypt('Password123!', gen_salt('bf')),
   NOW(), NOW(), NOW(), '{"provider":"phone","providers":["phone"]}'::jsonb, '{}'::jsonb,
   FALSE, '', '', '', '');

-- Also seed auth.identities so Supabase Auth recognises these accounts
INSERT INTO auth.identities (
  id, user_id, provider_id, provider,
  identity_data, last_sign_in_at, created_at, updated_at
)
VALUES
  (gen_random_uuid(), admin_auth_id,  'admin@joinvigor.co',        'email',
   json_build_object('sub', admin_auth_id::text,  'email', 'admin@joinvigor.co')::jsonb,        NOW(), NOW(), NOW()),
  (gen_random_uuid(), owner1_auth_id, 'owner@ironrepublic.in',     'email',
   json_build_object('sub', owner1_auth_id::text, 'email', 'owner@ironrepublic.in')::jsonb,     NOW(), NOW(), NOW()),
  (gen_random_uuid(), owner2_auth_id, 'owner@centurionfitness.in', 'email',
   json_build_object('sub', owner2_auth_id::text, 'email', 'owner@centurionfitness.in')::jsonb, NOW(), NOW(), NOW()),
  (gen_random_uuid(), owner3_auth_id, 'owner@fitzone.in',          'email',
   json_build_object('sub', owner3_auth_id::text, 'email', 'owner@fitzone.in')::jsonb,          NOW(), NOW(), NOW()),
  (gen_random_uuid(), user1_auth_id,  '+919876543210',              'phone',
   json_build_object('sub', user1_auth_id::text,  'phone', '+919876543210')::jsonb,              NOW(), NOW(), NOW()),
  (gen_random_uuid(), user2_auth_id,  '+919876543211',              'phone',
   json_build_object('sub', user2_auth_id::text,  'phone', '+919876543211')::jsonb,              NOW(), NOW(), NOW()),
  (gen_random_uuid(), user3_auth_id,  '+919876543212',              'phone',
   json_build_object('sub', user3_auth_id::text,  'phone', '+919876543212')::jsonb,              NOW(), NOW(), NOW());

-- ─── Users ───────────────────────────────────────────────────────────────────

INSERT INTO users (auth_id, phone, email, name, role)
VALUES (admin_auth_id, NULL, 'admin@joinvigor.co', 'Vigor Admin', 'admin')
RETURNING id INTO admin_id;

INSERT INTO users (auth_id, phone, email, name, role)
VALUES (owner1_auth_id, NULL, 'owner@ironrepublic.in', 'Raj Malhotra', 'gym_owner')
RETURNING id INTO owner1_id;

INSERT INTO users (auth_id, phone, email, name, role)
VALUES (owner2_auth_id, NULL, 'owner@centurionfitness.in', 'Priya Singh', 'gym_owner')
RETURNING id INTO owner2_id;

INSERT INTO users (auth_id, phone, email, name, role)
VALUES (owner3_auth_id, NULL, 'owner@fitzone.in', 'Arun Desai', 'gym_owner')
RETURNING id INTO owner3_id;

INSERT INTO users (auth_id, phone, email, name, role)
VALUES (user1_auth_id, '+919876543210', NULL, 'Ananya Sharma', 'user')
RETURNING id INTO user1_id;

INSERT INTO users (auth_id, phone, email, name, role)
VALUES (user2_auth_id, '+919876543211', NULL, 'Karan Mehta', 'user')
RETURNING id INTO user2_id;

INSERT INTO users (auth_id, phone, email, name, role)
VALUES (user3_auth_id, '+919876543212', NULL, 'Sneha Iyer', 'user')
RETURNING id INTO user3_id;

-- ─── Venues ──────────────────────────────────────────────────────────────────

INSERT INTO venues (
  owner_user_id, name, tier, status, description,
  address, city, state, pincode, latitude, longitude,
  phone, opening_time, closing_time,
  amenities, activity_types, image_urls, payout_rate_inr
) VALUES (
  owner1_id, 'Iron Republic', 'gold', 'active',
  'Premium strength training facility with Olympic lifting platforms, sauna, and certified coaches.',
  '14, Palasia Square, Near Treasure Island Mall',
  'Indore', 'Madhya Pradesh', '452001',
  22.7196, 75.8577,
  '+917314001234', '05:30', '23:00',
  ARRAY['AC', 'lockers', 'sauna', 'parking', 'showers', 'certified_trainers', 'protein_bar'],
  ARRAY['weights', 'strength', 'powerlifting', 'crossfit'],
  ARRAY['https://placehold.co/400x300/1A1A2E/6C63FF?text=Iron+Republic'],
  1200
) RETURNING id INTO venue1_id;

INSERT INTO venues (
  owner_user_id, name, tier, status, description,
  address, city, state, pincode, latitude, longitude,
  phone, opening_time, closing_time,
  amenities, activity_types, image_urls, payout_rate_inr
) VALUES (
  owner2_id, 'Centurion Fitness', 'silver', 'active',
  'Well-equipped gym with cardio machines, free weights, and group fitness classes.',
  '7, Scheme 54, Near Vijay Nagar Square',
  'Indore', 'Madhya Pradesh', '452010',
  22.7534, 75.8937,
  '+917314002345', '06:00', '22:00',
  ARRAY['AC', 'lockers', 'parking', 'showers', 'group_classes'],
  ARRAY['weights', 'cardio', 'zumba', 'yoga', 'functional'],
  ARRAY['https://placehold.co/400x300/1A1A2E/39D98A?text=Centurion+Fitness'],
  900
) RETURNING id INTO venue2_id;

INSERT INTO venues (
  owner_user_id, name, tier, status, description,
  address, city, state, pincode, latitude, longitude,
  phone, opening_time, closing_time,
  amenities, activity_types, image_urls, payout_rate_inr
) VALUES (
  owner3_id, 'Fit Zone', 'bronze', 'active',
  'No-frills gym with all the essentials. Great value for daily workouts.',
  '23, MG Road, Near Clock Tower',
  'Indore', 'Madhya Pradesh', '452007',
  22.7222, 75.8824,
  '+917314003456', '06:00', '21:00',
  ARRAY['fans', 'basic_lockers', 'changing_room'],
  ARRAY['weights', 'cardio'],
  ARRAY['https://placehold.co/400x300/1A1A2E/FFD166?text=Fit+Zone'],
  600
) RETURNING id INTO venue3_id;

-- ─── Token Bundles ────────────────────────────────────────────────────────────

INSERT INTO token_bundles (name, size, token_count, price_inr, validity_days, is_active, sort_order)
VALUES
  ('Starter Pack', 'small',  20,  36000, 30, TRUE, 1),
  ('Regular Pack', 'medium', 50,  75000, 60, TRUE, 2),
  ('Pro Pack',     'large',  120, 156000, 90, TRUE, 3);

SELECT id INTO bundle_small_id  FROM token_bundles WHERE size = 'small'  LIMIT 1;
SELECT id INTO bundle_medium_id FROM token_bundles WHERE size = 'medium' LIMIT 1;
SELECT id INTO bundle_large_id  FROM token_bundles WHERE size = 'large'  LIMIT 1;

-- ─── Seed token balances for test users ──────────────────────────────────────

-- User 1: 148 tokens
INSERT INTO token_ledger (user_id, bundle_id, type, amount, balance_after, expires_at)
VALUES (user1_id, bundle_medium_id, 'purchase', 50, 50, NOW() + INTERVAL '60 days');

INSERT INTO token_ledger (user_id, bundle_id, type, amount, balance_after, expires_at)
VALUES (user1_id, bundle_large_id, 'purchase', 120, 170, NOW() + INTERVAL '90 days');

INSERT INTO token_ledger (user_id, type, amount, balance_after)
VALUES (user1_id, 'deduction', -22, 148);

-- User 2: 85 tokens
INSERT INTO token_ledger (user_id, bundle_id, type, amount, balance_after, expires_at)
VALUES (user2_id, bundle_medium_id, 'purchase', 50, 50, NOW() + INTERVAL '45 days');

INSERT INTO token_ledger (user_id, bundle_id, type, amount, balance_after, expires_at)
VALUES (user2_id, bundle_small_id, 'purchase', 20, 70, NOW() + INTERVAL '25 days');

INSERT INTO token_ledger (user_id, type, amount, balance_after)
VALUES (user2_id, 'deduction', -15, 55);

INSERT INTO token_ledger (user_id, type, amount, balance_after)
VALUES (user2_id, 'purchase', 30, 85);

-- User 3: 32 tokens (expiring soon)
INSERT INTO token_ledger (user_id, bundle_id, type, amount, balance_after, expires_at)
VALUES (user3_id, bundle_small_id, 'purchase', 20, 20, NOW() + INTERVAL '6 days');

INSERT INTO token_ledger (user_id, bundle_id, type, amount, balance_after, expires_at)
VALUES (user3_id, bundle_small_id, 'purchase', 20, 40, NOW() + INTERVAL '25 days');

INSERT INTO token_ledger (user_id, type, amount, balance_after)
VALUES (user3_id, 'deduction', -8, 32);

-- ─── Venue slots (next 7 days for all 3 venues) ───────────────────────────────

-- Iron Republic: 5 AM – 10 PM (hours 5–22)
FOR d IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + 6, '1 day')::DATE LOOP
  FOR h IN 5..22 LOOP
    INSERT INTO venue_slots (venue_id, slot_date, start_time, end_time, capacity)
    VALUES (
      venue1_id, d,
      (lpad(h::TEXT, 2, '0') || ':00')::TIME,
      (lpad((h + 1)::TEXT, 2, '0') || ':00')::TIME,
      CASE
        WHEN h BETWEEN 7 AND 9   THEN 15
        WHEN h BETWEEN 17 AND 20 THEN 15
        ELSE 25
      END
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END LOOP;

-- Centurion Fitness: 6 AM – 9 PM (hours 6–21)
FOR d IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + 6, '1 day')::DATE LOOP
  FOR h IN 6..21 LOOP
    INSERT INTO venue_slots (venue_id, slot_date, start_time, end_time, capacity)
    VALUES (
      venue2_id, d,
      (lpad(h::TEXT, 2, '0') || ':00')::TIME,
      (lpad((h + 1)::TEXT, 2, '0') || ':00')::TIME,
      20
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END LOOP;

-- Fit Zone: 6 AM – 8 PM (hours 6–20)
FOR d IN SELECT generate_series(CURRENT_DATE, CURRENT_DATE + 6, '1 day')::DATE LOOP
  FOR h IN 6..20 LOOP
    INSERT INTO venue_slots (venue_id, slot_date, start_time, end_time, capacity)
    VALUES (
      venue3_id, d,
      (lpad(h::TEXT, 2, '0') || ':00')::TIME,
      (lpad((h + 1)::TEXT, 2, '0') || ':00')::TIME,
      15
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END LOOP;

RAISE NOTICE 'Seed complete.';
RAISE NOTICE 'Venue 1 (Gold - Iron Republic): %', venue1_id;
RAISE NOTICE 'Venue 2 (Silver - Centurion): %', venue2_id;
RAISE NOTICE 'Venue 3 (Bronze - Fit Zone): %', venue3_id;
RAISE NOTICE 'User 1 (148 tokens): %', user1_id;
RAISE NOTICE 'User 2 (85 tokens): %', user2_id;
RAISE NOTICE 'User 3 (32 tokens, expiring): %', user3_id;

END $$;