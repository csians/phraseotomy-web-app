-- Schedule cron job to run at 3:50 PM IST (10:20 UTC)
-- IST is UTC+5:30, so 3:50 PM IST = 15:50 IST = 10:20 UTC

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule any existing job with this name (if exists)
DO $$ 
BEGIN
  PERFORM cron.unschedule('renew-expired-codes-daily-1550');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if job doesn't exist
END $$;

-- Schedule the cron job
-- Cron format: minute hour day month day-of-week
-- 20 10 * * * = 10:20 UTC every day = 3:50 PM IST every day
SELECT cron.schedule(
  'renew-expired-codes-daily-1550',
  '20 10 * * *', -- 10:20 UTC = 3:50 PM IST
  $$SELECT public.renew_expired_license_codes()$$
);

-- Verify the job was created
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  '3:50 PM IST' as schedule_ist
FROM cron.job
WHERE jobname = 'renew-expired-codes-daily-1550';

