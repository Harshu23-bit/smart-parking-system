const pool = require("../config/db");

const fs =
    require("fs");

const path =
    require("path");

const {
    uploadDirectory,
} = require(
    "../middleware/parkingImageUpload"
);

const ALLOWED_PARKING_TYPES = new Set([
    "open",
    "covered",
    "underground",
    "multi_level",
    "private",
    "ev",
    "valet",
    "other",
]);

const ALLOWED_SCHEDULE_TYPES = new Set([
    "24-7",
    "business",
    "night",
    "weekend",
]);

function parseInteger(value) {
    const parsed = Number.parseInt(value, 10);

    return Number.isInteger(parsed)
        ? parsed
        : null;
}

function parseNumber(value) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : null;
}

function normalizeAmenities(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return [
        ...new Set(
            value
                .filter(
                    item =>
                        typeof item === "string"
                )
                .map(item => item.trim())
                .filter(Boolean)
        ),
    ];
}

function getDefaultOperatingHours(
    scheduleType
) {

    const days =
        Array.from(
            { length: 7 },
            (_, dayOfWeek) => ({
                day_of_week:
                    dayOfWeek,

                opening_time:
                    "00:00",

                closing_time:
                    "00:00",

                is_closed:
                    false,
            })
        );


    if (
        scheduleType ===
        "business"
    ) {

        return days.map(
            day => ({
                ...day,

                opening_time:
                    "06:00",

                closing_time:
                    "22:00",
            })
        );
    }


    if (
        scheduleType ===
        "night"
    ) {

        return days.map(
            day => ({
                ...day,

                opening_time:
                    "19:00",

                closing_time:
                    "07:00",
            })
        );
    }


    if (
        scheduleType ===
        "weekend"
    ) {

        return days.map(
            day => {

                const weekend =
                    day.day_of_week === 0 ||
                    day.day_of_week === 6;


                return {
                    ...day,

                    opening_time:
                        weekend
                            ? "00:00"
                            : null,

                    closing_time:
                        weekend
                            ? "00:00"
                            : null,

                    is_closed:
                        !weekend,
                };
            }
        );
    }


    // 24-7
    return days;
}


async function saveOperatingHours(
    client,
    parkingSpaceId,
    hours
) {

    for (
        const day of hours
    ) {

        await client.query(
            `
            INSERT INTO parking_operating_hours (
                parking_space_id,
                day_of_week,
                opening_time,
                closing_time,
                is_closed
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5
            )

            ON CONFLICT (
                parking_space_id,
                day_of_week
            )

            DO UPDATE SET
                opening_time =
                    EXCLUDED.opening_time,

                closing_time =
                    EXCLUDED.closing_time,

                is_closed =
                    EXCLUDED.is_closed
            `,
            [
                parkingSpaceId,
                day.day_of_week,
                day.is_closed
                    ? null
                    : day.opening_time,
                day.is_closed
                    ? null
                    : day.closing_time,
                day.is_closed,
            ]
        );
    }
}

function serializeParkingSpace(row) {
    return {
        ...row,

        latitude:
            row.latitude !== null
                ? Number(row.latitude)
                : null,

        longitude:
            row.longitude !== null
                ? Number(row.longitude)
                : null,

        price_per_hour:
            row.price_per_hour !== null
                ? Number(row.price_per_hour)
                : null,

        daily_max:
            row.daily_max !== null
                ? Number(row.daily_max)
                : null,

        motorcycle_bays:
            row.motorcycle_bays !== null
                ? Number(
                    row.motorcycle_bays
                )
                : 0,

        scooter_bays:
            row.scooter_bays !== null
                ? Number(
                    row.scooter_bays
                )
                : 0,
    };
}


// =========================================================
// POST /api/owner/parking-spaces
// =========================================================

