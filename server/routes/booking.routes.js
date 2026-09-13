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
    createBooking,
    getMyBookings,
    cancelBooking,
} =
    require(
        "../controllers/booking.controller"
    );


const router =
    express.Router();


router.use(
    authenticate,
    requireRole("user"),
    requireVerifiedContact
);


router.post(
    "/",
    createBooking
);


router.get(
    "/",
    getMyBookings
);


router.post(
    "/:id/cancel",
    cancelBooking
);


module.exports =
    router;