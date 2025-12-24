-- Schedule cron job to run at 4:03 PM IST (10:33 UTC)
-- IST is UTC+5:30, so 4:03 PM IST = 16:03 IST = 10:33 UTC

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule any existing job with this name (if exists)
DO $$ 
BEGIN
  PERFORM cron.unschedule('renew-expired-codes-daily-1603');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if job doesn't exist
END $$;

-- Schedule the cron job
-- Cron format: minute hour day month day-of-week
-- 33 10 * * * = 10:33 UTC every day = 4:03 PM IST every day
SELECT cron.schedule(
  'renew-expired-codes-daily-1603',
  '33 10 * * *', -- 10:33 UTC = 4:03 PM IST
  $$SELECT public.renew_expired_license_codes()$$
);

-- Verify the job was created
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  '4:03 PM IST' as schedule_ist,
  '10:33 UTC' as schedule_utc
FROM cron.job
WHERE jobname = 'renew-expired-codes-daily-1603';