async function createParkingSpace(req, res) {
    try {
        const ownerId =
            req.user?.id;

        if (!ownerId) {
            return res.status(401).json({
                status: "error",
                message: "Authentication required.",
            });
        }

        const {
            name,
            description,
            address,
            city,
            postal_code,
            access_gate,
            latitude,
            longitude,
            parking_type,
            capacity,
            standard_bays,
            compact_bays,
            ev_bays,
            motorcycle_bays,
            scooter_bays,
            price_per_hour,
            daily_max,
            schedule_type,
            amenities,
        } = req.body || {};

        // -------------------------------------------------
        // Strings
        // -------------------------------------------------

        const cleanName =
            typeof name === "string"
                ? name.trim()
                : "";

        const cleanDescription =
            typeof description === "string"
                ? description.trim()
                : null;

        const cleanAddress =
            typeof address === "string"
                ? address.trim()
                : "";

        const cleanCity =
            typeof city === "string"
                ? city.trim()
                : null;

        const cleanPostalCode =
            typeof postal_code === "string"
                ? postal_code.trim()
                : null;

        const cleanAccessGate =
            typeof access_gate === "string"
                ? access_gate.trim()
                : null;

        const parkingType =
            typeof parking_type === "string"
                ? parking_type.trim()
                : "";

        const scheduleType =
            typeof schedule_type === "string"
                ? schedule_type.trim()
                : "24-7";

        // -------------------------------------------------
        // Numbers
        // -------------------------------------------------

        const parsedLatitude =
            parseNumber(latitude);

        const parsedLongitude =
            parseNumber(longitude);

        const parsedCapacity =
            parseInteger(capacity);

        const parsedStandardBays =
            standard_bays === undefined ||
            standard_bays === null ||
            standard_bays === ""
                ? 0
                : parseInteger(standard_bays);

        const parsedCompactBays =
            compact_bays === undefined ||
            compact_bays === null ||
            compact_bays === ""
                ? 0
                : parseInteger(compact_bays);

        const parsedEvBays =
            ev_bays === undefined ||
            ev_bays === null ||
            ev_bays === ""
                ? 0
                : parseInteger(ev_bays);

        const parsedMotorcycleBays =
            motorcycle_bays === undefined ||
            motorcycle_bays === null ||
            motorcycle_bays === ""
                ? 0
                : parseInteger(
                    motorcycle_bays
                );

        const parsedScooterBays =
            scooter_bays === undefined ||
            scooter_bays === null ||
            scooter_bays === ""
                ? 0
                : parseInteger(
                    scooter_bays
                );

        const parsedPricePerHour =
            parseNumber(price_per_hour);

        const parsedDailyMax =
            daily_max === undefined ||
            daily_max === null ||
            daily_max === ""
                ? null
                : parseNumber(daily_max);

        const cleanAmenities =
            normalizeAmenities(amenities);

        // -------------------------------------------------
        // Required-field validation
        // -------------------------------------------------

        if (!cleanName) {
            return res.status(400).json({
                status: "error",
                message:
                    "Parking space name is required.",
            });
        }

        if (!cleanAddress) {
            return res.status(400).json({
                status: "error",
                message:
                    "Parking space address is required.",
            });
        }

        if (
            !ALLOWED_PARKING_TYPES.has(
                parkingType
            )
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Invalid parking facility type.",
            });
        }

        if (
            !ALLOWED_SCHEDULE_TYPES.has(
                scheduleType
            )
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Invalid operating schedule.",
            });
        }

        // -------------------------------------------------
        // Location validation
        // -------------------------------------------------

        if (
            parsedLatitude === null ||
            parsedLongitude === null
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Please select a valid parking location before submitting.",
            });
        }

        if (
            parsedLatitude < -90 ||
            parsedLatitude > 90
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Latitude must be between -90 and 90.",
            });
        }

        if (
            parsedLongitude < -180 ||
            parsedLongitude > 180
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Longitude must be between -180 and 180.",
            });
        }

        // -------------------------------------------------
        // Capacity validation
        // -------------------------------------------------

        if (
            parsedCapacity === null ||
            parsedCapacity <= 0
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Parking capacity must be greater than zero.",
            });
        }

        if (
            parsedStandardBays === null ||
            parsedCompactBays === null ||
            parsedEvBays === null ||
            parsedStandardBays < 0 ||
            parsedCompactBays < 0 ||
            parsedEvBays < 0 ||
            parsedMotorcycleBays < 0 ||
            parsedScooterBays < 0
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Bay counts must be zero or greater.",
            });
        }

        const assignedBayCount =
            parsedStandardBays +
            parsedCompactBays +
            parsedEvBays +
            parsedMotorcycleBays +
            parsedScooterBays;

        if (
            assignedBayCount >
            parsedCapacity
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Car, EV, motorcycle, and scooter bays cannot exceed total capacity.",
            });
        }

        // -------------------------------------------------
        // Pricing validation
        // -------------------------------------------------

        if (
            parsedPricePerHour === null ||
            parsedPricePerHour < 0
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Hourly rate must be zero or greater.",
            });
        }

        if (
            parsedDailyMax !== null &&
            parsedDailyMax < 0
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Daily maximum must be zero or greater.",
            });
        }

        // -------------------------------------------------
        // Insert
        // -------------------------------------------------

        const query = `
            INSERT INTO parking_spaces (
                owner_id,
                name,
                description,
                address,
                city,
                postal_code,
                access_gate,
                latitude,
                longitude,
                parking_type,
                capacity,
                standard_bays,
                compact_bays,
                ev_bays,
                motorcycle_bays,
                scooter_bays,
                price_per_hour,
                daily_max,
                schedule_type,
                amenities,
                is_available,
                status
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                $15,
                $16,
                $17,
                $18,
                $19,
                $20::jsonb,
                TRUE,
                'active'
            )
            RETURNING *
        `;

        const values = [
            ownerId,
            cleanName,
            cleanDescription,
            cleanAddress,
            cleanCity,
            cleanPostalCode,
            cleanAccessGate,
            parsedLatitude,
            parsedLongitude,
            parkingType,
            parsedCapacity,
            parsedStandardBays,
            parsedCompactBays,
            parsedEvBays,
            parsedMotorcycleBays,
            parsedScooterBays,
            parsedPricePerHour,
            parsedDailyMax,
            scheduleType,
            JSON.stringify(
                cleanAmenities
            ),
        ];

        const result =
            await pool.query(
                query,
                values
            );

        const parkingSpace =
            serializeParkingSpace(
                result.rows[0]
            );

        const defaultHours =
            getDefaultOperatingHours(
                scheduleType
            );


        await saveOperatingHours(
            pool,
            parkingSpace.id,
            defaultHours
        );

        return res.status(201).json({
            status: "success",
            message:
                "Parking space listed successfully.",
            parking_space: parkingSpace,
        });

    } catch (error) {
        console.error(
            "Create parking space error:",
            error
        );

        return res.status(500).json({
            status: "error",
            message:
                "Unable to create parking space.",
        });
    }
}


// =========================================================
// GET /api/owner/parking-spaces
// =========================================================

