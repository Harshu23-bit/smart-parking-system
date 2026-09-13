const pool =
    require("../config/db");


function getBayColumn(
    bayType
) {
    const map = {
        standard:
            "standard_bays",

        compact:
            "compact_bays",

        ev:
            "ev_bays",

        motorcycle:
            "motorcycle_bays",

        scooter:
            "scooter_bays",
    };

    return map[bayType] || null;
}


function getBayTypeForVehicle(
    vehicle
) {

    if (!vehicle) {
        return null;
    }


    const vehicleType =
        String(
            vehicle.vehicle_type || ""
        )
        .trim()
        .toLowerCase();


    const fuelType =
        String(
            vehicle.fuel_type || ""
        )
        .trim()
        .toLowerCase();


    // ----------------------------------------
    // TWO WHEELERS
    // ----------------------------------------

    if (
        vehicleType === "motorcycle" ||
        vehicleType === "bike"
    ) {
        return "motorcycle";
    }


    if (
        vehicleType === "scooter"
    ) {
        return "scooter";
    }


    // ----------------------------------------
    // ELECTRIC CAR
    // ----------------------------------------

    if (
        vehicleType === "car" &&
        (
            fuelType === "electric" ||
            fuelType === "ev"
        )
    ) {
        return "ev";
    }


    // ----------------------------------------
    // NORMAL CAR
    //
    // Petrol / diesel / CNG / hybrid cars
    // use the normal car parking pool.
    // ----------------------------------------

    if (
        vehicleType === "car"
    ) {
        return "standard";
    }


    return null;
}


async function validateVehicleOwnership(
    client,
    userId,
    vehicleId
) {

    const result =
        await client.query(
            `
            SELECT *
            FROM user_vehicles
            WHERE
                id = $1
                AND user_id = $2
            `,
            [
                vehicleId,
                userId,
            ]
        );


    return result.rows[0] || null;
}


async function getParkingSpace(
    client,
    parkingSpaceId
) {

    const result =
        await client.query(
            `
            SELECT *
            FROM parking_spaces
            WHERE id = $1
            `,
            [
                parkingSpaceId
            ]
        );


    return result.rows[0] || null;
}


// =========================================================
// STALE PENDING BOOKING EXPIRY
// =========================================================

const BOOKING_PAYMENT_WINDOW_MINUTES =
    15;


async function expireStalePendingBookings(
    queryable = pool,
    {
        userId = null,
        bookingId = null,
        parkingSpaceId = null,
    } = {}
) {

    const result =
        await queryable.query(
            `
                UPDATE bookings

                SET
                    status =
                        'expired',

                    updated_at =
                        NOW()

                WHERE
                    status =
                        'pending'

                    AND payment_status IN (
                        'unpaid',
                        'pending',
                        'failed'
                    )

                    AND created_at <=
                        NOW() -
                        (
                            $1::int *
                            INTERVAL '1 minute'
                        )

                    AND (
                        $2::uuid IS NULL
                        OR user_id = $2
                    )

                    AND (
                        $3::uuid IS NULL
                        OR id = $3
                    )

                    AND (
                        $4::uuid IS NULL
                        OR parking_space_id = $4
                    )

                RETURNING
                    id,
                    booking_reference,
                    user_id,
                    parking_space_id,
                    status,
                    payment_status,
                    created_at
            `,
            [
                BOOKING_PAYMENT_WINDOW_MINUTES,
                userId,
                bookingId,
                parkingSpaceId,
            ]
        );


    return result.rows;
}


async function countOverlappingBookings(
    client,
    parkingSpaceId,
    bayType,
    startTime,
    endTime
) {

    // Before counting capacity, release any
    // abandoned 15-minute payment holds.

    await expireStalePendingBookings(
        client,
        {
            parkingSpaceId,
        }
    );

    const result =
        await client.query(
            `
            SELECT COUNT(*)::int
                AS booking_count
            FROM bookings
            WHERE
                parking_space_id = $1
                AND reserved_bay_type = $2
                AND (
                    status IN (
                        'confirmed',
                        'active'
                    )

                    OR (
                        status = 'pending'

                        AND created_at >
                            NOW() -
                            (
                                15 *
                                INTERVAL '1 minute'
                            )
                    )
                )
                AND start_time < $4
                AND end_time > $3
            `,
            [
                parkingSpaceId,
                bayType,
                startTime,
                endTime,
            ]
        );


    return result.rows[0]
        .booking_count;
}


