const pool =
    require("../config/db");

const {
    validateVehicleOwnership,
    getParkingSpace,
    getBayTypeForVehicle,
    verifyBayAvailability,
    calculateBookingAmount,
    generateBookingReference,
    verifyOperatingHours,
    expireStalePendingBookings,
} =
    require(
        "../services/booking.service"
    );

const {
    createGatewayRefund,
} =
    require(
        "../services/payment.service"
    );

async function createBooking(
    req,
    res
) {
    const client =
        await pool.connect();

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
            parking_space_id,
            vehicle_id,
            start_time,
            end_time,
        } = req.body || {};


        if (
            !parking_space_id ||
            !vehicle_id ||
            !start_time ||
            !end_time
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Parking space, vehicle, booking time are required.",
            });
        }


        const startTime =
            new Date(
                start_time
            );

        const endTime =
            new Date(
                end_time
            );


        if (
            Number.isNaN(
                startTime.getTime()
            ) ||
            Number.isNaN(
                endTime.getTime()
            ) ||
            endTime <= startTime
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Invalid booking time range.",
            });
        }


        if (
            startTime <=
            new Date()
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Booking start time must be in the future.",
            });
        }


        await client.query(
            "BEGIN"
        );


        const vehicle =
            await validateVehicleOwnership(
                client,
                userId,
                vehicle_id
            );


        if (!vehicle) {

            await client.query(
                "ROLLBACK"
            );

            return res.status(403).json({
                status: "error",
                message:
                    "You cannot book using this vehicle.",
            });
        }


        const parkingSpace =
            await getParkingSpace(
                client,
                parking_space_id
            );


        if (!parkingSpace) {

            await client.query(
                "ROLLBACK"
            );

            return res.status(404).json({
                status: "error",
                message:
                    "Parking space not found.",
            });
        }


        if (
            parkingSpace.status !==
                "active" ||
            parkingSpace.is_available !==
                true
        ) {

            await client.query(
                "ROLLBACK"
            );

            return res.status(409).json({
                status: "error",
                message:
                    "This parking space is currently unavailable.",
            });
        }


        const reservedBayType =
            getBayTypeForVehicle(
                vehicle
            );


        if (!reservedBayType) {

            await client.query(
                "ROLLBACK"
            );


            return res.status(400).json({
                status: "error",
                message:
                    "This vehicle type is not supported for automatic parking allocation.",
            });
        }


        const availability =
            await verifyBayAvailability(
                client,
                parkingSpace,
                reservedBayType,
                startTime,
                endTime
            );


        if (
            !availability.available
        ) {

            await client.query(
                "ROLLBACK"
            );

            return res.status(409).json({
                status: "error",
                message:
                    availability.reason ||
                    "No matching parking bays are available for this time period.",
            });
        }

        const operatingHoursCheck =
            await verifyOperatingHours(
                client,
                parkingSpace.id,
                startTime,
                endTime
            );


        if (
            !operatingHoursCheck.allowed
        ) {

            await client.query(
                "ROLLBACK"
            );


            return res.status(409).json({
                status:
                    "error",

                message:
                    operatingHoursCheck.reason ||
                    "The selected booking time is outside the parking operating hours.",
            });
        }

        const pricing =
            calculateBookingAmount(
                parkingSpace,
                startTime,
                endTime
            );


        const bookingReference =
            generateBookingReference();


        const result =
            await client.query(
                `
                INSERT INTO bookings (
                    user_id,
                    parking_space_id,
                    vehicle_id,
                    booking_reference,
                    start_time,
                    end_time,
                    reserved_bay_type,
                    hourly_rate_snapshot,
                    total_amount,
                    status,
                    payment_status
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
                    'pending',
                    'unpaid'
                )
                RETURNING *
                `,
                [
                    userId,
                    parking_space_id,
                    vehicle_id,
                    bookingReference,
                    startTime,
                    endTime,
                    reservedBayType,
                    pricing.hourlyRate,
                    pricing.totalAmount,
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
                    "Booking created. Payment is required to confirm it.",
                booking:
                    result.rows[0],
                pricing,
                availability,
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
            "Create booking error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to create booking.",
        });


    } finally {

        client.release();
    }
}


