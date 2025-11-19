-- Fix RLS policy on game_sessions to prevent unauthorized updates
-- The current policy has USING condition set to 'true' which allows any authenticated user
-- to update any game session. This is a critical security vulnerability.

DROP POLICY IF EXISTS "Hosts can update their own sessions" ON game_sessions;

CREATE POLICY "Hosts can update their own sessions"
  ON game_sessions
  FOR UPDATE
  USING (host_customer_id = (auth.uid())::text);