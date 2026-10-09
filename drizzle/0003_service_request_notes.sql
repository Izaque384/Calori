-- Optional context written by the guest when requesting service.
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS note text;