async function getOwnerParkingSpaces(req, res) {
    try {
        const ownerId =
            req.user?.id;

        if (!ownerId) {
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
                    FROM parking_spaces
                    WHERE owner_id = $1
                    ORDER BY created_at DESC
                `,
                [ownerId]
            );

        const parkingSpaces =
            result.rows.map(
                serializeParkingSpace
            );

        return res.json({
            status: "success",
            count:
                parkingSpaces.length,
            parking_spaces:
                parkingSpaces,
        });

    } catch (error) {
        console.error(
            "Get owner parking spaces error:",
            error
        );

        return res.status(500).json({
            status: "error",
            message:
                "Unable to load parking spaces.",
        });
    }
}

// =========================================================
// PATCH /api/owner/parking-spaces/:id
// Edit parking-space details
// =========================================================

async function updateParkingSpaceDetails(
    req,
    res
) {

    try {

        const ownerId =
            req.user?.id;


        const parkingId =
            req.params.id;


        if (!ownerId) {

            return res.status(401).json({
                status: "error",
                message:
                    "Authentication required.",
            });
        }


        // -------------------------------------------------
        // Load the current parking space.
        //
        // Ownership is enforced here.
        // -------------------------------------------------

        const existingResult =
            await pool.query(
                `
                SELECT *
                FROM parking_spaces
                WHERE
                    id = $1
                    AND owner_id = $2
                LIMIT 1
                `,
                [
                    parkingId,
                    ownerId,
                ]
            );


        if (
            existingResult.rows.length ===
            0
        ) {

            return res.status(404).json({
                status: "error",
                message:
                    "Parking space not found.",
            });
        }


        const current =
            existingResult.rows[0];


        const body =
            req.body || {};


        // -------------------------------------------------
        // MERGE NEW VALUES WITH CURRENT DATABASE VALUES
        // -------------------------------------------------

        const name =
            body.name !== undefined
                ? body.name
                : current.name;


        const description =
            body.description !== undefined
                ? body.description
                : current.description;


        const address =
            body.address !== undefined
                ? body.address
                : current.address;


        const city =
            body.city !== undefined
                ? body.city
                : current.city;


        const postalCode =
            body.postal_code !== undefined
                ? body.postal_code
                : current.postal_code;


        const accessGate =
            body.access_gate !== undefined
                ? body.access_gate
                : current.access_gate;


        const latitude =
            body.latitude !== undefined
                ? body.latitude
                : current.latitude;


        const longitude =
            body.longitude !== undefined
                ? body.longitude
                : current.longitude;


        const parkingType =
            body.parking_type !== undefined
                ? body.parking_type
                : current.parking_type;


        const capacity =
            body.capacity !== undefined
                ? body.capacity
                : current.capacity;


        const standardBays =
            body.standard_bays !== undefined
                ? body.standard_bays
                : current.standard_bays;


        const compactBays =
            body.compact_bays !== undefined
                ? body.compact_bays
                : current.compact_bays;


        const evBays =
            body.ev_bays !== undefined
                ? body.ev_bays
                : current.ev_bays;


        const motorcycleBays =
            body.motorcycle_bays !== undefined
                ? body.motorcycle_bays
                : current.motorcycle_bays;


        const scooterBays =
            body.scooter_bays !== undefined
                ? body.scooter_bays
                : current.scooter_bays;


        const pricePerHour =
            body.price_per_hour !== undefined
                ? body.price_per_hour
                : current.price_per_hour;


        const dailyMax =
            body.daily_max !== undefined
                ? body.daily_max
                : current.daily_max;


        const scheduleType =
            body.schedule_type !== undefined
                ? body.schedule_type
                : current.schedule_type;


        const amenities =
            body.amenities !== undefined
                ? body.amenities
                : current.amenities;


        // -------------------------------------------------
        // CLEAN STRINGS
        // -------------------------------------------------

        const cleanName =
            typeof name === "string"
                ? name.trim()
                : "";


        const cleanDescription =
            typeof description === "string"
                ? description.trim()
                : null;


        const cleanAddress =
            typeof address === "string"
                ? address.trim()
                : "";


        const cleanCity =
            typeof city === "string"
                ? city.trim()
                : null;


        const cleanPostalCode =
            typeof postalCode === "string"
                ? postalCode.trim()
                : null;


        const cleanAccessGate =
            typeof accessGate === "string"
                ? accessGate.trim()
                : null;


        const cleanParkingType =
            typeof parkingType === "string"
                ? parkingType.trim()
                : "";


        const cleanScheduleType =
            typeof scheduleType === "string"
                ? scheduleType.trim()
                : "";


        // -------------------------------------------------
        // PARSE NUMBERS
        // -------------------------------------------------

        const parsedLatitude =
            parseNumber(latitude);


        const parsedLongitude =
            parseNumber(longitude);


        const parsedCapacity =
            parseInteger(capacity);


        const parsedStandardBays =
            parseInteger(
                standardBays
            );


        const parsedCompactBays =
            parseInteger(
                compactBays
            );


        const parsedEvBays =
            parseInteger(
                evBays
            );


        const parsedMotorcycleBays =
            parseInteger(
                motorcycleBays
            );


        const parsedScooterBays =
            parseInteger(
                scooterBays
            );


        const parsedPricePerHour =
            parseNumber(
                pricePerHour
            );


        const parsedDailyMax =
            dailyMax === null ||
            dailyMax === ""
                ? null
                : parseNumber(
                    dailyMax
                );


        const cleanAmenities =
            normalizeAmenities(
                amenities
            );


        // -------------------------------------------------
        // REQUIRED DATA
        // -------------------------------------------------

        if (!cleanName) {

            return res.status(400).json({
                status: "error",
                message:
                    "Parking space name is required.",
            });
        }


        if (!cleanAddress) {

            return res.status(400).json({
                status: "error",
                message:
                    "Parking space address is required.",
            });
        }


        // -------------------------------------------------
        // PARKING TYPE
        // -------------------------------------------------

        if (
            !ALLOWED_PARKING_TYPES.has(
                cleanParkingType
            )
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Invalid parking facility type.",
            });
        }


        // -------------------------------------------------
        // SCHEDULE
        // -------------------------------------------------

        if (
            !ALLOWED_SCHEDULE_TYPES.has(
                cleanScheduleType
            )
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Invalid operating schedule.",
            });
        }


        // -------------------------------------------------
        // LOCATION
        // -------------------------------------------------

        if (
            parsedLatitude === null ||
            parsedLatitude < -90 ||
            parsedLatitude > 90
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Latitude must be between -90 and 90.",
            });
        }


        if (
            parsedLongitude === null ||
            parsedLongitude < -180 ||
            parsedLongitude > 180
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Longitude must be between -180 and 180.",
            });
        }


        // -------------------------------------------------
        // CAPACITY
        // -------------------------------------------------

        if (
            parsedCapacity === null ||
            parsedCapacity <= 0
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Parking capacity must be greater than zero.",
            });
        }


        const parsedBayCounts = [
            parsedStandardBays,
            parsedCompactBays,
            parsedEvBays,
            parsedMotorcycleBays,
            parsedScooterBays,
        ];


        if (
            parsedBayCounts.some(
                value =>
                    value === null ||
                    value < 0
            )
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Bay counts must be zero or greater.",
            });
        }


        const assignedBayCount =
            parsedStandardBays +
            parsedCompactBays +
            parsedEvBays +
            parsedMotorcycleBays +
            parsedScooterBays;


        if (
            assignedBayCount >
            parsedCapacity
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Assigned parking bays cannot exceed total capacity.",
            });
        }


        // -------------------------------------------------
        // PRICING
        // -------------------------------------------------

        if (
            parsedPricePerHour === null ||
            parsedPricePerHour < 0
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Hourly rate must be zero or greater.",
            });
        }


        if (
            parsedDailyMax !== null &&
            parsedDailyMax < 0
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Daily maximum must be zero or greater.",
            });
        }


        // -------------------------------------------------
        // UPDATE
        // -------------------------------------------------

        const result =
            await pool.query(
                `
                UPDATE parking_spaces
                SET
                    name = $1,
                    description = $2,
                    address = $3,
                    city = $4,
                    postal_code = $5,
                    access_gate = $6,
                    latitude = $7,
                    longitude = $8,
                    parking_type = $9,
                    capacity = $10,
                    standard_bays = $11,
                    compact_bays = $12,
                    ev_bays = $13,
                    motorcycle_bays = $14,
                    scooter_bays = $15,
                    price_per_hour = $16,
                    daily_max = $17,
                    schedule_type = $18,
                    amenities = $19::jsonb,
                    updated_at = NOW()
                WHERE
                    id = $20
                    AND owner_id = $21
                RETURNING *
                `,
                [
                    cleanName,
                    cleanDescription,
                    cleanAddress,
                    cleanCity,
                    cleanPostalCode,
                    cleanAccessGate,
                    parsedLatitude,
                    parsedLongitude,
                    cleanParkingType,
                    parsedCapacity,
                    parsedStandardBays,
                    parsedCompactBays,
                    parsedEvBays,
                    parsedMotorcycleBays,
                    parsedScooterBays,
                    parsedPricePerHour,
                    parsedDailyMax,
                    cleanScheduleType,
                    JSON.stringify(
                        cleanAmenities
                    ),
                    parkingId,
                    ownerId,
                ]
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({
                status: "error",
                message:
                    "Parking space not found.",
            });
        }


        return res.json({
            status: "success",
            message:
                "Parking space details updated successfully.",
            parking_space:
                serializeParkingSpace(
                    result.rows[0]
                ),
        });


    } catch (error) {

        console.error(
            "Update parking space details error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to update parking space details.",
        });
    }
}

async function updateParkingAvailability(
    req,
    res
) {
    try {

        const ownerId =
            req.user.id;

        const parkingId =
            req.params.id;

        const {
            is_available
        } = req.body;

        if (
            typeof is_available !==
            "boolean"
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "is_available must be true or false.",
            });
        }

        const result =
            await pool.query(
                `
                UPDATE parking_spaces
                SET
                    is_available = $1,
                    updated_at = NOW()
                WHERE
                    id = $2
                    AND owner_id = $3
                RETURNING *
                `,
                [
                    is_available,
                    parkingId,
                    ownerId,
                ]
            );

        if (
            result.rows.length === 0
        ) {
            return res.status(404).json({
                status: "error",
                message:
                    "Parking space not found.",
            });
        }

        return res.json({
            status: "success",
            message:
                is_available
                    ? "Parking space opened."
                    : "Parking space closed.",
            parking_space:
                serializeParkingSpace(
                    result.rows[0]
                ),
        });

    } catch (error) {

        console.error(
            "Update availability error:",
            error
        );

        return res.status(500).json({
            status: "error",
            message:
                "Unable to update parking availability.",
        });
    }
}


async function updateParkingPricing(
    req,
    res
) {
    try {

        const ownerId =
            req.user.id;

        const parkingId =
            req.params.id;

        const pricePerHour =
            Number(
                req.body.price_per_hour
            );

        const dailyMax =
            req.body.daily_max === null ||
            req.body.daily_max === undefined ||
            req.body.daily_max === ""
                ? null
                : Number(
                    req.body.daily_max
                );

        if (
            !Number.isFinite(
                pricePerHour
            ) ||
            pricePerHour < 0
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Invalid hourly price.",
            });
        }

        if (
            dailyMax !== null &&
            (
                !Number.isFinite(
                    dailyMax
                ) ||
                dailyMax < 0
            )
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Invalid daily maximum.",
            });
        }

        const result =
            await pool.query(
                `
                UPDATE parking_spaces
                SET
                    price_per_hour = $1,
                    daily_max = $2,
                    updated_at = NOW()
                WHERE
                    id = $3
                    AND owner_id = $4
                RETURNING *
                `,
                [
                    pricePerHour,
                    dailyMax,
                    parkingId,
                    ownerId,
                ]
            );

        if (
            result.rows.length === 0
        ) {
            return res.status(404).json({
                status: "error",
                message:
                    "Parking space not found.",
            });
        }

        return res.json({
            status: "success",
            message:
                "Parking pricing updated.",
            parking_space:
                serializeParkingSpace(
                    result.rows[0]
                ),
        });

    } catch (error) {

        console.error(
            "Update pricing error:",
            error
        );

        return res.status(500).json({
            status: "error",
            message:
                "Unable to update pricing.",
        });
    }
}

async function getOwnerBookings(
    req,
    res
) {
    try {

        const ownerId =
            req.user?.id;

        const parkingSpaceId =
            req.query.parking_space_id ||
            null;


        const params =
            [ownerId];


        let parkingFilter =
            "";


        if (parkingSpaceId) {

            params.push(
                parkingSpaceId
            );

            parkingFilter =
                `
                AND p.id = $2
                `;
        }


        const result =
            await pool.query(
                `
                SELECT
                    b.id,
                    b.booking_reference,
                    b.start_time,
                    b.end_time,
                    b.reserved_bay_type,
                    b.hourly_rate_snapshot,
                    b.total_amount,
                    b.status,
                    b.payment_status,
                    b.cancellation_reason,
                    b.cancelled_at,
                    b.created_at,

                    p.id
                        AS parking_space_id,

                    p.name
                        AS parking_space_name,

                    u.id
                        AS driver_id,

                    u.name
                        AS driver_name,

                    u.phone
                        AS driver_phone,

                    v.id
                        AS vehicle_id,

                    v.registration_number,

                    v.manufacturer,

                    v.model,

                    v.color,

                    v.vehicle_type,

                    v.fuel_type

                FROM bookings b

                JOIN parking_spaces p
                    ON p.id =
                        b.parking_space_id

                JOIN users u
                    ON u.id =
                        b.user_id

                JOIN user_vehicles v
                    ON v.id =
                        b.vehicle_id

                WHERE
                    p.owner_id = $1

                    ${parkingFilter}

                ORDER BY
                    b.start_time DESC
                `,
                params
            );


        return res.json({
            status: "success",
            count:
                result.rows.length,
            bookings:
                result.rows,
        });


    } catch (error) {

        console.error(
            "Get owner bookings error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to load owner bookings.",
        });
    }
}

// =========================================================
// PATCH /api/owner/bookings/:id/status
// OWNER BOOKING STATUS MANAGEMENT
// =========================================================

async function updateOwnerBookingStatus(
    req,
    res
) {

    try {

        const ownerId =
            req.user?.id;


        const bookingId =
            req.params.id;


        const {
            status
        } = req.body || {};


        if (!ownerId) {

            return res.status(401).json({
                status: "error",
                message:
                    "Authentication required.",
            });
        }


        const requestedStatus =
            String(
                status || ""
            )
            .trim()
            .toLowerCase();


        if (
            ![
                "active",
                "completed",
            ].includes(
                requestedStatus
            )
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Owner can only start or complete a booking.",
            });
        }


        // -----------------------------------------
        // LOAD BOOKING + VERIFY OWNERSHIP
        // -----------------------------------------

        const currentResult =
            await pool.query(
                `
                SELECT
                    b.id,
                    b.booking_reference,
                    b.status,
                    b.payment_status,
                    b.start_time,
                    b.end_time,
                    b.parking_space_id
                FROM bookings b

                JOIN parking_spaces p
                    ON p.id =
                        b.parking_space_id

                WHERE
                    b.id = $1
                    AND p.owner_id = $2

                LIMIT 1
                `,
                [
                    bookingId,
                    ownerId,
                ]
            );


        if (
            currentResult.rowCount ===
            0
        ) {

            return res.status(404).json({
                status: "error",
                message:
                    "Booking not found.",
            });
        }


        const booking =
            currentResult.rows[0];


        // -----------------------------------------
        // START PARKING
        // confirmed + paid -> active
        // -----------------------------------------

        if (
            requestedStatus ===
            "active"
        ) {

            if (
                booking.status !==
                "confirmed"
            ) {

                return res.status(409).json({
                    status: "error",
                    message:
                        "Only a confirmed booking can be started.",
                });
            }


            if (
                booking.payment_status !==
                "paid"
            ) {

                return res.status(409).json({
                    status: "error",
                    message:
                        "Payment must be completed before parking can start.",
                });
            }
        }


        // -----------------------------------------
        // COMPLETE PARKING
        // active -> completed
        // -----------------------------------------

        if (
            requestedStatus ===
            "completed" &&
            booking.status !==
                "active"
        ) {

            return res.status(409).json({
                status: "error",
                message:
                    "Only an active booking can be completed.",
            });
        }


        const result =
            await pool.query(
                `
                UPDATE bookings
                SET
                    status = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
                `,
                [
                    requestedStatus,
                    bookingId,
                ]
            );


        return res.json({
            status: "success",

            message:
                requestedStatus ===
                "active"
                    ? "Parking session started."
                    : "Booking completed successfully.",

            booking:
                result.rows[0],
        });


    } catch (error) {

        console.error(
            "Update owner booking status error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to update booking status.",
        });
    }
}

// =========================================================
// GET /api/owner/parking-spaces/:id/operating-hours
// =========================================================

async function getOwnerOperatingHours(
    req,
    res
) {

    try {

        const ownerId =
            req.user?.id;


        const parkingId =
            req.params.id;


        const parkingResult =
            await pool.query(
                `
                SELECT id
                FROM parking_spaces
                WHERE
                    id = $1
                    AND owner_id = $2
                LIMIT 1
                `,
                [
                    parkingId,
                    ownerId,
                ]
            );


        if (
            parkingResult.rowCount ===
            0
        ) {

            return res.status(404).json({
                status:
                    "error",

                message:
                    "Parking space not found.",
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    day_of_week,
                    opening_time,
                    closing_time,
                    is_closed
                FROM parking_operating_hours
                WHERE parking_space_id = $1
                ORDER BY day_of_week
                `,
                [
                    parkingId
                ]
            );


        return res.json({
            status:
                "success",

            operating_hours:
                result.rows,
        });


    } catch (error) {

        console.error(
            "Get operating hours error:",
            error
        );


        return res.status(500).json({
            status:
                "error",

            message:
                "Unable to load operating hours.",
        });
    }
}


