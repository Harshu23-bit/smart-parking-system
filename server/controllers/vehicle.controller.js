const pool =
    require("../config/db");


function normalizeRegistrationNumber(
    value
) {
    return String(
        value || ""
    )
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}


async function createVehicle(
    req,
    res
) {
    try {

        const userId =
            req.user?.id;

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message:
                    "Authentication required.",
            });
        }


        const {
            registration_number,
            manufacturer,
            model,
            color,
            vehicle_type,
            fuel_type,
            is_default,
        } = req.body || {};


        const registrationNumber =
            normalizeRegistrationNumber(
                registration_number
            );


        if (!registrationNumber) {
            return res.status(400).json({
                status: "error",
                message:
                    "Vehicle registration number is required.",
            });
        }


        const allowedVehicleTypes =
            new Set([
                "car",
                "motorcycle",
                "scooter",
                "van",
                "other",
            ]);


        const allowedFuelTypes =
            new Set([
                "petrol",
                "diesel",
                "cng",
                "electric",
                "hybrid",
                "other",
            ]);


        if (
            !allowedVehicleTypes.has(
                vehicle_type
            )
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Invalid vehicle type.",
            });
        }


        if (
            fuel_type &&
            !allowedFuelTypes.has(
                fuel_type
            )
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Invalid fuel type.",
            });
        }


        const client =
            await pool.connect();


        try {

            await client.query(
                "BEGIN"
            );


            if (is_default === true) {

                await client.query(
                    `
                    UPDATE user_vehicles
                    SET is_default = FALSE
                    WHERE user_id = $1
                    `,
                    [userId]
                );
            }


            const result =
                await client.query(
                    `
                    INSERT INTO user_vehicles (
                        user_id,
                        registration_number,
                        manufacturer,
                        model,
                        color,
                        vehicle_type,
                        fuel_type,
                        is_default
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8
                    )
                    RETURNING *
                    `,
                    [
                        userId,
                        registrationNumber,
                        manufacturer?.trim() || null,
                        model?.trim() || null,
                        color?.trim() || null,
                        vehicle_type,
                        fuel_type || null,
                        is_default === true,
                    ]
                );


            await client.query(
                "COMMIT"
            );


            return res
                .status(201)
                .json({
                    status: "success",
                    message:
                        "Vehicle added successfully.",
                    vehicle:
                        result.rows[0],
                });


        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            throw error;

        } finally {

            client.release();
        }


    } catch (error) {

        if (
            error.code ===
            "23505"
        ) {
            return res.status(409).json({
                status: "error",
                message:
                    "This vehicle is already registered to your account.",
            });
        }


        console.error(
            "Create vehicle error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to add vehicle.",
        });
    }
}


async function getMyVehicles(
    req,
    res
) {
    try {

        const userId =
            req.user?.id;


        if (!userId) {
            return res.status(401).json({
                status: "error",
                message:
                    "Authentication required.",
            });
        }


        const result =
            await pool.query(
                `
                SELECT *
                FROM user_vehicles
                WHERE user_id = $1
                ORDER BY
                    is_default DESC,
                    created_at DESC
                `,
                [userId]
            );


        return res.json({
            status: "success",
            count:
                result.rows.length,
            vehicles:
                result.rows,
        });


    } catch (error) {

        console.error(
            "Get vehicles error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to load vehicles.",
        });
    }
}


module.exports = {
    createVehicle,
    getMyVehicles,
};