const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "ParkSmart API is running",
    });
});

router.get("/database", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT current_database(), current_user, NOW() AS server_time"
        );

        res.status(200).json({
            status: "ok",
            database: result.rows[0],
        });
    } catch (error) {
        console.error("Database health check failed:", error);

        res.status(500).json({
            status: "error",
            message: "Database connection failed",
        });
    }
});

module.exports = router;