// =========================================================
// PATCH /api/owner/parking-spaces/:id/operating-hours
// =========================================================

async function updateOwnerOperatingHours(
    req,
    res
) {

    const client =
        await pool.connect();


    try {

        const ownerId =
            req.user?.id;


        const parkingId =
            req.params.id;


        const {
            operating_hours
        } = req.body || {};


        if (
            !Array.isArray(
                operating_hours
            ) ||
            operating_hours.length !==
                7
        ) {

            return res.status(400).json({
                status:
                    "error",

                message:
                    "Operating hours must contain exactly 7 days.",
            });
        }


        const seenDays =
            new Set();


        const normalized = [];


        for (
            const entry of
            operating_hours
        ) {

            const dayOfWeek =
                Number(
                    entry.day_of_week
                );


            if (
                !Number.isInteger(
                    dayOfWeek
                ) ||
                dayOfWeek < 0 ||
                dayOfWeek > 6 ||
                seenDays.has(
                    dayOfWeek
                )
            ) {

                return res.status(400).json({
                    status:
                        "error",

                    message:
                        "Operating hours contain an invalid or duplicate day.",
                });
            }


            seenDays.add(
                dayOfWeek
            );


            const isClosed =
                Boolean(
                    entry.is_closed
                );


            let openingTime =
                null;


            let closingTime =
                null;


            if (!isClosed) {

                openingTime =
                    String(
                        entry.opening_time ||
                        ""
                    ).trim();


                closingTime =
                    String(
                        entry.closing_time ||
                        ""
                    ).trim();


                const timePattern =
                    /^([01]\d|2[0-3]):[0-5]\d$/;


                if (
                    !timePattern.test(
                        openingTime
                    ) ||
                    !timePattern.test(
                        closingTime
                    )
                ) {

                    return res.status(400).json({
                        status:
                            "error",

                        message:
                            "Open days must contain valid HH:MM opening and closing times.",
                    });
                }
            }


            normalized.push({
                day_of_week:
                    dayOfWeek,

                opening_time:
                    openingTime,

                closing_time:
                    closingTime,

                is_closed:
                    isClosed,
            });
        }


        await client.query(
            "BEGIN"
        );


        const ownershipResult =
            await client.query(
                `
                SELECT id
                FROM parking_spaces
                WHERE
                    id = $1
                    AND owner_id = $2
                LIMIT 1
                `,
                [
                    parkingId,
                    ownerId,
                ]
            );


        if (
            ownershipResult.rowCount ===
            0
        ) {

            await client.query(
                "ROLLBACK"
            );


            return res.status(404).json({
                status:
                    "error",

                message:
                    "Parking space not found.",
            });
        }


        await saveOperatingHours(
            client,
            parkingId,
            normalized
        );


        await client.query(
            "COMMIT"
        );


        const result =
            await pool.query(
                `
                SELECT
                    day_of_week,
                    opening_time,
                    closing_time,
                    is_closed
                FROM parking_operating_hours
                WHERE parking_space_id = $1
                ORDER BY day_of_week
                `,
                [
                    parkingId
                ]
            );


        return res.json({
            status:
                "success",

            message:
                "Operating hours updated successfully.",

            operating_hours:
                result.rows,
        });


    } catch (error) {

        try {
            await client.query(
                "ROLLBACK"
            );
        } catch (_) {
            // Ignore rollback failure.
        }


        console.error(
            "Update operating hours error:",
            error
        );


        return res.status(500).json({
            status:
                "error",

            message:
                "Unable to update operating hours.",
        });


    } finally {

        client.release();
    }
}

