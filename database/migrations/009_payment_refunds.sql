-- =========================================================
-- Migration 009
-- Payment Refund Tracking
-- =========================================================


-- =========================================================
-- ADD REFUND_PENDING TO PAYMENTS
-- =========================================================

ALTER TABLE payments
DROP CONSTRAINT IF EXISTS
    payments_status_check;


ALTER TABLE payments
ADD CONSTRAINT payments_status_check
CHECK (
    status IN (
        'created',
        'attempted',
        'authorized',
        'paid',
        'refund_pending',
        'failed',
        'refunded',
        'partially_refunded'
    )
);


-- =========================================================
-- ADD REFUND_PENDING TO BOOKING PAYMENT STATUS
-- =========================================================

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS
    bookings_payment_status_check;


ALTER TABLE bookings
ADD CONSTRAINT bookings_payment_status_check
CHECK (
    payment_status IN (
        'unpaid',
        'pending',
        'paid',
        'refund_pending',
        'failed',
        'refunded',
        'partially_refunded'
    )
);


-- =========================================================
-- PAYMENT REFUNDS
-- =========================================================

CREATE TABLE IF NOT EXISTS payment_refunds (

    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    payment_id UUID NOT NULL
        REFERENCES payments(id)
        ON DELETE CASCADE,

    booking_id UUID NOT NULL
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    requested_by_user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    provider VARCHAR(30) NOT NULL
        DEFAULT 'razorpay',

    provider_refund_id VARCHAR(120),

    amount NUMERIC(10,2) NOT NULL
        CHECK (amount > 0),

    currency VARCHAR(10) NOT NULL
        DEFAULT 'INR',

    status VARCHAR(30) NOT NULL
        DEFAULT 'requested'
        CHECK (
            status IN (
                'requested',
                'pending',
                'processed',
                'failed'
            )
        ),

    reason TEXT,

    failure_reason TEXT,

    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT payment_refunds_one_full_refund_per_payment
        UNIQUE (payment_id)
);


CREATE UNIQUE INDEX IF NOT EXISTS
    idx_payment_refunds_provider_refund_unique
ON payment_refunds(provider_refund_id)
WHERE provider_refund_id IS NOT NULL;


CREATE INDEX IF NOT EXISTS
    idx_payment_refunds_booking_id
ON payment_refunds(booking_id);


CREATE INDEX IF NOT EXISTS
    idx_payment_refunds_status
ON payment_refunds(status);


DROP TRIGGER IF EXISTS
    trg_payment_refunds_updated_at
ON payment_refunds;


CREATE TRIGGER
    trg_payment_refunds_updated_at
BEFORE UPDATE
ON payment_refunds
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
