-- Enable pg_cron extension for scheduled jobs (if available)
-- Note: pg_cron may not be available on all Supabase plans
-- Alternative: Use Supabase Dashboard > Database > Cron Jobs or external cron service

-- Create a PostgreSQL function that processes expired codes directly
-- This can be called by pg_cron or external cron services
CREATE OR REPLACE FUNCTION public.renew_expired_license_codes()
RETURNS TABLE(
  expired_code_id uuid,
  expired_code text,
  new_code_id uuid,
  new_code text,
  success boolean,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_record RECORD;
  new_code_id_val uuid;
BEGIN
  -- Find all expired codes that are still marked as 'active'
  -- IMPORTANT: Only process 'active' codes that have expired
  -- Do NOT process codes that are already 'expired' - they should stay expired
  FOR expired_record IN
    SELECT *
    FROM license_codes
    WHERE status = 'active' -- Only 'active' status codes
      AND expires_at IS NOT NULL
      AND expires_at < NOW() -- That have expired
  LOOP
    BEGIN
      -- IMPORTANT: Update old entry to 'expired' FIRST, then create new entry
      -- This ensures the unique constraint allows the new entry
      
      -- Double-check: Verify code is still 'active' before processing
      -- This prevents processing codes that were already set to 'expired'
      IF expired_record.status != 'active' THEN
        -- Skip if already expired or not active
        CONTINUE;
      END IF;
      
      -- Step 1: Update old entry status to 'expired' (keep it as historical record, unchanged otherwise)
      UPDATE license_codes
      SET status = 'expired'
      WHERE id = expired_record.id
        AND status = 'active'; -- Extra safety: only update if still 'active'
      
      -- Verify update succeeded (if no rows updated, skip)
      IF NOT FOUND THEN
        CONTINUE;
      END IF;
      
      -- Step 2: Create NEW entry with same code value, same packs, but unused status
      -- Old entry is now 'expired', so unique constraint allows this new entry
      -- This creates a completely NEW row with a NEW ID
      INSERT INTO license_codes (
        tenant_id,
        code,
        packs_unlocked,
        status,
        previous_code_id,
        redeemed_by,
        redeemed_at,
        expires_at
      ) VALUES (
        expired_record.tenant_id,
        expired_record.code, -- Same code value
        expired_record.packs_unlocked, -- Same packs
        'unused', -- New entry is unused
        expired_record.id, -- Link to old entry
        NULL, -- New entry has no redemption data
        NULL, -- New entry has no redemption data
        NULL -- New entry has no expiration
      )
      RETURNING id INTO new_code_id_val;
      
      -- Verify new entry has different ID (safety check)
      IF new_code_id_val = expired_record.id THEN
        RAISE EXCEPTION 'New entry has same ID as old entry - INSERT failed';
      END IF;
      
      -- Return success result
      RETURN QUERY SELECT 
        expired_record.id,
        expired_record.code,
        new_code_id_val,
        expired_record.code, -- Same code value
        true,
        NULL::text;
        
    EXCEPTION WHEN OTHERS THEN
      -- Return error result
      RETURN QUERY SELECT 
        expired_record.id,
        expired_record.code,
        NULL::uuid,
        NULL::text,
        false,
        SQLERRM;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- Grant execute permission to authenticated users (or service role)
GRANT EXECUTE ON FUNCTION public.renew_expired_license_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_expired_license_codes() TO service_role;

-- Comment explaining the function
COMMENT ON FUNCTION public.renew_expired_license_codes() IS 
  'Processes expired license codes and creates new unused codes with the same pack details. Returns a table of results. Can be called by pg_cron or external cron services.';

-- Example: To schedule with pg_cron (if available), run:
-- SELECT cron.schedule('renew-expired-codes', '0 * * * *', $$SELECT public.renew_expired_license_codes()$$);
--
-- Alternative: Use Supabase Dashboard > Database > Cron Jobs
-- Or set up external cron service (e.g., GitHub Actions, cron-job.org) to call:
-- POST https://your-project.supabase.co/functions/v1/renew-expired-codes

