const {
    parkingImageUpload,
} = require(
    "../middleware/parkingImageUpload"
);

const express = require("express");

const authenticate =
    require("../middleware/authenticate");

const requireRole =
    require("../middleware/requireRole");

const requireVerifiedContact =
    require("../middleware/requireVerifiedContact");

const {
    createParkingSpace,
    getOwnerParkingSpaces,
    updateParkingSpaceDetails,
    updateParkingAvailability,
    updateParkingPricing,
    getOwnerBookings,
    updateOwnerBookingStatus,
    getOwnerEarnings,
    getOwnerOperatingHours,
    updateOwnerOperatingHours,
    getOwnerParkingImages,
    uploadOwnerParkingImages,
    setPrimaryParkingImage,
    deleteOwnerParkingImage,
} =
    require(
        "../controllers/owner.controller"
    );

const router =
    express.Router();


// Every route below requires:
//
// 1. Valid JWT
// 2. Owner role
// 3. Verified email OR verified phone
//
router.use(
    authenticate,
    requireRole("owner"),
    requireVerifiedContact
);


router.post(
    "/parking-spaces",
    createParkingSpace
);


router.get(
    "/parking-spaces",
    getOwnerParkingSpaces
);


router.patch(
    "/parking-spaces/:id",
    updateParkingSpaceDetails
);


router.get(
    "/bookings",
    getOwnerBookings
);


router.get(
    "/earnings",
    getOwnerEarnings
);


router.get(
    "/parking-spaces/:id/operating-hours",
    getOwnerOperatingHours
);


router.patch(
    "/parking-spaces/:id/operating-hours",
    updateOwnerOperatingHours
);


router.patch(
    "/bookings/:id/status",
    updateOwnerBookingStatus
);


router.patch(
    "/parking-spaces/:id/availability",
    updateParkingAvailability
);


router.patch(
    "/parking-spaces/:id/pricing",
    updateParkingPricing
);


router.get(
    "/parking-spaces/:id/images",
    getOwnerParkingImages
);


router.post(
    "/parking-spaces/:id/images",
    parkingImageUpload,
    uploadOwnerParkingImages
);


router.patch(
    "/parking-spaces/:id/images/:imageId/primary",
    setPrimaryParkingImage
);


router.delete(
    "/parking-spaces/:id/images/:imageId",
    deleteOwnerParkingImage
);


module.exports = router;