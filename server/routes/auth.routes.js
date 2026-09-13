const express = require("express");

const {
    registerOwner,
    loginOwner,
    getCurrentUser,
    updateCurrentUser,
    sendVerificationOtp,
    verifyAccountOtp,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
} = require("../controllers/auth.controller");

const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.post("/register", registerOwner);
router.post("/login", loginOwner);

router.post(
    "/forgot-password",
    forgotPassword
);

router.post(
    "/verify-reset-otp",
    verifyResetOtp
);

router.post(
    "/reset-password",
    resetPassword
);

router.get("/me", authenticate, getCurrentUser);

router.patch(
    "/me",
    authenticate,
    updateCurrentUser
);

router.post(
    "/send-otp",
    authenticate,
    sendVerificationOtp
);

router.post(
    "/verify-account",
    authenticate,
    verifyAccountOtp
);

module.exports = router;