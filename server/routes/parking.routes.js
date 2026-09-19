const express = require("express");

const {
    getPublicParkingSpaces,
    getPublicParkingSpace
} = require("../controllers/parking.controller");

const router = express.Router();

router.get("/", getPublicParkingSpaces);
router.get("/:id", getPublicParkingSpace);

module.exports = router;