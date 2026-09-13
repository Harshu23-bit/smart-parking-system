-- =========================================================
-- 006_operating_hours.sql
-- Seed real operating hours for existing parking spaces
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


CREATE INDEX IF NOT EXISTS
    idx_parking_operating_hours_space_id
ON parking_operating_hours(
    parking_space_id
);


-- =========================================================
-- Seed missing days for EXISTING parking spaces.
--
-- 24-7:
--   00:00 -> 00:00 means continuously open.
--
-- business:
--   06:00 -> 22:00
--
-- night:
--   19:00 -> 07:00 next day
--
-- weekend:
--   Saturday/Sunday open 24 hours
--   Monday-Friday closed
-- =========================================================

INSERT INTO parking_operating_hours (
    parking_space_id,
    day_of_week,
    opening_time,
    closing_time,
    is_closed
)
SELECT
    p.id,

    d.day_of_week,

    CASE
        WHEN p.schedule_type = '24-7'
            THEN '00:00'::time

        WHEN p.schedule_type = 'business'
            THEN '06:00'::time

        WHEN p.schedule_type = 'night'
            THEN '19:00'::time

        WHEN p.schedule_type = 'weekend'
            AND d.day_of_week IN (0, 6)
            THEN '00:00'::time

        ELSE NULL
    END,

    CASE
        WHEN p.schedule_type = '24-7'
            THEN '00:00'::time

        WHEN p.schedule_type = 'business'
            THEN '22:00'::time

        WHEN p.schedule_type = 'night'
            THEN '07:00'::time

        WHEN p.schedule_type = 'weekend'
            AND d.day_of_week IN (0, 6)
            THEN '00:00'::time

        ELSE NULL
    END,

    CASE
        WHEN p.schedule_type = 'weekend'
            AND d.day_of_week NOT IN (0, 6)
            THEN TRUE

        ELSE FALSE
    END

FROM parking_spaces p

CROSS JOIN (
    VALUES
        (0),
        (1),
        (2),
        (3),
        (4),
        (5),
        (6)
) AS d(day_of_week)

ON CONFLICT (
    parking_space_id,
    day_of_week
)
DO NOTHING;