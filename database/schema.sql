-- =========================================================
-- Smart Parking System
-- Complete PostgreSQL Schema
-- =========================================================


-- =========================================================
-- EXTENSIONS
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =========================================================
-- USERS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    phone VARCHAR(20),

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL
        CHECK (
            role IN (
                'owner',
                'user',
                'admin'
            )
        ),

    email_verified BOOLEAN NOT NULL
        DEFAULT FALSE,

    phone_verified BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


-- =========================================================
-- AUTHENTICATION OTPs
--
-- Used for:
-- - Email verification
-- - SMS verification
-- - Voice verification
-- - Future OTP-based authentication flows
-- =========================================================

CREATE TABLE IF NOT EXISTS auth_otps (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    otp_hash TEXT NOT NULL,

    purpose VARCHAR(50) NOT NULL,

    channel VARCHAR(20) NOT NULL
        CHECK (
            channel IN (
                'email',
                'sms',
                'voice'
            )
        ),

    destination VARCHAR(255) NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,

    attempts INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            attempts >= 0
        ),

    used_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


-- =========================================================
-- PARKING SPACES
-- =========================================================

CREATE TABLE IF NOT EXISTS parking_spaces (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    owner_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    name VARCHAR(150) NOT NULL,

    description TEXT,

    address TEXT NOT NULL,

    city VARCHAR(120),

    postal_code VARCHAR(20),

    access_gate VARCHAR(120),

    latitude NUMERIC(9,6) NOT NULL
        CHECK (
            latitude >= -90
            AND latitude <= 90
        ),

    longitude NUMERIC(9,6) NOT NULL
        CHECK (
            longitude >= -180
            AND longitude <= 180
        ),

    parking_type VARCHAR(30) NOT NULL
        CHECK (
            parking_type IN (
                'open',
                'covered',
                'underground',
                'multi_level',
                'private',
                'ev',
                'valet',
                'other'
            )
        ),

    capacity INTEGER NOT NULL
        CHECK (
            capacity > 0
        ),

    standard_bays INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            standard_bays >= 0
        ),

    compact_bays INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            compact_bays >= 0
        ),

    ev_bays INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            ev_bays >= 0
        ),

    motorcycle_bays INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            motorcycle_bays >= 0
        ),

    scooter_bays INTEGER NOT NULL
        DEFAULT 0
        CHECK (
            scooter_bays >= 0
        ),

    price_per_hour NUMERIC(10,2) NOT NULL
        CHECK (
            price_per_hour >= 0
        ),

    daily_max NUMERIC(10,2)
        CHECK (
            daily_max IS NULL
            OR daily_max >= 0
        ),

    schedule_type VARCHAR(20) NOT NULL
        DEFAULT '24-7'
        CHECK (
            schedule_type IN (
                '24-7',
                'business',
                'night',
                'weekend'
            )
        ),

    amenities JSONB NOT NULL
        DEFAULT '[]'::jsonb,

    is_available BOOLEAN NOT NULL
        DEFAULT TRUE,

    status VARCHAR(20) NOT NULL
        DEFAULT 'active'
        CHECK (
            status IN (
                'active',
                'inactive',
                'pending',
                'suspended'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    CONSTRAINT parking_spaces_all_vehicle_bays_check
        CHECK (
            standard_bays
            + compact_bays
            + ev_bays
            + motorcycle_bays
            + scooter_bays
            <= capacity
        )
);


-- =========================================================
-- PARKING OPERATING HOURS
--
-- day_of_week:
-- 0 = Sunday
-- 1 = Monday
-- 2 = Tuesday
-- 3 = Wednesday
-- 4 = Thursday
-- 5 = Friday
-- 6 = Saturday
-- =========================================================

CREATE TABLE IF NOT EXISTS parking_operating_hours (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    parking_space_id UUID NOT NULL
        REFERENCES parking_spaces(id)
        ON DELETE CASCADE,

    day_of_week SMALLINT NOT NULL
        CHECK (
            day_of_week BETWEEN 0 AND 6
        ),

    opening_time TIME,

    closing_time TIME,

    is_closed BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW(),

    UNIQUE (
        parking_space_id,
        day_of_week
    ),

    CHECK (
        is_closed = TRUE
        OR (
            opening_time IS NOT NULL
            AND closing_time IS NOT NULL
        )
    )
);


-- =========================================================
-- PARKING IMAGES
-- =========================================================

CREATE TABLE IF NOT EXISTS parking_images (
    id UUID PRIMARY KEY
        DEFAULT gen_random_uuid(),

    parking_space_id UUID NOT NULL
        REFERENCES parking_spaces(id)
        ON DELETE CASCADE,

    image_url TEXT NOT NULL,

    is_primary BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT NOW()
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_users_email
    ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_phone
    ON users(phone);


CREATE INDEX IF NOT EXISTS idx_auth_otps_user_id
    ON auth_otps(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_otps_expires_at
    ON auth_otps(expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_otps_user_purpose
    ON auth_otps(
        user_id,
        purpose
    );


CREATE INDEX IF NOT EXISTS idx_parking_spaces_owner_id
    ON parking_spaces(owner_id);

CREATE INDEX IF NOT EXISTS idx_parking_spaces_status
    ON parking_spaces(status);

CREATE INDEX IF NOT EXISTS idx_parking_spaces_available
    ON parking_spaces(is_available);

CREATE INDEX IF NOT EXISTS idx_parking_spaces_city
    ON parking_spaces(city);

CREATE INDEX IF NOT EXISTS idx_parking_spaces_location
    ON parking_spaces(
        latitude,
        longitude
    );


CREATE INDEX IF NOT EXISTS idx_parking_operating_hours_space_id
    ON parking_operating_hours(
        parking_space_id
    );


CREATE INDEX IF NOT EXISTS idx_parking_images_space_id
    ON parking_images(
        parking_space_id
    );


-- =========================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- USERS UPDATED_AT TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
    trg_users_updated_at
ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE
ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- PARKING SPACES UPDATED_AT TRIGGER
-- =========================================================

DROP TRIGGER IF EXISTS
    trg_parking_spaces_updated_at
ON parking_spaces;

CREATE TRIGGER trg_parking_spaces_updated_at
BEFORE UPDATE
ON parking_spaces
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();