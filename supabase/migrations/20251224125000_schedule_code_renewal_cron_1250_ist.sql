-- Schedule cron job to run at 12:50 PM IST (07:20 UTC) for testing
-- IST is UTC+5:30, so 12:50 PM IST = 07:20 UTC

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cron job to run daily at 12:50 PM IST (07:20 UTC)
-- Cron format: minute hour day month day-of-week
-- 20 7 * * * means: At 07:20 UTC (12:50 PM IST) every day
SELECT cron.schedule(
  'renew-expired-codes-daily',
  '20 7 * * *', -- 07:20 UTC = 12:50 PM IST
  $$SELECT public.renew_expired_license_codes()$$
);

-- Comment explaining the schedule
COMMENT ON EXTENSION pg_cron IS 'Scheduled to run code renewal at 12:50 PM IST (07:20 UTC) daily';

