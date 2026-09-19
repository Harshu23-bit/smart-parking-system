const pool = require("../config/db");

async function getPublicParkingSpaces(req, res) {
    try {
        const {
            q = "",
            start_time = null,
            end_time = null
        } = req.query;

        const search = String(q).trim();

        const params = [];
        let where = `
            WHERE
                p.status = 'active'
                AND p.is_available = TRUE
        `;

        if (search) {
            params.push(`%${search}%`);

            where += `
                AND (
                    p.name ILIKE $${params.length}
                    OR p.address ILIKE $${params.length}
                    OR p.city ILIKE $${params.length}
                )
            `;
        }

        const result = await pool.query(
            `
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

                (
                    SELECT COUNT(*)
                    FROM bookings b
                    WHERE
                        b.parking_space_id = p.id
                        AND b.status IN (
                            'pending',
                            'confirmed',
                            'active'
                        )
                        AND (
                            $${params.length + 1}::timestamptz IS NULL
                            OR $${params.length + 2}::timestamptz IS NULL
                            OR (
                                b.start_time < $${params.length + 2}::timestamptz
                                AND b.end_time > $${params.length + 1}::timestamptz
                            )
                        )
                ) AS booked_count

            FROM parking_spaces p

            ${where}

            ORDER BY p.created_at DESC
            `,
            [
                ...params,
                start_time || null,
                end_time || null
            ]
        );

        const parking = result.rows.map(row => ({
            ...row,
            booked_count: Number(row.booked_count || 0),
            available_spaces: Math.max(
                0,
                Number(row.capacity) - Number(row.booked_count || 0)
            )
        }));

        return res.json({
            status: "success",
            count: parking.length,
            parking
        });

    } catch (error) {
        console.error("Public parking search error:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to load parking spaces."
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