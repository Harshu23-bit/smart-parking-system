const {
    handleRazorpayWebhook,
} =
    require(
        "./controllers/payment.controller"
    );

const express = require("express");
const cors = require("cors");
const path = require("path");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const ownerRoutes = require("./routes/owner.routes");
const vehicleRoutes = require("./routes/vehicle.routes");
const bookingRoutes = require("./routes/booking.routes");
const paymentRoutes = require("./routes/payment.routes");
const parkingRoutes = require("./routes/parking.routes");

const app = express();

app.use(cors());


// ============================================
// RAZORPAY WEBHOOK
//
// Must be BEFORE express.json() so the raw
// request body is preserved for signature
// verification.
// ============================================

app.post(
    "/api/payments/webhook",

    express.raw({
        type:
            "application/json",
    }),

    handleRazorpayWebhook
);


// Normal JSON parser for the rest of ParkSmart.
app.use(
    express.json()
);

app.use(
    express.urlencoded({ 
        extended: true, 
    })
);

//API routes
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/parking", parkingRoutes);

// Serve uploaded parking images
app.use(
    "/uploads",
    express.static(
        path.join(
            __dirname,
            "uploads"
        )
    )
);

// Serve frontend
app.use(
    express.static(
        path.join(__dirname, "../client")
    )
);

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../client/pages/index.html"
        )
    );
});

app.use(
    "/api/vehicles",
    vehicleRoutes
);

app.use(
    "/api/bookings",
    bookingRoutes
);

app.use(
    "/api/payments",
    paymentRoutes
);

// 404 MUST stay after static frontend serving
app.use((req, res) => {
    res.status(404).json({
        status: "error",
        message: "Route not found",
    });
});

module.exports = app;