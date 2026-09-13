-- =========================================================
-- Migration 005
-- User Vehicles + Parking Bookings
-- =========================================================


-- =========================================================
-- USER VEHICLES
-- =========================================================

CREATE TABLE IF NOT EXISTS user_vehicles (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    registration_number VARCHAR(30) NOT NULL,

    manufacturer VARCHAR(100),

    model VARCHAR(100),

    color VARCHAR(50),

    vehicle_type VARCHAR(30) NOT NULL
        CHECK (
            vehicle_type IN (
                'car',
                'motorcycle',
                'scooter',
                'van',
                'other'
            )
        ),

    fuel_type VARCHAR(30)
        CHECK (
            fuel_type IS NULL
            OR fuel_type IN (
                'petrol',
                'diesel',
                'cng',
                'electric',
                'hybrid',
                'other'
            )
        ),

    is_default BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT user_vehicles_registration_unique
        UNIQUE (
            user_id,
            registration_number
        )
);


-- =========================================================
-- BOOKINGS
-- =========================================================

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    parking_space_id UUID NOT NULL
        REFERENCES parking_spaces(id)
        ON DELETE RESTRICT,

    vehicle_id UUID NOT NULL
        REFERENCES user_vehicles(id)
        ON DELETE RESTRICT,

    booking_reference VARCHAR(30)
        UNIQUE,

    start_time TIMESTAMPTZ NOT NULL,

    end_time TIMESTAMPTZ NOT NULL,

    reserved_bay_type VARCHAR(30) NOT NULL
        CHECK (
            reserved_bay_type IN (
                'standard',
                'compact',
                'ev',
                'motorcycle',
                'scooter'
            )
        ),

    hourly_rate_snapshot NUMERIC(10,2) NOT NULL
        CHECK (
            hourly_rate_snapshot >= 0
        ),

    total_amount NUMERIC(10,2) NOT NULL
        CHECK (
            total_amount >= 0
        ),

    status VARCHAR(30) NOT NULL
        DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'active',
                'completed',
                'cancelled',
                'expired'
            )
        ),

    payment_status VARCHAR(30) NOT NULL
        DEFAULT 'unpaid'
        CHECK (
            payment_status IN (
                'unpaid',
                'pending',
                'paid',
                'failed',
                'refunded',
                'partially_refunded'
            )
        ),

    cancellation_reason TEXT,

    cancelled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT bookings_valid_time_range
        CHECK (
            end_time > start_time
        )
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS
    idx_user_vehicles_user_id
ON user_vehicles(user_id);


CREATE INDEX IF NOT EXISTS
    idx_user_vehicles_type
ON user_vehicles(vehicle_type);


CREATE INDEX IF NOT EXISTS
    idx_bookings_user_id
ON bookings(user_id);


CREATE INDEX IF NOT EXISTS
    idx_bookings_parking_space_id
ON bookings(parking_space_id);


CREATE INDEX IF NOT EXISTS
    idx_bookings_vehicle_id
ON bookings(vehicle_id);


CREATE INDEX IF NOT EXISTS
    idx_bookings_status
ON bookings(status);


CREATE INDEX IF NOT EXISTS
    idx_bookings_payment_status
ON bookings(payment_status);


CREATE INDEX IF NOT EXISTS
    idx_bookings_start_time
ON bookings(start_time);


CREATE INDEX IF NOT EXISTS
    idx_bookings_parking_time
ON bookings(
    parking_space_id,
    start_time,
    end_time
);


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

DROP TRIGGER IF EXISTS
    trg_user_vehicles_updated_at
ON user_vehicles;

CREATE TRIGGER
    trg_user_vehicles_updated_at
BEFORE UPDATE
ON user_vehicles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


DROP TRIGGER IF EXISTS
    trg_bookings_updated_at
ON bookings;

CREATE TRIGGER
    trg_bookings_updated_at
BEFORE UPDATE
ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();