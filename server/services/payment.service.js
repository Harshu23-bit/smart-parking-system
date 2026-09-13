const crypto =
    require("crypto");

const Razorpay =
    require("razorpay");


let razorpayClient =
    null;


function getRazorpayClient() {

    const keyId =
        process.env
            .RAZORPAY_KEY_ID;

    const keySecret =
        process.env
            .RAZORPAY_KEY_SECRET;


    if (
        !keyId ||
        !keySecret
    ) {

        throw new Error(
            "Razorpay test credentials are not configured."
        );
    }


    if (!razorpayClient) {

        razorpayClient =
            new Razorpay({
                key_id:
                    keyId,

                key_secret:
                    keySecret,
            });
    }


    return razorpayClient;
}


function toPaise(
    amount
) {

    const numericAmount =
        Number(amount);


    if (
        !Number.isFinite(
            numericAmount
        ) ||
        numericAmount <= 0
    ) {

        throw new Error(
            "Invalid payment amount."
        );
    }


    return Math.round(
        numericAmount * 100
    );
}


async function createGatewayOrder({
    amount,
    currency = "INR",
    receipt,
    notes = {},
}) {

    const client =
        getRazorpayClient();


    return client.orders.create({

        amount:
            toPaise(
                amount
            ),

        currency,

        receipt:
            String(
                receipt
            ).slice(
                0,
                40
            ),

        notes,
    });
}


function verifyCheckoutSignature({
    orderId,
    paymentId,
    signature,
}) {

    const secret =
        process.env
            .RAZORPAY_KEY_SECRET;


    if (!secret) {

        throw new Error(
            "Razorpay secret is not configured."
        );
    }


    if (
        !orderId ||
        !paymentId ||
        !signature
    ) {

        return false;
    }


    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                secret
            )
            .update(
                `${orderId}|${paymentId}`
            )
            .digest(
                "hex"
            );


    const expectedBuffer =
        Buffer.from(
            expectedSignature,
            "utf8"
        );


    const receivedBuffer =
        Buffer.from(
            String(
                signature
            ),
            "utf8"
        );


    if (
        expectedBuffer.length !==
        receivedBuffer.length
    ) {

        return false;
    }


    return crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
    );
}


async function fetchGatewayPayment(
    paymentId
) {

    const client =
        getRazorpayClient();


    return client.payments.fetch(
        paymentId
    );
}


async function createGatewayRefund({
    paymentId,
    amount,
    notes = {},
    idempotencyKey,
}) {

    if (!paymentId) {

        throw new Error(
            "Razorpay payment ID is required for refund."
        );
    }


    if (!idempotencyKey) {

        throw new Error(
            "Refund idempotency key is required."
        );
    }


    const keyId =
        process.env
            .RAZORPAY_KEY_ID;


    const keySecret =
        process.env
            .RAZORPAY_KEY_SECRET;


    if (
        !keyId ||
        !keySecret
    ) {

        throw new Error(
            "Razorpay credentials are not configured."
        );
    }


    const authorization =
        Buffer.from(
            `${keyId}:${keySecret}`
        ).toString(
            "base64"
        );


    const response =
        await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(
                paymentId
            )}/refund`,
            {
                method:
                    "POST",

                headers: {
                    Authorization:
                        `Basic ${authorization}`,

                    "Content-Type":
                        "application/json",

                    "X-Refund-Idempotency":
                        String(
                            idempotencyKey
                        ),
                },

                body:
                    JSON.stringify({
                        amount:
                            toPaise(
                                amount
                            ),

                        notes,
                    }),
            }
        );


    const result =
        await response.json();


    if (!response.ok) {

        const error =
            new Error(
                result?.error
                    ?.description ||
                "Razorpay refund request failed."
            );


        error.statusCode =
            response.status;


        error.error =
            result?.error ||
            result;


        throw error;
    }


    return result;
}


function verifyWebhookSignature({
    rawBody,
    signature,
}) {

    const secret =
        process.env
            .RAZORPAY_WEBHOOK_SECRET;


    if (!secret) {

        throw new Error(
            "Razorpay webhook secret is not configured."
        );
    }


    if (
        !rawBody ||
        !signature
    ) {

        return false;
    }


    const expectedSignature =
        crypto
            .createHmac(
                "sha256",
                secret
            )
            .update(
                rawBody
            )
            .digest(
                "hex"
            );


    const expectedBuffer =
        Buffer.from(
            expectedSignature,
            "utf8"
        );


    const receivedBuffer =
        Buffer.from(
            String(signature),
            "utf8"
        );


    if (
        expectedBuffer.length !==
        receivedBuffer.length
    ) {

        return false;
    }


    return crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
    );
}


module.exports = {
    getRazorpayClient,
    toPaise,
    createGatewayOrder,
    verifyCheckoutSignature,
    verifyWebhookSignature,
    fetchGatewayPayment,
    createGatewayRefund,
};