// =========================================================
// GET /api/owner/parking-spaces/:id/images
// =========================================================

async function getOwnerParkingImages(
    req,
    res
) {

    try {

        const ownerId =
            req.user?.id;

        const parkingId =
            req.params.id;


        const ownership =
            await pool.query(
                `
                SELECT id
                FROM parking_spaces
                WHERE
                    id = $1
                    AND owner_id = $2
                LIMIT 1
                `,
                [
                    parkingId,
                    ownerId,
                ]
            );


        if (
            ownership.rowCount === 0
        ) {

            return res.status(404).json({
                status: "error",
                message:
                    "Parking space not found.",
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    parking_space_id,
                    image_url,
                    is_primary,
                    created_at
                FROM parking_images
                WHERE parking_space_id = $1
                ORDER BY
                    is_primary DESC,
                    created_at ASC
                `,
                [
                    parkingId
                ]
            );


        return res.json({
            status: "success",
            count:
                result.rows.length,
            images:
                result.rows,
        });


    } catch (error) {

        console.error(
            "Get parking images error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to load parking images.",
        });
    }
}


// =========================================================
// POST /api/owner/parking-spaces/:id/images
// =========================================================

async function uploadOwnerParkingImages(
    req,
    res
) {

    const files =
        Array.isArray(
            req.files
        )
            ? req.files
            : [];


    function removeUploadedFiles() {

        files.forEach(
            file => {

                try {

                    if (
                        file?.path &&
                        fs.existsSync(
                            file.path
                        )
                    ) {

                        fs.unlinkSync(
                            file.path
                        );
                    }

                } catch (_) {
                    // Ignore cleanup failure.
                }
            }
        );
    }


    const client =
        await pool.connect();


    try {

        const ownerId =
            req.user?.id;

        const parkingId =
            req.params.id;


        if (
            files.length === 0
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Please select at least one parking image.",
            });
        }


        await client.query(
            "BEGIN"
        );


        const ownership =
            await client.query(
                `
                SELECT id
                FROM parking_spaces
                WHERE
                    id = $1
                    AND owner_id = $2
                LIMIT 1
                `,
                [
                    parkingId,
                    ownerId,
                ]
            );


        if (
            ownership.rowCount === 0
        ) {

            await client.query(
                "ROLLBACK"
            );

            removeUploadedFiles();


            return res.status(404).json({
                status: "error",
                message:
                    "Parking space not found.",
            });
        }


        const existingCount =
            await client.query(
                `
                SELECT COUNT(*)::int
                    AS image_count
                FROM parking_images
                WHERE parking_space_id = $1
                `,
                [
                    parkingId
                ]
            );


        const currentCount =
            Number(
                existingCount
                    .rows[0]
                    .image_count
            ) || 0;


        if (
            currentCount +
            files.length >
            10
        ) {

            await client.query(
                "ROLLBACK"
            );

            removeUploadedFiles();


            return res.status(400).json({
                status: "error",
                message:
                    "A parking space can have a maximum of 10 images.",
            });
        }


        const insertedImages =
            [];


        for (
            let index = 0;
            index <
            files.length;
            index += 1
        ) {

            const file =
                files[index];


            const imageUrl =
                `/uploads/parking/${file.filename}`;


            const makePrimary =
                currentCount === 0 &&
                index === 0;


            const insert =
                await client.query(
                    `
                    INSERT INTO parking_images (
                        parking_space_id,
                        image_url,
                        is_primary
                    )
                    VALUES (
                        $1,
                        $2,
                        $3
                    )
                    RETURNING
                        id,
                        parking_space_id,
                        image_url,
                        is_primary,
                        created_at
                    `,
                    [
                        parkingId,
                        imageUrl,
                        makePrimary,
                    ]
                );


            insertedImages.push(
                insert.rows[0]
            );
        }


        await client.query(
            "COMMIT"
        );


        return res.status(201).json({
            status: "success",
            message:
                `${insertedImages.length} parking image${
                    insertedImages.length === 1
                        ? ""
                        : "s"
                } uploaded successfully.`,

            images:
                insertedImages,
        });


    } catch (error) {

        try {
            await client.query(
                "ROLLBACK"
            );
        } catch (_) {
            // Ignore rollback failure.
        }


        removeUploadedFiles();


        console.error(
            "Upload parking images error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to upload parking images.",
        });


    } finally {

        client.release();
    }
}


// =========================================================
// PATCH /api/owner/parking-spaces/:id/images/:imageId/primary
// =========================================================

async function setPrimaryParkingImage(
    req,
    res
) {

    const client =
        await pool.connect();


    try {

        const ownerId =
            req.user?.id;

        const parkingId =
            req.params.id;

        const imageId =
            req.params.imageId;


        await client.query(
            "BEGIN"
        );


        const imageResult =
            await client.query(
                `
                SELECT
                    pi.id
                FROM parking_images pi

                JOIN parking_spaces p
                    ON p.id =
                        pi.parking_space_id

                WHERE
                    pi.id = $1
                    AND pi.parking_space_id = $2
                    AND p.owner_id = $3

                LIMIT 1
                `,
                [
                    imageId,
                    parkingId,
                    ownerId,
                ]
            );


        if (
            imageResult.rowCount ===
            0
        ) {

            await client.query(
                "ROLLBACK"
            );


            return res.status(404).json({
                status: "error",
                message:
                    "Parking image not found.",
            });
        }


        await client.query(
            `
            UPDATE parking_images
            SET is_primary = FALSE
            WHERE parking_space_id = $1
            `,
            [
                parkingId
            ]
        );


        const updated =
            await client.query(
                `
                UPDATE parking_images
                SET is_primary = TRUE
                WHERE
                    id = $1
                    AND parking_space_id = $2
                RETURNING *
                `,
                [
                    imageId,
                    parkingId,
                ]
            );


        await client.query(
            "COMMIT"
        );


        return res.json({
            status: "success",
            message:
                "Primary parking image updated.",
            image:
                updated.rows[0],
        });


    } catch (error) {

        try {
            await client.query(
                "ROLLBACK"
            );
        } catch (_) {}


        console.error(
            "Set primary parking image error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to update primary image.",
        });


    } finally {

        client.release();
    }
}


// =========================================================
// DELETE /api/owner/parking-spaces/:id/images/:imageId
// =========================================================

async function deleteOwnerParkingImage(
    req,
    res
) {

    const client =
        await pool.connect();


    try {

        const ownerId =
            req.user?.id;

        const parkingId =
            req.params.id;

        const imageId =
            req.params.imageId;


        await client.query(
            "BEGIN"
        );


        const result =
            await client.query(
                `
                SELECT
                    pi.id,
                    pi.image_url,
                    pi.is_primary
                FROM parking_images pi

                JOIN parking_spaces p
                    ON p.id =
                        pi.parking_space_id

                WHERE
                    pi.id = $1
                    AND pi.parking_space_id = $2
                    AND p.owner_id = $3

                LIMIT 1
                `,
                [
                    imageId,
                    parkingId,
                    ownerId,
                ]
            );


        if (
            result.rowCount === 0
        ) {

            await client.query(
                "ROLLBACK"
            );


            return res.status(404).json({
                status: "error",
                message:
                    "Parking image not found.",
            });
        }


        const image =
            result.rows[0];


        await client.query(
            `
            DELETE FROM parking_images
            WHERE id = $1
            `,
            [
                imageId
            ]
        );


        if (
            image.is_primary
        ) {

            await client.query(
                `
                UPDATE parking_images
                SET is_primary = TRUE
                WHERE id = (
                    SELECT id
                    FROM parking_images
                    WHERE parking_space_id = $1
                    ORDER BY created_at ASC
                    LIMIT 1
                )
                `,
                [
                    parkingId
                ]
            );
        }


        await client.query(
            "COMMIT"
        );


        const filename =
            path.basename(
                image.image_url
            );


        const diskPath =
            path.join(
                uploadDirectory,
                filename
            );


        try {

            if (
                fs.existsSync(
                    diskPath
                )
            ) {

                fs.unlinkSync(
                    diskPath
                );
            }

        } catch (fileError) {

            console.warn(
                "Parking image DB row deleted, but file cleanup failed:",
                fileError
            );
        }


        return res.json({
            status: "success",
            message:
                "Parking image deleted successfully.",
        });


    } catch (error) {

        try {
            await client.query(
                "ROLLBACK"
            );
        } catch (_) {}


        console.error(
            "Delete parking image error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to delete parking image.",
        });


    } finally {

        client.release();
    }
}

// =========================================================
// GET /api/owner/earnings
// OWNER EARNINGS + PAYMENT HISTORY
// =========================================================

async function getOwnerEarnings(
    req,
    res
) {

    try {

        const ownerId =
            req.user?.id;


        const parkingSpaceId =
            req.query.parking_space_id ||
            null;


        if (!ownerId) {

            return res
                .status(401)
                .json({
                    status:
                        "error",

                    message:
                        "Authentication required.",
                });
        }


        // ============================================
        // OPTIONAL PARKING-SPACE OWNERSHIP CHECK
        // ============================================

        if (parkingSpaceId) {

            const ownershipResult =
                await pool.query(
                    `
                        SELECT id
                        FROM parking_spaces

                        WHERE
                            id = $1
                            AND owner_id = $2

                        LIMIT 1
                    `,
                    [
                        parkingSpaceId,
                        ownerId,
                    ]
                );


            if (
                ownershipResult.rowCount ===
                0
            ) {

                return res
                    .status(404)
                    .json({
                        status:
                            "error",

                        message:
                            "Parking space not found.",
                    });
            }
        }


        const params =
            [ownerId];


        let parkingFilter =
            "";


        if (parkingSpaceId) {

            params.push(
                parkingSpaceId
            );


            parkingFilter = `
                AND p.id = $2
            `;
        }


        // ============================================
        // EARNINGS SUMMARY
        //
        // All day/month boundaries use India time.
        // Only successful PAID payment transactions
        // count as revenue.
        // ============================================

        const summaryResult =
            await pool.query(
                `
                    SELECT

                        COALESCE(
                            SUM(
                                CASE

                                    WHEN
                                        pay.status = 'paid'
                                        AND
                                        (
                                            pay.paid_at
                                            AT TIME ZONE
                                            'Asia/Kolkata'
                                        )::date
                                        =
                                        (
                                            NOW()
                                            AT TIME ZONE
                                            'Asia/Kolkata'
                                        )::date

                                    THEN
                                        pay.amount

                                    ELSE
                                        0

                                END
                            ),
                            0
                        )
                        AS today_earnings,


                        COALESCE(
                            SUM(
                                CASE

                                    WHEN
                                        pay.status = 'paid'
                                        AND
                                        DATE_TRUNC(
                                            'month',
                                            pay.paid_at
                                            AT TIME ZONE
                                            'Asia/Kolkata'
                                        )
                                        =
                                        DATE_TRUNC(
                                            'month',
                                            NOW()
                                            AT TIME ZONE
                                            'Asia/Kolkata'
                                        )

                                    THEN
                                        pay.amount

                                    ELSE
                                        0

                                END
                            ),
                            0
                        )
                        AS month_earnings,


                        COALESCE(
                            SUM(
                                CASE

                                    WHEN
                                        pay.status = 'paid'

                                    THEN
                                        pay.amount

                                    ELSE
                                        0

                                END
                            ),
                            0
                        )
                        AS total_paid_revenue,


                        COUNT(*) FILTER (
                            WHERE
                                pay.status = 'paid'
                        )::int
                        AS paid_transaction_count


                    FROM payments pay

                    JOIN bookings b
                        ON b.id =
                            pay.booking_id

                    JOIN parking_spaces p
                        ON p.id =
                            b.parking_space_id

                    WHERE
                        p.owner_id = $1

                        ${parkingFilter}
                `,
                params
            );


        const summary =
            summaryResult.rows[0] ||
            {};


        // ============================================
        // PAYMENT HISTORY
        // ============================================

        const historyResult =
            await pool.query(
                `
                    SELECT

                        pay.id,

                        pay.booking_id,

                        pay.provider,

                        pay.provider_order_id,

                        pay.provider_payment_id,

                        pay.amount,

                        pay.currency,

                        pay.status,

                        pay.payment_method,

                        pay.failure_reason,

                        pay.paid_at,

                        pay.created_at,


                        b.booking_reference,

                        b.status
                            AS booking_status,

                        b.payment_status
                            AS booking_payment_status,


                        p.id
                            AS parking_space_id,

                        p.name
                            AS parking_space_name,


                        u.id
                            AS driver_id,

                        u.name
                            AS driver_name,

                        u.phone
                            AS driver_phone


                    FROM payments pay

                    JOIN bookings b
                        ON b.id =
                            pay.booking_id

                    JOIN parking_spaces p
                        ON p.id =
                            b.parking_space_id

                    JOIN users u
                        ON u.id =
                            b.user_id

                    WHERE
                        p.owner_id = $1

                        ${parkingFilter}

                    ORDER BY

                        COALESCE(
                            pay.paid_at,
                            pay.created_at
                        )
                        DESC

                    LIMIT 50
                `,
                params
            );


        const transactions =
            historyResult.rows.map(
                row => ({
                    ...row,

                    amount:
                        Number(
                            row.amount
                        ) || 0,
                })
            );


        return res.json({
            status:
                "success",

            parking_space_id:
                parkingSpaceId,

            summary: {

                today_earnings:
                    Number(
                        summary.today_earnings
                    ) || 0,

                month_earnings:
                    Number(
                        summary.month_earnings
                    ) || 0,

                total_paid_revenue:
                    Number(
                        summary.total_paid_revenue
                    ) || 0,

                paid_transaction_count:
                    Number(
                        summary.paid_transaction_count
                    ) || 0,
            },

            transactions,
        });


    } catch (error) {

        console.error(
            "Get owner earnings error:",
            error
        );


        return res
            .status(500)
            .json({
                status:
                    "error",

                message:
                    "Unable to load owner earnings.",
            });
    }
}

module.exports = {
    createParkingSpace,
    getOwnerParkingSpaces,
    updateParkingSpaceDetails,
    updateParkingAvailability,
    updateParkingPricing,

    getOwnerOperatingHours,
    updateOwnerOperatingHours,

    getOwnerParkingImages,
    uploadOwnerParkingImages,
    setPrimaryParkingImage,
    deleteOwnerParkingImage,

    getOwnerBookings,
    updateOwnerBookingStatus,
    getOwnerEarnings,
};
