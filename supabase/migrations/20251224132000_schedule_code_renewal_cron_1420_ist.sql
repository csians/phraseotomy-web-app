-- Schedule additional cron job to run at 2:40 PM IST (09:10 UTC) for testing
-- IST is UTC+5:30, so 2:40 PM IST = 09:10 UTC

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cron job to run daily at 2:40 PM IST (09:10 UTC)
-- Cron format: minute hour day month day-of-week
-- 10 9 * * * means: At 09:10 UTC (2:40 PM IST) every day
SELECT cron.schedule(
  'renew-expired-codes-daily-1440',
  '10 9 * * *', -- 09:10 UTC = 2:40 PM IST
  $$SELECT public.renew_expired_license_codes()$$
);

-- Comment explaining the schedule
COMMENT ON EXTENSION pg_cron IS 'Additional scheduled job: code renewal at 2:40 PM IST (09:10 UTC) daily';

