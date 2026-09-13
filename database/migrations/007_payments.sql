-- =========================================================
-- 007_payments.sql
-- ParkSmart Payment Transaction Foundation
-- =========================================================

CREATE TABLE IF NOT EXISTS payments (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    booking_id UUID NOT NULL
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    -- Gateway/provider name.
    -- We will initially use Razorpay test mode.
    provider VARCHAR(30) NOT NULL
        DEFAULT 'razorpay',

    -- Created when ParkSmart asks the gateway
    -- to create a payment order.
    provider_order_id VARCHAR(120),

    -- Populated only after an actual payment attempt.
    provider_payment_id VARCHAR(120),

    amount NUMERIC(10,2) NOT NULL
        CHECK (
            amount >= 0
        ),

    currency VARCHAR(10) NOT NULL
        DEFAULT 'INR',

    status VARCHAR(30) NOT NULL
        DEFAULT 'created'
        CHECK (
            status IN (
                'created',
                'attempted',
                'authorized',
                'paid',
                'failed',
                'refunded',
                'partially_refunded'
            )
        ),

    payment_method VARCHAR(40),

    failure_reason TEXT,

    paid_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_payments_booking_id
    ON payments(booking_id);


CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments(status);


CREATE INDEX IF NOT EXISTS idx_payments_provider_order_id
    ON payments(provider_order_id);


CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id
    ON payments(provider_payment_id);


-- A gateway order ID must identify only one
-- ParkSmart payment transaction when present.

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_payments_provider_order_unique
ON payments(provider_order_id)
WHERE provider_order_id IS NOT NULL;


-- A gateway payment ID must never be applied
-- to multiple ParkSmart transactions.

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_payments_provider_payment_unique
ON payments(provider_payment_id)
WHERE provider_payment_id IS NOT NULL;


-- =========================================================
-- UPDATED_AT TRIGGER
-- Uses existing set_updated_at()
-- =========================================================

DROP TRIGGER IF EXISTS
    trg_payments_updated_at
ON payments;


CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE
ON payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
