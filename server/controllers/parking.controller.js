const pool = require("../config/db");

async function getPublicParkingSpaces(req, res) {

    try {

        const {
            q = "",
            start_time = null,
            end_time = null,
            latitude = null,
            longitude = null,
            radius_km = 5
        } = req.query;


        const search =
            String(q).trim();


        const userLatitude =
            latitude === null ||
            latitude === ""
                ? null
                : Number(latitude);


        const userLongitude =
            longitude === null ||
            longitude === ""
                ? null
                : Number(longitude);


        const requestedRadius =
            Number(radius_km);


        const radiusKm =
            Number.isFinite(
                requestedRadius
            )
                ? Math.min(
                    Math.max(
                        requestedRadius,
                        1
                    ),
                    50
                )
                : 5;


        const hasLatitude =
            userLatitude !== null &&
            Number.isFinite(
                userLatitude
            );


        const hasLongitude =
            userLongitude !== null &&
            Number.isFinite(
                userLongitude
            );


        if (hasLatitude !== hasLongitude) {

            return res.status(400).json({
                status: "error",
                message:
                    "Both latitude and longitude are required."
            });
        }


        if (
            hasLatitude &&
            (
                userLatitude < -90 ||
                userLatitude > 90 ||
                userLongitude < -180 ||
                userLongitude > 180
            )
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Invalid latitude or longitude."
            });
        }


        const searchPattern =
            search
                ? `%${search}%`
                : null;


        const result =
            await pool.query(
                `
                WITH parking_with_distance AS (

                    SELECT
                        p.*,

                        CASE

                            WHEN
                                $4::double precision IS NULL
                                OR
                                $5::double precision IS NULL
                                OR
                                p.latitude IS NULL
                                OR
                                p.longitude IS NULL

                            THEN NULL

                            ELSE

                                6371 * ACOS(

                                    LEAST(
                                        1,

                                        GREATEST(
                                            -1,

                                            COS(
                                                RADIANS(
                                                    $4::double precision
                                                )
                                            )
                                            *
                                            COS(
                                                RADIANS(
                                                    p.latitude::double precision
                                                )
                                            )
                                            *
                                            COS(
                                                RADIANS(
                                                    p.longitude::double precision
                                                )
                                                -
                                                RADIANS(
                                                    $5::double precision
                                                )
                                            )
                                            +
                                            SIN(
                                                RADIANS(
                                                    $4::double precision
                                                )
                                            )
                                            *
                                            SIN(
                                                RADIANS(
                                                    p.latitude::double precision
                                                )
                                            )
                                        )
                                    )
                                )

                        END AS distance_km

                    FROM parking_spaces p

                    WHERE
                        p.status = 'active'
                        AND p.is_available = TRUE

                        AND (
                            $3::text IS NULL

                            OR p.name ILIKE $3
                            OR p.address ILIKE $3
                            OR p.city ILIKE $3
                        )
                )


                SELECT
                    p.id,
                    p.name,
                    p.description,
                    p.address,
                    p.city,
                    p.postal_code,
                    p.latitude,
                    p.longitude,
                    p.parking_type,
                    p.capacity,
                    p.standard_bays,
                    p.compact_bays,
                    p.ev_bays,
                    p.motorcycle_bays,
                    p.scooter_bays,
                    p.price_per_hour,
                    p.daily_max,
                    p.schedule_type,
                    p.amenities,
                    p.distance_km,

                    COALESCE(
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'id',
                                    pi.id,

                                    'image_url',
                                    pi.image_url,

                                    'is_primary',
                                    pi.is_primary
                                )
                                ORDER BY
                                    pi.is_primary DESC,
                                    pi.created_at
                            )

                            FROM parking_images pi

                            WHERE
                                pi.parking_space_id =
                                    p.id
                        ),
                        '[]'::json
                    ) AS images,


                    (
                        SELECT COUNT(*)

                        FROM bookings b

                        WHERE
                            b.parking_space_id =
                                p.id

                            AND b.status IN (
                                'pending',
                                'confirmed',
                                'active'
                            )

                            AND (
                                $1::timestamptz IS NULL

                                OR
                                $2::timestamptz IS NULL

                                OR (
                                    b.start_time <
                                        $2::timestamptz

                                    AND
                                    b.end_time >
                                        $1::timestamptz
                                )
                            )
                    ) AS booked_count


                FROM parking_with_distance p


                WHERE
                    (
                        $4::double precision IS NULL

                        OR
                        $5::double precision IS NULL

                        OR
                        p.distance_km <=
                            $6::double precision
                    )


                ORDER BY

                    CASE
                        WHEN p.distance_km IS NULL
                        THEN 1
                        ELSE 0
                    END,

                    p.distance_km ASC,

                    p.created_at DESC
                `,
                [
                    start_time || null,
                    end_time || null,
                    searchPattern,
                    hasLatitude
                        ? userLatitude
                        : null,
                    hasLongitude
                        ? userLongitude
                        : null,
                    radiusKm
                ]
            );


        const parking =
            result.rows.map(row => ({

                ...row,

                distance_km:
                    row.distance_km === null
                        ? null
                        : Number(
                            row.distance_km
                        ),

                booked_count:
                    Number(
                        row.booked_count || 0
                    ),

                available_spaces:
                    Math.max(
                        0,

                        Number(
                            row.capacity
                        ) -
                        Number(
                            row.booked_count || 0
                        )
                    )
            }));


        return res.json({
            status: "success",
            count: parking.length,
            parking
        });


    } catch (error) {

        console.error(
            "Public parking search error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to load parking spaces."
        });
    }
}

async function getPublicParkingSpace(req, res) {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                p.id,
                p.name,
                p.description,
                p.address,
                p.city,
                p.postal_code,
                p.access_gate,
                p.latitude,
                p.longitude,
                p.parking_type,
                p.capacity,
                p.standard_bays,
                p.compact_bays,
                p.ev_bays,
                p.motorcycle_bays,
                p.scooter_bays,
                p.price_per_hour,
                p.daily_max,
                p.schedule_type,
                p.amenities,

                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', pi.id,
                                'image_url', pi.image_url,
                                'is_primary', pi.is_primary
                            )
                            ORDER BY pi.is_primary DESC, pi.created_at
                        )
                        FROM parking_images pi
                        WHERE pi.parking_space_id = p.id
                    ),
                    '[]'::json
                ) AS images,

                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'day_of_week', poh.day_of_week,
                                'opening_time', poh.opening_time,
                                'closing_time', poh.closing_time,
                                'is_closed', poh.is_closed
                            )
                            ORDER BY poh.day_of_week
                        )
                        FROM parking_operating_hours poh
                        WHERE poh.parking_space_id = p.id
                    ),
                    '[]'::json
                ) AS operating_hours

            FROM parking_spaces p

            WHERE
                p.id = $1
                AND p.status = 'active'
                AND p.is_available = TRUE

            LIMIT 1
            `,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                status: "error",
                message: "Parking space not found."
            });
        }

        const parking = result.rows[0];

        const booked = await pool.query(
            `
            SELECT COUNT(*) AS count
            FROM bookings
            WHERE
                parking_space_id = $1
                AND status IN (
                    'pending',
                    'confirmed',
                    'active'
                )
            `,
            [id]
        );

        parking.booked_count = Number(booked.rows[0].count);
        parking.available_spaces = Math.max(
            0,
            Number(parking.capacity) - parking.booked_count
        );

        return res.json({
            status: "success",
            parking
        });

    } catch (error) {
        console.error("Parking details error:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to load parking details."
        });
    }
}


module.exports = {
    getPublicParkingSpaces,
    getPublicParkingSpace
};