async function verifyBayAvailability(
    client,
    parkingSpace,
    bayType,
    startTime,
    endTime
) {

    const bayColumn =
        getBayColumn(
            bayType
        );


    if (!bayColumn) {
        return {
            available: false,
            reason:
                "Invalid bay type.",
        };
    }


    const capacity =
        Number(
            parkingSpace[
                bayColumn
            ]
        ) || 0;


    if (capacity <= 0) {
        return {
            available: false,
            reason:
                `No ${bayType} bays are configured for this parking space.`,
        };
    }


    const bookingCount =
        await countOverlappingBookings(
            client,
            parkingSpace.id,
            bayType,
            startTime,
            endTime
        );


    return {
        available:
            bookingCount <
            capacity,

        bay_type:
            bayType,

        bay_capacity:
            capacity,

        bay_booked:
            bookingCount,

        bay_remaining:
            Math.max(
                capacity -
                bookingCount,
                0
            ),

        total_parking_capacity:
            Number(
                parkingSpace.capacity
            ) || 0,
    };
}


function getIstParts(
    value
) {

    const formatter =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    "Asia/Kolkata",

                year:
                    "numeric",

                month:
                    "2-digit",

                day:
                    "2-digit",

                hour:
                    "2-digit",

                minute:
                    "2-digit",

                hourCycle:
                    "h23",

                weekday:
                    "short",
            }
        );


    const parts =
        Object.fromEntries(
            formatter
                .formatToParts(
                    new Date(value)
                )
                .filter(
                    part =>
                        part.type !==
                        "literal"
                )
                .map(
                    part => [
                        part.type,
                        part.value,
                    ]
                )
        );


    const weekdayMap = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };


    return {
        year:
            Number(
                parts.year
            ),

        month:
            Number(
                parts.month
            ),

        day:
            Number(
                parts.day
            ),

        hour:
            Number(
                parts.hour
            ),

        minute:
            Number(
                parts.minute
            ),

        dayOfWeek:
            weekdayMap[
                parts.weekday
            ],
    };
}


function istLocalToUtc(
    year,
    month,
    day,
    time
) {

    const [
        hour,
        minute
    ] =
        String(time)
            .split(":")
            .map(Number);


    // IST = UTC +05:30
    return new Date(
        Date.UTC(
            year,
            month - 1,
            day,
            hour,
            minute
        ) -
        (
            5.5 *
            60 *
            60 *
            1000
        )
    );
}


function addLocalDays(
    year,
    month,
    day,
    amount
) {

    const date =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day + amount
            )
        );


    return {
        year:
            date.getUTCFullYear(),

        month:
            date.getUTCMonth() +
            1,

        day:
            date.getUTCDate(),

        dayOfWeek:
            date.getUTCDay(),
    };
}