async function getMyBookings(
    req,
    res
) {
    try {

        const userId =
            req.user?.id;


        await expireStalePendingBookings(
            pool,
            {
                userId,
            }
        );


        const result =
            await pool.query(
                `
                SELECT
                    b.*,

                    p.name
                        AS parking_name,

                    p.address
                        AS parking_address,

                    p.city
                        AS parking_city,

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

                JOIN user_vehicles v
                    ON v.id =
                        b.vehicle_id

                WHERE
                    b.user_id = $1

                ORDER BY
                    b.created_at DESC
                `,
                [userId]
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
            "Get my bookings error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to load bookings.",
        });
    }
}


// =========================================================
// POST /api/bookings/:id/cancel
// USER BOOKING CANCELLATION + REFUND
// =========================================================

async function cancelBooking(
    req,
    res
) {

    const userId =
        req.user?.id;


    const bookingId =
        req.params.id;


    const cleanReason =
        typeof req.body?.reason ===
            "string"
            ? req.body.reason
                .trim()
                .slice(
                    0,
                    500
                )
            : "";


    const cancellationReason =
        cleanReason ||
        "Cancelled by user.";


    if (!userId) {

        return res.status(401).json({
            status: "error",
            message:
                "Authentication required.",
        });
    }


    try {

        // ========================================
        // LOAD USER-OWNED BOOKING
        // ========================================

        const bookingResult =
            await pool.query(
                `
                    SELECT
                        b.*,

                        p.name
                            AS parking_name

                    FROM bookings b

                    JOIN parking_spaces p
                        ON p.id =
                            b.parking_space_id

                    WHERE
                        b.id = $1
                        AND b.user_id = $2

                    LIMIT 1
                `,
                [
                    bookingId,
                    userId,
                ]
            );


        const booking =
            bookingResult.rows[0];


        if (!booking) {

            return res.status(404).json({
                status: "error",
                message:
                    "Booking not found.",
            });
        }


        // ========================================
        // IDEMPOTENT ALREADY-CANCELLED RESPONSE
        // ========================================

        if (
            booking.status ===
            "cancelled"
        ) {

            return res.json({
                status: "success",
                message:
                    "Booking is already cancelled.",
                booking,
            });
        }


        // ========================================
        // INVALID CANCELLATION STATES
        // ========================================

        if (
            booking.status ===
                "active" ||
            booking.status ===
                "completed" ||
            booking.status ===
                "expired"
        ) {

            return res.status(409).json({
                status: "error",
                message:
                    "This booking can no longer be cancelled.",
            });
        }


        // ========================================
        // CANCELLATION MUST BE BEFORE START TIME
        // ========================================

        const startTime =
            new Date(
                booking.start_time
            );


        if (
            startTime <=
            new Date()
        ) {

            return res.status(409).json({
                status: "error",
                message:
                    "A booking cannot be cancelled after its scheduled start time.",
            });
        }


        // ========================================
        // UNPAID / FAILED BOOKING
        //
        // No gateway refund is necessary.
        // ========================================

        if (
            booking.payment_status !==
            "paid"
        ) {

            const result =
                await pool.query(
                    `
                        UPDATE bookings

                        SET
                            status =
                                'cancelled',

                            cancellation_reason =
                                $1,

                            cancelled_at =
                                NOW(),

                            updated_at =
                                NOW()

                        WHERE
                            id = $2
                            AND user_id = $3

                        RETURNING *
                    `,
                    [
                        cancellationReason,
                        bookingId,
                        userId,
                    ]
                );


            return res.json({
                status: "success",

                message:
                    "Booking cancelled successfully. No refund was required.",

                refund_required:
                    false,

                booking:
                    result.rows[0],
            });
        }


        // ========================================
        // PAID BOOKING
        //
        // Locate the successfully paid gateway
        // transaction.
        // ========================================

        const paymentResult =
            await pool.query(
                `
                    SELECT *

                    FROM payments

                    WHERE
                        booking_id = $1

                        AND provider =
                            'razorpay'

                        AND status =
                            'paid'

                        AND provider_payment_id
                            IS NOT NULL

                    ORDER BY
                        paid_at DESC,
                        created_at DESC

                    LIMIT 1
                `,
                [
                    bookingId
                ]
            );


        const payment =
            paymentResult.rows[0];


        if (!payment) {

            return res.status(409).json({
                status: "error",

                message:
                    "Paid booking has no refundable Razorpay payment record.",
            });
        }


        // ========================================
        // CHECK EXISTING REFUND
        // ========================================

        const existingRefundResult =
            await pool.query(
                `
                    SELECT *

                    FROM payment_refunds

                    WHERE
                        payment_id = $1

                    LIMIT 1
                `,
                [
                    payment.id
                ]
            );


        const existingRefund =
            existingRefundResult.rows[0];


        if (
            existingRefund &&
            (
                existingRefund.status ===
                    "processed" ||

                (
                    existingRefund.status ===
                        "pending" &&
                    existingRefund
                        .provider_refund_id
                )
            )
        ) {

            return res.json({
                status: "success",

                message:
                    existingRefund.status ===
                        "processed"
                        ? "Booking refund was already processed."
                        : "Booking refund is already being processed.",

                refund_required:
                    true,

                refund:
                    existingRefund,

                booking,
            });
        }


        // ========================================
        // CREATE / RESET LOCAL REFUND REQUEST
        //
        // The UNIQUE(payment_id) constraint prevents
        // simultaneous duplicate refund records.
        // ========================================

        const refundRowResult =
            await pool.query(
                `
                    INSERT INTO payment_refunds (
                        payment_id,
                        booking_id,
                        requested_by_user_id,
                        provider,
                        amount,
                        currency,
                        status,
                        reason,
                        failure_reason
                    )

                    VALUES (
                        $1,
                        $2,
                        $3,
                        'razorpay',
                        $4,
                        $5,
                        'requested',
                        $6,
                        NULL
                    )

                    ON CONFLICT (
                        payment_id
                    )

                    DO UPDATE SET
                        requested_by_user_id =
                            EXCLUDED.requested_by_user_id,

                        status =
                            'requested',

                        reason =
                            EXCLUDED.reason,

                        failure_reason =
                            NULL,

                        updated_at =
                            NOW()

                    RETURNING *
                `,
                [
                    payment.id,
                    booking.id,
                    userId,
                    Number(
                        payment.amount
                    ),
                    payment.currency ||
                        "INR",
                    cancellationReason,
                ]
            );


        const localRefund =
            refundRowResult.rows[0];


        let gatewayRefund;


        try {

            // ====================================
            // REAL RAZORPAY TEST-MODE REFUND
            // ====================================

            gatewayRefund =
                await createGatewayRefund({

                    paymentId:
                        payment
                            .provider_payment_id,

                    amount:
                        Number(
                            payment.amount
                        ),

                    idempotencyKey:
                        localRefund.id,

                    notes: {
                        booking_id:
                            booking.id,

                        booking_reference:
                            booking
                                .booking_reference,

                        reason:
                            cancellationReason
                                .slice(
                                    0,
                                    250
                                ),
                    },
                });


        } catch (refundError) {

            await pool.query(
                `
                    UPDATE payment_refunds

                    SET
                        status =
                            'failed',

                        failure_reason =
                            $1,

                        updated_at =
                            NOW()

                    WHERE
                        id = $2
                `,
                [
                    refundError
                        ?.error
                        ?.description ||
                    refundError.message ||
                    "Razorpay refund request failed.",

                    localRefund.id,
                ]
            );


            console.error(
                "Razorpay refund error:",
                refundError
            );


            return res
                .status(502)
                .json({
                    status:
                        "error",

                    message:
                        "The booking was not cancelled because the payment refund could not be started.",
                });
        }


        // ========================================
        // NORMALIZE RAZORPAY REFUND STATUS
        // ========================================

        const gatewayStatus =
            String(
                gatewayRefund?.status ||
                ""
            )
                .trim()
                .toLowerCase();


        if (
            ![
                "pending",
                "processed",
            ].includes(
                gatewayStatus
            )
        ) {

            await pool.query(
                `
                    UPDATE payment_refunds

                    SET
                        provider_refund_id =
                            $1,

                        status =
                            'failed',

                        failure_reason =
                            $2,

                        updated_at =
                            NOW()

                    WHERE
                        id = $3
                `,
                [
                    gatewayRefund?.id ||
                        null,

                    `Unexpected Razorpay refund status: ${
                        gatewayStatus ||
                        "unknown"
                    }`,

                    localRefund.id,
                ]
            );


            return res.status(502).json({
                status: "error",

                message:
                    "Razorpay did not accept the refund.",
            });
        }


        const refundProcessed =
            gatewayStatus ===
            "processed";


        const client =
            await pool.connect();


        try {

            await client.query(
                "BEGIN"
            );


            // ====================================
            // SAVE REFUND RESPONSE
            // ====================================

            const savedRefundResult =
            await client.query(
                `
                    UPDATE payment_refunds

                    SET
                        provider_refund_id =
                            $1,

                        status =
                            $2::varchar(30),

                        processed_at =
                            CASE

                                WHEN $3
                                THEN
                                    NOW()

                                ELSE
                                    NULL

                            END,

                        failure_reason =
                            NULL,

                        updated_at =
                            NOW()

                    WHERE
                        id = $4

                    RETURNING *
                `,
                [
                    gatewayRefund.id,
                    gatewayStatus,
                    refundProcessed,
                    localRefund.id,
                ]
            );


            // ====================================
            // PAYMENT LEDGER
            // ====================================

            await client.query(
                `
                    UPDATE payments

                    SET
                        status =
                            $1,

                        updated_at =
                            NOW()

                    WHERE
                        id = $2
                `,
                [
                    refundProcessed
                        ? "refunded"
                        : "refund_pending",

                    payment.id,
                ]
            );


            // ====================================
            // CANCEL BOOKING
            // ====================================

            const cancelledBookingResult =
                await client.query(
                    `
                        UPDATE bookings

                        SET
                            status =
                                'cancelled',

                            payment_status =
                                $1,

                            cancellation_reason =
                                $2,

                            cancelled_at =
                                NOW(),

                            updated_at =
                                NOW()

                        WHERE
                            id = $3
                            AND user_id = $4

                        RETURNING *
                    `,
                    [
                        refundProcessed
                            ? "refunded"
                            : "refund_pending",

                        cancellationReason,

                        booking.id,
                        userId,
                    ]
                );


            await client.query(
                "COMMIT"
            );


            return res.json({
                status:
                    "success",

                message:
                    refundProcessed
                        ? "Booking cancelled and refund processed successfully."
                        : "Booking cancelled. Your refund is being processed.",

                refund_required:
                    true,

                refund:
                    savedRefundResult.rows[0],

                booking:
                    cancelledBookingResult
                        .rows[0],
            });


        } catch (error) {

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (_) {}


            throw error;


        } finally {

            client.release();
        }


    } catch (error) {

        console.error(
            "Cancel booking error:",
            error
        );


        return res.status(500).json({
            status: "error",

            message:
                "Unable to cancel booking.",
        });
    }
}


module.exports = {
    createBooking,
    getMyBookings,
    cancelBooking,
};