-- Schedule additional cron job to run at 3:25 PM IST (09:55 UTC) for testing
-- IST is UTC+5:30, so 3:25 PM IST = 09:55 UTC

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cron job to run daily at 3:25 PM IST (09:55 UTC)
-- Cron format: minute hour day month day-of-week
-- 55 9 * * * means: At 09:55 UTC (3:25 PM IST) every day
SELECT cron.schedule(
  'renew-expired-codes-daily-1525',
  '55 9 * * *', -- 09:55 UTC = 3:25 PM IST
  $$SELECT public.renew_expired_license_codes()$$
);

-- Comment explaining the schedule
COMMENT ON EXTENSION pg_cron IS 'Additional scheduled job: code renewal at 3:25 PM IST (09:55 UTC) daily';

