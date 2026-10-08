-- Reconcile constraints introduced after the initial production hardening.
-- Safe to run on environments where some or all objects already exist.

ALTER TABLE table_visits
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE table_visits
SET expires_at = opened_at + interval '12 hours'
WHERE expires_at IS NULL;

ALTER TABLE table_visits
  ALTER COLUMN expires_at SET NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 hours');

CREATE INDEX IF NOT EXISTS table_visits_expires_idx
  ON table_visits (expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS table_visits_one_open_per_table_uq
  ON table_visits (restaurant_id, table_id)
  WHERE closed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_restaurant_request_key_uq
  ON orders (restaurant_id, request_key)
  WHERE request_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_stripe_subscription_uq
  ON restaurants (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_stripe_customer_uq
  ON restaurants (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
