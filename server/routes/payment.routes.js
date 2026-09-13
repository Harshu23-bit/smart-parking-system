const express =
    require("express");

const authenticate =
    require(
        "../middleware/authenticate"
    );

const requireRole =
    require(
        "../middleware/requireRole"
    );

const requireVerifiedContact =
    require(
        "../middleware/requireVerifiedContact"
    );

const {
    createPaymentOrder,
    verifyPayment,
    getBookingPayment,
} =
    require(
        "../controllers/payment.controller"
    );


const router =
    express.Router();


router.use(
    authenticate,
    requireRole("user"),
    requireVerifiedContact
);


router.post(
    "/orders",
    createPaymentOrder
);


router.post(
    "/verify",
    verifyPayment
);


router.get(
    "/booking/:bookingId",
    getBookingPayment
);


module.exports =
    router;