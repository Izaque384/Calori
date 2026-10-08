-- Calori production hardening
-- Mirrors the changes already applied to the production Neon database.

CREATE TABLE IF NOT EXISTS table_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS table_visits_restaurant_idx
  ON table_visits (restaurant_id);

CREATE INDEX IF NOT EXISTS table_visits_table_idx
  ON table_visits (table_id);

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

ALTER TABLE table_sessions
  ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES table_visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS table_sessions_visit_idx
  ON table_sessions (visit_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES table_visits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_key text;

CREATE INDEX IF NOT EXISTS orders_visit_idx
  ON orders (visit_id);

CREATE UNIQUE INDEX IF NOT EXISTS orders_restaurant_request_key_uq
  ON orders (restaurant_id, request_key)
  WHERE request_key IS NOT NULL;

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES table_visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_requests_visit_idx
  ON service_requests (visit_id);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_expires_idx
  ON api_rate_limits (expires_at);

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_stripe_subscription_uq
  ON restaurants (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_stripe_customer_uq
  ON restaurants (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION create_calori_order(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_visit_id uuid,
  p_session_id uuid,
  p_request_key text,
  p_subtotal numeric,
  p_total numeric,
  p_note text,
  p_items jsonb
)
RETURNS TABLE(order_id uuid, order_number integer, reused boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_id uuid;
  v_existing_number integer;
  v_order_id uuid;
  v_number integer;
  v_item jsonb;
  v_option jsonb;
  v_item_id uuid;
BEGIN
  IF p_request_key IS NULL OR length(trim(p_request_key)) < 8 THEN
    RAISE EXCEPTION 'request_key inválida';
  END IF;

  SELECT o.id, o.number
    INTO v_existing_id, v_existing_number
  FROM orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.request_key = p_request_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_id, v_existing_number, true;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text, 0));

  SELECT o.id, o.number
    INTO v_existing_id, v_existing_number
  FROM orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.request_key = p_request_key
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_id, v_existing_number, true;
    RETURN;
  END IF;

  SELECT COALESCE(MAX(o.number), 0) + 1
    INTO v_number
  FROM orders o
  WHERE o.restaurant_id = p_restaurant_id;

  INSERT INTO orders (
    restaurant_id,
    table_id,
    visit_id,
    session_id,
    request_key,
    number,
    status,
    subtotal,
    total,
    note
  )
  VALUES (
    p_restaurant_id,
    p_table_id,
    p_visit_id,
    p_session_id,
    p_request_key,
    v_number,
    'new',
    p_subtotal,
    p_total,
    p_note
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := gen_random_uuid();

    INSERT INTO order_items (
      id,
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      subtotal,
      note
    )
    VALUES (
      v_item_id,
      v_order_id,
      NULLIF(v_item->>'productId', '')::uuid,
      v_item->>'productName',
      (v_item->>'quantity')::integer,
      (v_item->>'unitPrice')::numeric,
      (v_item->>'subtotal')::numeric,
      NULLIF(v_item->>'note', '')
    );

    FOR v_option IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_item->'selectedOptions', '[]'::jsonb))
    LOOP
      INSERT INTO order_item_options (
        order_item_id,
        option_id,
        name,
        price
      )
      VALUES (
        v_item_id,
        NULLIF(v_option->>'id', '')::uuid,
        v_option->>'name',
        (v_option->>'price')::numeric
      );
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_number, false;
END;
$$;


CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);


CREATE UNIQUE INDEX IF NOT EXISTS restaurant_members_one_restaurant_per_user_uq
  ON restaurant_members (user_id);


DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_price_nonnegative_ck') THEN
    ALTER TABLE products ADD CONSTRAINT products_price_nonnegative_ck CHECK (price >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='options_price_nonnegative_ck') THEN
    ALTER TABLE options ADD CONSTRAINT options_price_nonnegative_ck CHECK (additional_price >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='option_groups_selection_bounds_ck') THEN
    ALTER TABLE option_groups ADD CONSTRAINT option_groups_selection_bounds_ck
      CHECK (min_selections >= 0 AND max_selections >= 1 AND min_selections <= max_selections);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='order_items_values_ck') THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_values_ck
      CHECK (quantity >= 1 AND unit_price >= 0 AND subtotal >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_totals_nonnegative_ck') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_totals_nonnegative_ck
      CHECK (subtotal >= 0 AND total >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='order_item_options_price_nonnegative_ck') THEN
    ALTER TABLE order_item_options ADD CONSTRAINT order_item_options_price_nonnegative_ck
      CHECK (price >= 0);
  END IF;
END $$;
