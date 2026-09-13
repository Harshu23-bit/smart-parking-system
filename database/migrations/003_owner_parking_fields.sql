-- =========================================================
-- Owner Parking Space Fields
-- =========================================================

ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS city VARCHAR(120);

ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS access_gate VARCHAR(120);

ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS standard_bays INTEGER NOT NULL DEFAULT 0
    CHECK (standard_bays >= 0);

ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS compact_bays INTEGER NOT NULL DEFAULT 0
    CHECK (compact_bays >= 0);

ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS ev_bays INTEGER NOT NULL DEFAULT 0
    CHECK (ev_bays >= 0);

ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS daily_max NUMERIC(10,2)
    CHECK (
        daily_max IS NULL
        OR daily_max >= 0
    );

ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20)
    NOT NULL DEFAULT '24-7'
    CHECK (
        schedule_type IN (
            '24-7',
            'business',
            'night',
            'weekend'
        )
    );

ALTER TABLE parking_spaces
ADD COLUMN IF NOT EXISTS amenities JSONB
    NOT NULL DEFAULT '[]'::jsonb;


-- Replace old parking_type constraint so it matches
-- the actual Owner Portal options.

ALTER TABLE parking_spaces
DROP CONSTRAINT IF EXISTS parking_spaces_parking_type_check;

ALTER TABLE parking_spaces
ADD CONSTRAINT parking_spaces_parking_type_check
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
);


-- Bay totals must never be negative and should not exceed
-- total facility capacity.

ALTER TABLE parking_spaces
DROP CONSTRAINT IF EXISTS parking_spaces_bay_capacity_check;

ALTER TABLE parking_spaces
ADD CONSTRAINT parking_spaces_bay_capacity_check
CHECK (
    standard_bays +
    compact_bays +
    ev_bays
    <= capacity
);