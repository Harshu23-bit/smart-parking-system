-- =========================================================
-- 008_payment_webhook_events.sql
-- Razorpay Webhook Idempotency
-- =========================================================

CREATE TABLE IF NOT EXISTS payment_webhook_events (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    provider VARCHAR(30) NOT NULL
        DEFAULT 'razorpay',

    provider_event_id VARCHAR(150) NOT NULL,

    event_type VARCHAR(80) NOT NULL,

    provider_order_id VARCHAR(120),

    provider_payment_id VARCHAR(120),

    processed BOOLEAN NOT NULL
        DEFAULT FALSE,

    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    UNIQUE (
        provider,
        provider_event_id
    )
);


CREATE INDEX IF NOT EXISTS
    idx_payment_webhook_events_type
ON payment_webhook_events(event_type);


CREATE INDEX IF NOT EXISTS
    idx_payment_webhook_events_order
ON payment_webhook_events(provider_order_id);


CREATE INDEX IF NOT EXISTS
    idx_payment_webhook_events_payment
ON payment_webhook_events(provider_payment_id);
