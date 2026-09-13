-- =========================================================
-- Migration 004
-- Add motorcycle and scooter parking bays
-- =========================================================


ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS
    motorcycle_bays INTEGER
    NOT NULL
    DEFAULT 0;


ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS
    scooter_bays INTEGER
    NOT NULL
    DEFAULT 0;


-- ---------------------------------------------------------
-- Motorcycle validation
-- ---------------------------------------------------------

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'parking_spaces_motorcycle_bays_check'
    ) THEN

        ALTER TABLE parking_spaces
        ADD CONSTRAINT
            parking_spaces_motorcycle_bays_check
        CHECK (
            motorcycle_bays >= 0
        );

    END IF;

END
$$;


-- ---------------------------------------------------------
-- Scooter validation
-- ---------------------------------------------------------

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'parking_spaces_scooter_bays_check'
    ) THEN

        ALTER TABLE parking_spaces
        ADD CONSTRAINT
            parking_spaces_scooter_bays_check
        CHECK (
            scooter_bays >= 0
        );

    END IF;

END
$$;


-- ---------------------------------------------------------
-- Combined vehicle capacity validation
-- ---------------------------------------------------------

DO $$
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname =
            'parking_spaces_all_vehicle_bays_check'
    ) THEN

        ALTER TABLE parking_spaces
        ADD CONSTRAINT
            parking_spaces_all_vehicle_bays_check
        CHECK (
            standard_bays
            + compact_bays
            + ev_bays
            + motorcycle_bays
            + scooter_bays
            <= capacity
        );

    END IF;

END
$$;