async function verifyOperatingHours(
    client,
    parkingSpaceId,
    startTime,
    endTime
) {

    const result =
        await client.query(
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
                parkingSpaceId
            ]
        );


    // Backward compatibility:
    // if old development data has no rows,
    // do not break bookings.
    if (
        result.rowCount === 0
    ) {

        return {
            allowed:
                true,
        };
    }


    const hoursByDay =
        new Map(
            result.rows.map(
                row => [
                    Number(
                        row.day_of_week
                    ),
                    row,
                ]
            )
        );


    const start =
        new Date(
            startTime
        );


    const end =
        new Date(
            endTime
        );


    const startParts =
        getIstParts(
            start
        );


    const intervals = [];


    // Include previous day because an overnight
    // schedule such as 19:00 -> 07:00 may cover
    // the start of the requested booking.
    for (
        let offset = -1;
        offset <= 8;
        offset += 1
    ) {

        const localDay =
            addLocalDays(
                startParts.year,
                startParts.month,
                startParts.day,
                offset
            );


        const schedule =
            hoursByDay.get(
                localDay.dayOfWeek
            );


        if (
            !schedule ||
            schedule.is_closed
        ) {
            continue;
        }


        const opening =
            String(
                schedule.opening_time
            ).slice(
                0,
                5
            );


        const closing =
            String(
                schedule.closing_time
            ).slice(
                0,
                5
            );


        let intervalStart =
            istLocalToUtc(
                localDay.year,
                localDay.month,
                localDay.day,
                opening
            );


        let intervalEnd;


        // 00:00 -> 00:00 means open for 24 hours.
        if (
            opening ===
            closing
        ) {

            const tomorrow =
                addLocalDays(
                    localDay.year,
                    localDay.month,
                    localDay.day,
                    1
                );


            intervalEnd =
                istLocalToUtc(
                    tomorrow.year,
                    tomorrow.month,
                    tomorrow.day,
                    closing
                );

        } else {

            const [
                openHour,
                openMinute
            ] =
                opening
                    .split(":")
                    .map(Number);


            const [
                closeHour,
                closeMinute
            ] =
                closing
                    .split(":")
                    .map(Number);


            const overnight =
                closeHour <
                    openHour ||
                (
                    closeHour ===
                        openHour &&
                    closeMinute <
                        openMinute
                );


            const closingDay =
                overnight
                    ? addLocalDays(
                        localDay.year,
                        localDay.month,
                        localDay.day,
                        1
                    )
                    : localDay;


            intervalEnd =
                istLocalToUtc(
                    closingDay.year,
                    closingDay.month,
                    closingDay.day,
                    closing
                );
        }


        intervals.push({
            start:
                intervalStart,

            end:
                intervalEnd,
        });
    }


    intervals.sort(
        (a, b) =>
            a.start -
            b.start
    );


    let coveredUntil =
        start;


    for (
        const interval of
        intervals
    ) {

        if (
            interval.end <=
            coveredUntil
        ) {
            continue;
        }


        if (
            interval.start >
            coveredUntil
        ) {

            return {
                allowed:
                    false,

                reason:
                    "The selected booking time is outside this parking space's operating hours.",
            };
        }


        if (
            interval.end >
            coveredUntil
        ) {

            coveredUntil =
                interval.end;
        }


        if (
            coveredUntil >=
            end
        ) {

            return {
                allowed:
                    true,
            };
        }
    }


    return {
        allowed:
            false,

        reason:
            "The selected booking time is outside this parking space's operating hours.",
    };
}


function calculateBookingAmount(
    parkingSpace,
    startTime,
    endTime
) {

    const milliseconds =
        new Date(endTime) -
        new Date(startTime);


    const hours =
        milliseconds /
        (
            1000 *
            60 *
            60
        );


    const billableHours =
        Math.ceil(
            hours
        );


    const hourlyRate =
        Number(
            parkingSpace
                .price_per_hour
        );


    let total =
        billableHours *
        hourlyRate;


    const dailyMax =
        parkingSpace.daily_max !== null
            ? Number(
                parkingSpace.daily_max
            )
            : null;


    if (
        dailyMax !== null &&
        billableHours <= 24
    ) {
        total =
            Math.min(
                total,
                dailyMax
            );
    }


    return {
        billableHours,
        hourlyRate,
        totalAmount:
            Number(
                total.toFixed(2)
            ),
    };
}


function generateBookingReference() {

    const date =
        Date.now()
            .toString(36)
            .toUpperCase();


    const random =
        Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();


    return `PS-${date}-${random}`;
}


module.exports = {
    validateVehicleOwnership,
    getParkingSpace,
    getBayTypeForVehicle,
    verifyBayAvailability,
    verifyOperatingHours,
    calculateBookingAmount,
    generateBookingReference,
    expireStalePendingBookings,
};