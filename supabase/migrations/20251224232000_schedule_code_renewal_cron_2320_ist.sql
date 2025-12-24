-- Schedule cron job to run at 11:20 PM IST (17:50 UTC)
-- IST is UTC+5:30, so 11:20 PM IST = 23:20 IST = 17:50 UTC

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule any existing job with this name (if exists)
DO $$ 
BEGIN
  PERFORM cron.unschedule('renew-expired-codes-daily-2320');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if job doesn't exist
END $$;

-- Schedule the cron job
-- Cron format: minute hour day month day-of-week
-- 50 17 * * * = 17:50 UTC every day = 11:20 PM IST every day
SELECT cron.schedule(
  'renew-expired-codes-daily-2320',
  '50 17 * * *', -- 17:50 UTC = 11:20 PM IST
  $$SELECT public.renew_expired_license_codes()$$
);

-- Verify the job was created
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  '11:20 PM IST' as schedule_ist,
  '17:50 UTC' as schedule_utc
FROM cron.job
WHERE jobname = 'renew-expired-codes-daily-2320';

