const pool =
    require("../config/db");

const {
    toPaise,
    createGatewayOrder,
    verifyCheckoutSignature,
    fetchGatewayPayment,
    verifyWebhookSignature,
} =
    require(
        "../services/payment.service"
    );


// ============================================
// CREATE PAYMENT ORDER
// ============================================

async function createPaymentOrder(
    req,
    res
) {

    const userId =
        req.user?.id;

    const {
        booking_id,
    } =
        req.body || {};


    if (!userId) {

        return res
            .status(401)
            .json({
                status:
                    "error",

                message:
                    "Authentication required.",
            });
    }


    if (!booking_id) {

        return res
            .status(400)
            .json({
                status:
                    "error",

                message:
                    "Booking ID is required.",
            });
    }


    try {

        // ====================================
        // EXPIRE STALE PAYMENT WINDOW
        // ====================================

        await pool.query(
            `
                UPDATE bookings

                SET
                    status =
                        'expired',

                    updated_at =
                        NOW()

                WHERE
                    id = $1

                    AND user_id = $2

                    AND status =
                        'pending'

                    AND payment_status IN (
                        'unpaid',
                        'pending',
                        'failed'
                    )

                    AND created_at <=
                        NOW() -
                        INTERVAL '15 minutes'
            `,
            [
                booking_id,
                userId,
            ]
        );

        // ====================================
        // LOAD USER'S BOOKING
        // ====================================

        const bookingResult =
            await pool.query(
                `
                    SELECT
                        b.id,
                        b.user_id,
                        b.booking_reference,
                        b.total_amount,
                        b.status,
                        b.payment_status,
                        b.start_time,
                        b.end_time,
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
                    booking_id,
                    userId,
                ]
            );


        const booking =
            bookingResult.rows[0];


        if (!booking) {

            return res
                .status(404)
                .json({
                    status:
                        "error",

                    message:
                        "Booking not found.",
                });
        }


        // ====================================
        // BOOKING MUST STILL BE PAYABLE
        // ====================================

        if (
            booking.status ===
                "cancelled" ||
            booking.status ===
                "expired"
        ) {

            return res
                .status(409)
                .json({
                    status:
                        "error",

                    message:
                        "This booking can no longer be paid.",
                });
        }


        if (
            booking.payment_status ===
            "paid"
        ) {

            return res
                .status(409)
                .json({
                    status:
                        "error",

                    message:
                        "This booking is already paid.",
                });
        }


        const amount =
            Number(
                booking.total_amount
            );


        if (
            !Number.isFinite(
                amount
            ) ||
            amount <= 0
        ) {

            return res
                .status(409)
                .json({
                    status:
                        "error",

                    message:
                        "This booking has an invalid payment amount.",
                });
        }


        // ====================================
        // REUSE EXISTING OPEN PAYMENT ORDER
        //
        // Prevents creating another Razorpay
        // order every time Pay is clicked.
        // ====================================

        const existingResult =
            await pool.query(
                `
                    SELECT *
                    FROM payments

                    WHERE
                        booking_id = $1
                        AND provider =
                            'razorpay'

                        AND provider_order_id
                            IS NOT NULL

                        AND status IN (
                            'created',
                            'attempted',
                            'authorized'
                        )

                    ORDER BY
                        created_at DESC

                    LIMIT 1
                `,
                [
                    booking.id
                ]
            );


        const existingPayment =
            existingResult.rows[0];


        if (existingPayment) {

            return res.json({
                status:
                    "success",

                message:
                    "Existing payment order loaded.",

                payment: {
                    id:
                        existingPayment.id,

                    booking_id:
                        booking.id,

                    provider_order_id:
                        existingPayment
                            .provider_order_id,

                    amount:
                        Number(
                            existingPayment
                                .amount
                        ),

                    amount_paise:
                        toPaise(
                            existingPayment
                                .amount
                        ),

                    currency:
                        existingPayment
                            .currency,

                    key_id:
                        process.env
                            .RAZORPAY_KEY_ID,
                },

                booking: {
                    id:
                        booking.id,

                    booking_reference:
                        booking
                            .booking_reference,

                    parking_name:
                        booking
                            .parking_name,
                },
            });
        }


        // ====================================
        // CREATE RAZORPAY ORDER
        // ====================================

        const gatewayOrder =
            await createGatewayOrder({

                amount,

                currency:
                    "INR",

                receipt:
                    booking
                        .booking_reference,

                notes: {
                    booking_id:
                        booking.id,

                    booking_reference:
                        booking
                            .booking_reference,
                },
            });


        // ====================================
        // SAVE OUR PAYMENT RECORD
        // ====================================

        const client =
            await pool.connect();


        try {

            await client.query(
                "BEGIN"
            );


            const paymentResult =
                await client.query(
                    `
                        INSERT INTO payments (
                            booking_id,
                            provider,
                            provider_order_id,
                            amount,
                            currency,
                            status
                        )

                        VALUES (
                            $1,
                            'razorpay',
                            $2,
                            $3,
                            $4,
                            'created'
                        )

                        RETURNING *
                    `,
                    [
                        booking.id,
                        gatewayOrder.id,
                        amount,
                        gatewayOrder.currency ||
                            "INR",
                    ]
                );


            await client.query(
                `
                    UPDATE bookings

                    SET
                        payment_status =
                            'pending',

                        updated_at =
                            NOW()

                    WHERE
                        id = $1
                        AND user_id = $2
                        AND payment_status
                            <> 'paid'
                `,
                [
                    booking.id,
                    userId,
                ]
            );


            await client.query(
                "COMMIT"
            );


            const payment =
                paymentResult.rows[0];


            return res
                .status(201)
                .json({
                    status:
                        "success",

                    message:
                        "Payment order created.",

                    payment: {
                        id:
                            payment.id,

                        booking_id:
                            booking.id,

                        provider_order_id:
                            gatewayOrder.id,

                        amount:
                            amount,

                        amount_paise:
                            Number(
                                gatewayOrder.amount
                            ),

                        currency:
                            gatewayOrder.currency ||
                            "INR",

                        key_id:
                            process.env
                                .RAZORPAY_KEY_ID,
                    },

                    booking: {
                        id:
                            booking.id,

                        booking_reference:
                            booking
                                .booking_reference,

                        parking_name:
                            booking
                                .parking_name,
                    },
                });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (_) {
                // Ignore rollback failure.
            }


            throw error;


        } finally {

            client.release();
        }


    } catch (error) {

        console.error(
            "Create payment order error:",
            error
        );


        return res
            .status(500)
            .json({
                status:
                    "error",

                message:
                    "Unable to create payment order.",
            });
    }
}


// ============================================
// VERIFY SUCCESSFUL CHECKOUT PAYMENT
// ============================================

async function verifyPayment(
    req,
    res
) {

    const userId =
        req.user?.id;


    const {
        booking_id,
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
    } =
        req.body || {};


    if (!userId) {

        return res
            .status(401)
            .json({
                status:
                    "error",

                message:
                    "Authentication required.",
            });
    }


    if (
        !booking_id ||
        !razorpay_payment_id ||
        !razorpay_order_id ||
        !razorpay_signature
    ) {

        return res
            .status(400)
            .json({
                status:
                    "error",

                message:
                    "Incomplete payment verification data.",
            });
    }


    try {

        // ====================================
        // LOAD OUR STORED ORDER
        // ====================================

        const result =
            await pool.query(
                `
                    SELECT
                        pay.*,

                        b.user_id,

                        b.status
                            AS booking_status,

                        b.payment_status
                            AS booking_payment_status,

                        b.booking_reference

                    FROM payments pay

                    JOIN bookings b
                        ON b.id =
                            pay.booking_id

                    WHERE
                        pay.booking_id = $1
                        AND b.user_id = $2
                        AND pay.provider =
                            'razorpay'

                        AND pay.provider_order_id =
                            $3

                    LIMIT 1
                `,
                [
                    booking_id,
                    userId,
                    razorpay_order_id,
                ]
            );


        const payment =
            result.rows[0];


        if (!payment) {

            return res
                .status(404)
                .json({
                    status:
                        "error",

                    message:
                        "Payment order not found.",
                });
        }


        // ====================================
        // IDEMPOTENT SUCCESS
        // ====================================

        if (
            payment.status ===
                "paid" &&
            payment.provider_payment_id ===
                razorpay_payment_id &&
            payment.booking_payment_status ===
                "paid"
        ) {

            return res.json({
                status:
                    "success",

                message:
                    "Payment was already verified.",

                booking_id:
                    booking_id,

                payment_status:
                    "paid",

                booking_status:
                    payment
                        .booking_status,
            });
        }


        // ====================================
        // VERIFY CRYPTOGRAPHIC SIGNATURE
        //
        // Use OUR stored provider order ID.
        // ====================================

        const validSignature =
            verifyCheckoutSignature({

                orderId:
                    payment
                        .provider_order_id,

                paymentId:
                    razorpay_payment_id,

                signature:
                    razorpay_signature,
            });


        if (!validSignature) {

            return res
                .status(400)
                .json({
                    status:
                        "error",

                    message:
                        "Payment signature verification failed.",
                });
        }


        // ====================================
        // VERIFY ACTUAL PAYMENT WITH RAZORPAY
        // ====================================

        const gatewayPayment =
            await fetchGatewayPayment(
                razorpay_payment_id
            );


        if (
            gatewayPayment.order_id !==
            payment.provider_order_id
        ) {

            return res
                .status(409)
                .json({
                    status:
                        "error",

                    message:
                        "Payment order mismatch.",
                });
        }


        const expectedAmountPaise =
            toPaise(
                payment.amount
            );


        if (
            Number(
                gatewayPayment.amount
            ) !==
            expectedAmountPaise
        ) {

            return res
                .status(409)
                .json({
                    status:
                        "error",

                    message:
                        "Payment amount mismatch.",
                });
        }


        if (
            String(
                gatewayPayment.currency
            ).toUpperCase() !==
            String(
                payment.currency
            ).toUpperCase()
        ) {

            return res
                .status(409)
                .json({
                    status:
                        "error",

                    message:
                        "Payment currency mismatch.",
                });
        }


        if (
            gatewayPayment.status !==
            "captured"
        ) {

            return res
                .status(409)
                .json({
                    status:
                        "error",

                    message:
                        `Payment is ${gatewayPayment.status || "not captured"} and cannot be confirmed yet.`,
                });
        }


        // ====================================
        // PAYMENT IS GENUINE + CAPTURED
        // ====================================

        const client =
            await pool.connect();


        try {

            await client.query(
                "BEGIN"
            );


            await client.query(
                `
                    UPDATE payments

                    SET
                        provider_payment_id =
                            $1,

                        status =
                            'paid',

                        payment_method =
                            $2,

                        failure_reason =
                            NULL,

                        paid_at =
                            COALESCE(
                                paid_at,
                                NOW()
                            ),

                        updated_at =
                            NOW()

                    WHERE
                        id = $3
                `,
                [
                    razorpay_payment_id,

                    gatewayPayment.method ||
                        null,

                    payment.id,
                ]
            );


            const bookingResult =
                await client.query(
                    `
                        UPDATE bookings

                        SET
                            payment_status =
                                'paid',

                            status =
                                CASE

                                    WHEN status =
                                        'pending'
                                    THEN
                                        'confirmed'

                                    ELSE
                                        status

                                END,

                            updated_at =
                                NOW()

                        WHERE
                            id = $1
                            AND user_id = $2

                        RETURNING *
                    `,
                    [
                        booking_id,
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
                    "Payment verified successfully.",

                booking:
                    bookingResult.rows[0],

                payment: {
                    id:
                        payment.id,

                    provider_payment_id:
                        razorpay_payment_id,

                    status:
                        "paid",

                    payment_method:
                        gatewayPayment.method ||
                        null,
                },
            });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (_) {
                // Ignore rollback failure.
            }


            throw error;


        } finally {

            client.release();
        }


    } catch (error) {

        console.error(
            "Verify payment error:",
            error
        );


        return res
            .status(500)
            .json({
                status:
                    "error",

                message:
                    "Unable to verify payment.",
            });
    }
}


// ============================================
// GET PAYMENT STATUS FOR USER'S BOOKING
// ============================================

async function getBookingPayment(
    req,
    res
) {

    const userId =
        req.user?.id;

    const bookingId =
        req.params
            .bookingId;


    try {

        const result =
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
                        pay.paid_at,
                        pay.created_at,

                        b.booking_reference,
                        b.status
                            AS booking_status,

                        b.payment_status
                            AS booking_payment_status

                    FROM bookings b

                    LEFT JOIN LATERAL (

                        SELECT *
                        FROM payments p

                        WHERE
                            p.booking_id =
                                b.id

                        ORDER BY
                            p.created_at DESC

                        LIMIT 1

                    ) pay
                        ON TRUE

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


        if (
            result.rowCount === 0
        ) {

            return res
                .status(404)
                .json({
                    status:
                        "error",

                    message:
                        "Booking not found.",
                });
        }


        return res.json({
            status:
                "success",

            payment:
                result.rows[0],
        });


    } catch (error) {

        console.error(
            "Get booking payment error:",
            error
        );


        return res
            .status(500)
            .json({
                status:
                    "error",

                message:
                    "Unable to load payment status.",
            });
    }
}


async function handleRazorpayWebhook(
    req,
    res
) {

    const signature =
        req.headers[
            "x-razorpay-signature"
        ];

    const eventId =
        req.headers[
            "x-razorpay-event-id"
        ];


    if (
        !signature ||
        !eventId
    ) {

        return res
            .status(400)
            .json({
                status: "error",
                message:
                    "Missing Razorpay webhook headers.",
            });
    }


    const rawBody =
        req.body;


    const validSignature =
        verifyWebhookSignature({
            rawBody,
            signature,
        });


    if (!validSignature) {

        return res
            .status(400)
            .json({
                status: "error",
                message:
                    "Invalid webhook signature.",
            });
    }


    let payload;


    try {

        payload =
            JSON.parse(
                rawBody.toString(
                    "utf8"
                )
            );

    } catch {

        return res
            .status(400)
            .json({
                status: "error",
                message:
                    "Invalid webhook payload.",
            });
    }


    const eventType =
        payload.event;


    const paymentEntity =
        payload
            ?.payload
            ?.payment
            ?.entity ||
        null;


    const refundEntity =
    payload
        ?.payload
        ?.refund
        ?.entity ||
    null;


    const orderId =
        paymentEntity
            ?.order_id ||
        payload
            ?.payload
            ?.order
            ?.entity
            ?.id ||
        null;


    const paymentId =
        paymentEntity
            ?.id ||
        refundEntity
            ?.payment_id ||
        null;


    const refundId =
        refundEntity
            ?.id ||
        null;


    const client =
        await pool.connect();


    try {

        await client.query(
            "BEGIN"
        );


        // ------------------------------------
        // IDEMPOTENCY
        // ------------------------------------

        const eventInsert =
            await client.query(
                `
                    INSERT INTO
                        payment_webhook_events (
                            provider,
                            provider_event_id,
                            event_type,
                            provider_order_id,
                            provider_payment_id
                        )

                    VALUES (
                        'razorpay',
                        $1,
                        $2,
                        $3,
                        $4
                    )

                    ON CONFLICT (
                        provider,
                        provider_event_id
                    )
                    DO NOTHING

                    RETURNING id
                `,
                [
                    eventId,
                    eventType,
                    orderId,
                    paymentId,
                ]
            );


        if (
            eventInsert.rowCount === 0
        ) {

            await client.query(
                "ROLLBACK"
            );


            return res.json({
                status: "success",
                message:
                    "Webhook already processed.",
            });
        }


        // ------------------------------------
        // PAYMENT CAPTURED / ORDER PAID
        // ------------------------------------

        if (
            eventType ===
                "payment.captured" ||
            eventType ===
                "order.paid"
        ) {

            if (
                !orderId ||
                !paymentId
            ) {

                throw new Error(
                    "Captured payment webhook is missing order or payment ID."
                );
            }


            const paymentResult =
                await client.query(
                    `
                        SELECT
                            p.*,
                            b.user_id,
                            b.status
                                AS booking_status,
                            b.payment_status
                                AS booking_payment_status

                        FROM payments p

                        JOIN bookings b
                            ON b.id =
                                p.booking_id

                        WHERE
                            p.provider =
                                'razorpay'

                            AND
                            p.provider_order_id =
                                $1

                        LIMIT 1
                    `,
                    [
                        orderId
                    ]
                );


            const payment =
                paymentResult.rows[0];


            if (payment) {

                const expectedAmount =
                    toPaise(
                        payment.amount
                    );


                const gatewayAmount =
                    Number(
                        paymentEntity
                            ?.amount
                    );


                const gatewayCurrency =
                    String(
                        paymentEntity
                            ?.currency ||
                        ""
                    ).toUpperCase();


                if (
                    gatewayAmount !==
                        expectedAmount ||
                    gatewayCurrency !==
                        String(
                            payment.currency
                        ).toUpperCase()
                ) {

                    throw new Error(
                        "Webhook payment amount or currency mismatch."
                    );
                }


                await client.query(
                    `
                        UPDATE payments

                        SET
                            provider_payment_id =
                                COALESCE(
                                    provider_payment_id,
                                    $1
                                ),

                            status =
                                'paid',

                            payment_method =
                                COALESCE(
                                    $2,
                                    payment_method
                                ),

                            failure_reason =
                                NULL,

                            paid_at =
                                COALESCE(
                                    paid_at,
                                    NOW()
                                ),

                            updated_at =
                                NOW()

                        WHERE
                            id = $3
                    `,
                    [
                        paymentId,
                        paymentEntity
                            ?.method ||
                            null,
                        payment.id,
                    ]
                );


                await client.query(
                    `
                        UPDATE bookings

                        SET
                            payment_status =
                                'paid',

                            status =
                                CASE

                                    WHEN status =
                                        'pending'
                                    THEN
                                        'confirmed'

                                    ELSE
                                        status

                                END,

                            updated_at =
                                NOW()

                        WHERE
                            id =
                                $1
                    `,
                    [
                        payment.booking_id
                    ]
                );
            }
        }


        // ------------------------------------
        // PAYMENT FAILED
        // ------------------------------------

        if (
            eventType ===
            "payment.failed"
        ) {

            if (orderId) {

                await client.query(
                    `
                        UPDATE payments

                        SET
                            provider_payment_id =
                                COALESCE(
                                    provider_payment_id,
                                    $1
                                ),

                            status =
                                CASE

                                    WHEN status =
                                        'paid'
                                    THEN
                                        status

                                    ELSE
                                        'failed'

                                END,

                            failure_reason =
                                CASE

                                    WHEN status =
                                        'paid'
                                    THEN
                                        failure_reason

                                    ELSE
                                        $2

                                END,

                            updated_at =
                                NOW()

                        WHERE
                            provider =
                                'razorpay'

                            AND
                            provider_order_id =
                                $3
                    `,
                    [
                        paymentId,

                        paymentEntity
                            ?.error_description ||
                        paymentEntity
                            ?.error_reason ||
                        "Payment failed.",

                        orderId,
                    ]
                );


                await client.query(
                    `
                        UPDATE bookings b

                        SET
                            payment_status =
                                CASE

                                    WHEN
                                        b.payment_status =
                                            'paid'
                                    THEN
                                        b.payment_status

                                    ELSE
                                        'failed'

                                END,

                            updated_at =
                                NOW()

                        FROM payments p

                        WHERE
                            p.booking_id =
                                b.id

                            AND
                            p.provider =
                                'razorpay'

                            AND
                            p.provider_order_id =
                                $1
                    `,
                    [
                        orderId
                    ]
                );
            }
        }


        // ------------------------------------
// REFUND PROCESSED / FAILED
// ------------------------------------

if (
    eventType ===
        "refund.processed" ||
    eventType ===
        "refund.failed"
) {

    if (
        !refundId ||
        !paymentId
    ) {

        throw new Error(
            "Refund webhook is missing refund or payment ID."
        );
    }


    // --------------------------------
    // LOAD LOCAL REFUND + PAYMENT
    //
    // Important:
    // Match either by stored Razorpay
    // refund ID OR by the original
    // Razorpay payment ID.
    //
    // The second path recovers from:
    // Razorpay succeeded, but our DB
    // crashed before saving rfnd_...
    // --------------------------------

    const refundResult =
        await client.query(
            `
                SELECT
                    pr.id
                        AS refund_row_id,

                    pr.booking_id,

                    pr.provider_refund_id,

                    pr.amount
                        AS refund_amount,

                    pr.currency
                        AS refund_currency,

                    pr.status
                        AS refund_status,

                    pay.id
                        AS payment_row_id,

                    pay.provider_payment_id,

                    pay.amount
                        AS payment_amount,

                    pay.currency
                        AS payment_currency,

                    pay.status
                        AS payment_status,

                    b.status
                        AS booking_status,

                    b.payment_status
                        AS booking_payment_status

                FROM payment_refunds pr

                JOIN payments pay
                    ON pay.id =
                        pr.payment_id

                JOIN bookings b
                    ON b.id =
                        pr.booking_id

                WHERE
                    pr.provider =
                        'razorpay'

                    AND (
                        pr.provider_refund_id =
                            $1

                        OR (
                            pr.provider_refund_id
                                IS NULL

                            AND
                            pay.provider_payment_id =
                                $2
                        )
                    )

                ORDER BY
                    pr.created_at DESC

                LIMIT 1
            `,
            [
                refundId,
                paymentId,
            ]
        );


    const localRefund =
        refundResult.rows[0];


    if (!localRefund) {

        throw new Error(
            "Refund webhook does not match a local refund record."
        );
    }


    // --------------------------------
    // VERIFY AMOUNT + CURRENCY
    // --------------------------------

    const expectedAmount =
        toPaise(
            localRefund
                .refund_amount
        );


    const gatewayAmount =
        Number(
            refundEntity.amount
        );


    const gatewayCurrency =
        String(
            refundEntity.currency ||
            ""
        ).toUpperCase();


    if (
        gatewayAmount !==
            expectedAmount ||
        gatewayCurrency !==
            String(
                localRefund
                    .refund_currency
            ).toUpperCase()
    ) {

        throw new Error(
            "Refund webhook amount or currency mismatch."
        );
    }


    // --------------------------------
    // REFUND PROCESSED
    // --------------------------------

    if (
        eventType ===
        "refund.processed"
    ) {

        await client.query(
            `
                UPDATE payment_refunds

                SET
                    provider_refund_id =
                        COALESCE(
                            provider_refund_id,
                            $1
                        ),

                    status =
                        'processed',

                    failure_reason =
                        NULL,

                    processed_at =
                        COALESCE(
                            processed_at,
                            NOW()
                        ),

                    updated_at =
                        NOW()

                WHERE
                    id = $2
            `,
            [
                refundId,
                localRefund
                    .refund_row_id,
            ]
        );


        await client.query(
            `
                UPDATE payments

                SET
                    status =
                        'refunded',

                    updated_at =
                        NOW()

                WHERE
                    id = $1
            `,
            [
                localRefund
                    .payment_row_id
            ]
        );


        await client.query(
            `
                UPDATE bookings

                SET
                    status =
                        'cancelled',

                    payment_status =
                        'refunded',

                    cancelled_at =
                        COALESCE(
                            cancelled_at,
                            NOW()
                        ),

                    updated_at =
                        NOW()

                WHERE
                    id = $1
            `,
            [
                localRefund
                    .booking_id
            ]
        );
    }


    // --------------------------------
    // REFUND FAILED
    //
    // Do NOT resurrect the booking.
    // The user already cancelled it.
    //
    // Payment returns to PAID because
    // the money was not refunded.
    // --------------------------------

    if (
        eventType ===
        "refund.failed"
    ) {

        await client.query(
            `
                UPDATE payment_refunds

                SET
                    provider_refund_id =
                        COALESCE(
                            provider_refund_id,
                            $1
                        ),

                    status =
                        'failed',

                    failure_reason =
                        $2,

                    processed_at =
                        NULL,

                    updated_at =
                        NOW()

                WHERE
                    id = $3
            `,
            [
                refundId,

                refundEntity
                    ?.error_description ||
                refundEntity
                    ?.error_reason ||
                "Razorpay refund failed.",

                localRefund
                    .refund_row_id,
            ]
        );


        await client.query(
            `
                UPDATE payments

                SET
                    status =
                        'paid',

                    updated_at =
                        NOW()

                WHERE
                    id = $1
            `,
            [
                localRefund
                    .payment_row_id
            ]
        );


        await client.query(
            `
                UPDATE bookings

                SET
                    payment_status =
                        'paid',

                    updated_at =
                        NOW()

                WHERE
                    id = $1
            `,
            [
                localRefund
                    .booking_id
            ]
        );
    }
}


        await client.query(
            `
                UPDATE
                    payment_webhook_events

                SET
                    processed =
                        TRUE,

                    processed_at =
                        NOW()

                WHERE
                    provider =
                        'razorpay'

                    AND
                    provider_event_id =
                        $1
            `,
            [
                eventId
            ]
        );


        await client.query(
            "COMMIT"
        );


        return res.json({
            status: "success",
            message:
                "Webhook processed.",
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
            "Razorpay webhook error:",
            error
        );


        return res
            .status(500)
            .json({
                status: "error",
                message:
                    "Webhook processing failed.",
            });


    } finally {

        client.release();
    }
}


module.exports = {
    createPaymentOrder,
    verifyPayment,
    getBookingPayment,
    handleRazorpayWebhook,
};
