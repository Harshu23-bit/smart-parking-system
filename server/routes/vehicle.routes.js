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
    createVehicle,
    getMyVehicles,
} =
    require(
        "../controllers/vehicle.controller"
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
    createVehicle
);


router.get(
    "/",
    getMyVehicles
);


module.exports =
    router;