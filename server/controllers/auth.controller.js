const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const {
    createOtpForUser,
    verifyOtpForUser,
} = require("../services/otp.service");

async function registerOwner(req, res) {
    const { name, email, phone, password } = req.body;

    try {
        // -------------------------------------------------
        // Basic validation
        // -------------------------------------------------

        if (!name || !email || !password) {
            return res.status(400).json({
                status: "error",
                message: "Name, email, and password are required.",
            });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone ? phone.trim() : null;

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                status: "error",
                message: "Name must be between 2 and 100 characters.",
            });
        }

        if (!EMAIL_REGEX.test(cleanEmail)) {
            return res.status(400).json({
                status: "error",
                message: "Please provide a valid email address.",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                status: "error",
                message: "Password must contain at least 8 characters.",
            });
        }

        // -------------------------------------------------
        // Check existing account
        // -------------------------------------------------

        const existingUser = await pool.query(
            `
            SELECT id
            FROM users
            WHERE email = $1
            LIMIT 1
            `,
            [cleanEmail]
        );

        if (existingUser.rowCount > 0) {
            return res.status(409).json({
                status: "error",
                message: "An account with this email already exists.",
            });
        }

        // -------------------------------------------------
        // Hash password
        // -------------------------------------------------

        const passwordHash = await bcrypt.hash(password, 12);

        // -------------------------------------------------
        // Create owner
        // -------------------------------------------------

        const result = await pool.query(
            `
            INSERT INTO users (
                name,
                email,
                phone,
                password_hash,
                role,
                email_verified
            )
            VALUES ($1, $2, $3, $4, 'owner', FALSE)
            RETURNING
                id,
                name,
                email,
                phone,
                role,
                email_verified,
                created_at
            `,
            [
                cleanName,
                cleanEmail,
                cleanPhone,
                passwordHash,
            ]
        );

        return res.status(201).json({
            status: "success",
            message: "Owner account created successfully.",
            user: result.rows[0],
        });
    } catch (error) {
        console.error("Owner registration failed:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to create owner account.",
        });
    }
}

async function loginOwner(req, res) {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                message: "Email and password are required.",
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        if (!EMAIL_REGEX.test(cleanEmail)) {
            return res.status(400).json({
                status: "error",
                message: "Please provide a valid email address.",
            });
        }

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                phone,
                password_hash,
                role,
                email_verified,
                created_at
            FROM users
            WHERE email = $1
            LIMIT 1
            `,
            [cleanEmail]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                status: "error",
                message: "Invalid email or password.",
            });
        }

        const user = result.rows[0];

        if (user.role !== "owner") {
            return res.status(403).json({
                status: "error",
                message: "This account is not authorized for the owner portal.",
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                status: "error",
                message: "Invalid email or password.",
            });
        }

        const token = jwt.sign(
            {
                sub: user.id,
                role: user.role,
                emailVerified: user.email_verified,
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1d",
            }
        );

        return res.status(200).json({
            status: "success",
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                email_verified: user.email_verified,
                created_at: user.created_at,
            },
        });
    } catch (error) {
        console.error("Owner login failed:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to log in.",
        });
    }
}

async function getCurrentUser(req, res) {

    try {

        const userId =
            req.user?.id ||
            req.user?.sub;


        if (!userId) {

            return res.status(401).json({
                status: "error",
                message: "Authentication required.",
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    phone,
                    role,
                    email_verified,
                    phone_verified,
                    created_at
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [userId]
            );


        if (result.rowCount === 0) {

            return res.status(404).json({
                status: "error",
                message: "User account not found.",
            });
        }


        return res.status(200).json({
            status: "success",
            user: result.rows[0],
        });


    } catch (error) {

        console.error(
            "Unable to load current user:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to load account information.",
        });
    }
}

async function updateCurrentUser(
    req,
    res
) {

    try {

        const userId =
            req.user?.id ||
            req.user?.sub;


        if (!userId) {

            return res.status(401).json({
                status: "error",
                message:
                    "Authentication required.",
            });
        }


        const {
            name,
            phone,
        } = req.body || {};


        const currentResult =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    phone,
                    role,
                    email_verified,
                    phone_verified,
                    created_at
                FROM users
                WHERE id = $1
                LIMIT 1
                `,
                [userId]
            );


        if (
            currentResult.rowCount === 0
        ) {

            return res.status(404).json({
                status: "error",
                message:
                    "User account not found.",
            });
        }


        const current =
            currentResult.rows[0];


        const cleanName =
            name !== undefined
                ? String(name).trim()
                : current.name;


        let cleanPhone =
            phone !== undefined
                ? String(phone).trim()
                : current.phone;


        if (cleanPhone === "") {
            cleanPhone = null;
        }


        if (
            !cleanName ||
            cleanName.length < 2 ||
            cleanName.length > 100
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Name must be between 2 and 100 characters.",
            });
        }


        if (
            cleanPhone &&
            cleanPhone.length > 30
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Phone number is too long.",
            });
        }


        const phoneChanged =
            cleanPhone !==
            current.phone;


        const result =
            await pool.query(
                `
                UPDATE users
                SET
                    name = $1,
                    phone = $2,
                    phone_verified =
                        CASE
                            WHEN $3 = TRUE
                                THEN FALSE
                            ELSE phone_verified
                        END,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING
                    id,
                    name,
                    email,
                    phone,
                    role,
                    email_verified,
                    phone_verified,
                    created_at
                `,
                [
                    cleanName,
                    cleanPhone,
                    phoneChanged,
                    userId,
                ]
            );


        return res.status(200).json({
            status: "success",
            message:
                "Account details updated successfully.",
            user:
                result.rows[0],
        });


    } catch (error) {

        console.error(
            "Update current user failed:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to update account details.",
        });
    }
}

async function sendVerificationOtp(req, res) {
    try {
        const {
            channel = "email",
        } = req.body;

        if (
            !["email", "sms", "voice"]
                .includes(channel)
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Verification channel must be email, sms, or voice.",
            });
        }

        if (
            channel === "email" &&
            req.user.email_verified
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Email is already verified.",
            });
        }

        if (
            ["sms", "voice"].includes(channel) &&
            req.user.phone_verified
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "Phone number is already verified.",
            });
        }

        const destination =
            channel === "email"
                ? req.user.email
                : req.user.phone;

        if (!destination) {
            return res.status(400).json({
                status: "error",
                message:
                    channel === "email"
                        ? "No email address is associated with this account."
                        : "No phone number is associated with this account.",
            });
        }

        const result =
            await createOtpForUser({
                userId: req.user.id,
                purpose: "account_verification",
                channel,
                destination,
                userName:
                    req.user.name,
            });

        if (!result.success) {
            if (
                result.reason ===
                "cooldown"
            ) {
                return res.status(429).json({
                    status: "error",
                    message:
                        `Please wait ${result.retryAfter} seconds before requesting another code.`,
                    retry_after:
                        result.retryAfter,
                });
            }
        }

        return res.status(200).json({
            status: "success",
            message:
                channel === "email"
                    ? "Verification code sent to your email."
                    : channel === "sms"
                    ? "Verification code sent by SMS."
                    : "Verification call started.",
            channel,
            expires_at:
                result.expiresAt,
        });

    } catch (error) {
        console.error(
            "Verification delivery failed:",
            error
        );

        if (
            error.code ===
            "SMS_TRIAL_UNAVAILABLE"
        ) {
            return res.status(503).json({
                status: "error",
                code: "SMS_TRIAL_UNAVAILABLE",
                message:
                    "SMS verification is temporarily unavailable during development. Please use email.",
            });
        }

        if (
            error.code ===
            "VOICE_TRIAL_UNAVAILABLE"
        ) {
            return res.status(503).json({
                status: "error",
                code: "VOICE_TRIAL_UNAVAILABLE",
                message:
                    "Voice verification is temporarily unavailable during development. Please use email or SMS.",
            });
        }

        return res.status(500).json({
            status: "error",
            message:
                "Unable to send verification code.",
        });
    }
}

async function verifyAccountOtp(req, res) {
    const {
        otp,
    } = req.body;

    try {
        if (
            !otp ||
            !/^\d{6}$/.test(
                String(otp)
            )
        ) {
            return res.status(400).json({
                status: "error",
                message:
                    "A valid 6-digit verification code is required.",
            });
        }

        const verification =
            await verifyOtpForUser({
                userId: req.user.id,
                otp: String(otp),
                purpose: "account_verification",
            });

        if (!verification.success) {
            const messages = {
                not_found:
                    "No active verification code found.",

                expired:
                    "Verification code has expired.",

                too_many_attempts:
                    "Too many incorrect attempts. Request a new code.",

                invalid:
                    "Invalid verification code.",
            };

            return res.status(400).json({
                status: "error",
                message:
                    messages[
                        verification.reason
                    ] ||
                    "Verification failed.",
            });
        }

        if (
            verification.channel ===
            "email"
        ) {
            await pool.query(
                `
                UPDATE users
                SET email_verified = TRUE
                WHERE id = $1
                `,
                [req.user.id]
            );
        }

        if (
            verification.channel ===
            "sms" ||
            verification.channel ===
            "voice"
        ) {
            await pool.query(
                `
                UPDATE users
                SET phone_verified = TRUE
                WHERE id = $1
                `,
                [req.user.id]
            );
        }

        return res.status(200).json({
            status: "success",
            message:
                verification.channel ===
                    "email"
                    ? "Email verified successfully."
                    : "Phone number verified successfully.",
            channel:
                verification.channel,
        });

    } catch (error) {
        console.error(
            "Account verification failed:",
            error
        );

        return res.status(500).json({
            status: "error",
            message:
                "Unable to verify account.",
        });
    }
}

// =========================================================
// POST /api/auth/forgot-password
// =========================================================

async function forgotPassword(
    req,
    res
) {

    try {

        const {
            email
        } = req.body || {};


        const cleanEmail =
            typeof email === "string"
                ? email.trim().toLowerCase()
                : "";


        if (
            !cleanEmail ||
            !EMAIL_REGEX.test(
                cleanEmail
            )
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Please provide a valid email address.",
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    name,
                    email,
                    role
                FROM users
                WHERE email = $1
                LIMIT 1
                `,
                [
                    cleanEmail
                ]
            );


        // Do not reveal whether an account exists.
        if (
            result.rowCount === 0
        ) {

            return res.status(200).json({
                status: "success",
                message:
                    "If an account exists for this email, a password reset code has been sent.",
            });
        }


        const user =
            result.rows[0];


        const otpResult =
            await createOtpForUser({
                userId:
                    user.id,

                purpose:
                    "password_reset",

                channel:
                    "email",

                destination:
                    user.email,

                userName:
                    user.name,
            });


        if (
            !otpResult.success &&
            otpResult.reason ===
                "cooldown"
        ) {

            return res.status(429).json({
                status: "error",
                message:
                    `Please wait ${otpResult.retryAfter} seconds before requesting another reset code.`,

                retry_after:
                    otpResult.retryAfter,
            });
        }


        return res.status(200).json({
            status: "success",
            message:
                "If an account exists for this email, a password reset code has been sent.",
        });


    } catch (error) {

        console.error(
            "Forgot password error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to start password reset.",
        });
    }
}


// =========================================================
// POST /api/auth/verify-reset-otp
// =========================================================

async function verifyResetOtp(
    req,
    res
) {

    try {

        const {
            email,
            otp
        } = req.body || {};


        const cleanEmail =
            typeof email === "string"
                ? email.trim().toLowerCase()
                : "";


        const cleanOtp =
            String(
                otp || ""
            ).trim();


        if (
            !EMAIL_REGEX.test(
                cleanEmail
            ) ||
            !/^\d{6}$/.test(
                cleanOtp
            )
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "A valid email and 6-digit reset code are required.",
            });
        }


        const userResult =
            await pool.query(
                `
                SELECT
                    id,
                    email
                FROM users
                WHERE email = $1
                LIMIT 1
                `,
                [
                    cleanEmail
                ]
            );


        if (
            userResult.rowCount ===
            0
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Invalid or expired reset code.",
            });
        }


        const user =
            userResult.rows[0];


        const verification =
            await verifyOtpForUser({
                userId:
                    user.id,

                otp:
                    cleanOtp,

                purpose:
                    "password_reset",
            });


        if (
            !verification.success
        ) {

            const messages = {

                not_found:
                    "No active password reset code was found.",

                expired:
                    "Password reset code has expired.",

                too_many_attempts:
                    "Too many incorrect attempts. Request a new reset code.",

                invalid:
                    "Invalid password reset code.",
            };


            return res.status(400).json({
                status: "error",
                message:
                    messages[
                        verification.reason
                    ] ||
                    "Unable to verify reset code.",
            });
        }


        const resetToken =
            jwt.sign(
                {
                    sub:
                        user.id,

                    scope:
                        "password_reset",
                },

                process.env
                    .PASSWORD_RESET_SECRET ||
                    process.env
                        .JWT_SECRET,

                {
                    expiresIn:
                        "10m",
                }
            );


        return res.status(200).json({
            status: "success",
            message:
                "Reset code verified.",

            reset_token:
                resetToken,
        });


    } catch (error) {

        console.error(
            "Verify reset OTP error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to verify reset code.",
        });
    }
}


// =========================================================
// POST /api/auth/reset-password
// =========================================================

async function resetPassword(
    req,
    res
) {

    try {

        const {
            reset_token,
            new_password
        } = req.body || {};


        if (
            !reset_token ||
            !new_password
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Reset token and new password are required.",
            });
        }


        if (
            String(
                new_password
            ).length < 8
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Password must contain at least 8 characters.",
            });
        }


        let decoded;


        try {

            decoded =
                jwt.verify(
                    reset_token,

                    process.env
                        .PASSWORD_RESET_SECRET ||
                        process.env
                            .JWT_SECRET
                );

        } catch {

            return res.status(400).json({
                status: "error",
                message:
                    "Password reset session is invalid or has expired.",
            });
        }


        if (
            decoded.scope !==
                "password_reset" ||
            !decoded.sub
        ) {

            return res.status(400).json({
                status: "error",
                message:
                    "Invalid password reset session.",
            });
        }


        const passwordHash =
            await bcrypt.hash(
                new_password,
                12
            );


        const result =
            await pool.query(
                `
                UPDATE users
                SET
                    password_hash = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id
                `,
                [
                    passwordHash,
                    decoded.sub,
                ]
            );


        if (
            result.rowCount === 0
        ) {

            return res.status(404).json({
                status: "error",
                message:
                    "Account not found.",
            });
        }


        // Invalidate any remaining reset OTPs.
        await pool.query(
            `
            UPDATE auth_otps
            SET used_at = NOW()
            WHERE
                user_id = $1
                AND purpose =
                    'password_reset'
                AND used_at IS NULL
            `,
            [
                decoded.sub
            ]
        );


        return res.status(200).json({
            status: "success",
            message:
                "Password reset successfully. You can now sign in with your new password.",
        });


    } catch (error) {

        console.error(
            "Reset password error:",
            error
        );


        return res.status(500).json({
            status: "error",
            message:
                "Unable to reset password.",
        });
    }
}

async function registerUser(req, res) {
    const { name, email, phone, password } = req.body || {};

    try {
        if (!name || !email || !password) {
            return res.status(400).json({
                status: "error",
                message: "Name, email and password are required."
            });
        }

        const cleanName = String(name).trim();
        const cleanEmail = String(email).trim().toLowerCase();
        const cleanPhone = phone ? String(phone).trim() : null;

        if (cleanName.length < 2 || cleanName.length > 100) {
            return res.status(400).json({
                status: "error",
                message: "Name must be between 2 and 100 characters."
            });
        }

        if (!EMAIL_REGEX.test(cleanEmail)) {
            return res.status(400).json({
                status: "error",
                message: "Invalid email address."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                status: "error",
                message: "Password must contain at least 8 characters."
            });
        }

        const existing = await pool.query(
            `SELECT id FROM users WHERE email = $1 LIMIT 1`,
            [cleanEmail]
        );

        if (existing.rowCount > 0) {
            return res.status(409).json({
                status: "error",
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `
            INSERT INTO users (
                name,
                email,
                phone,
                password_hash,
                role,
                email_verified
            )
            VALUES ($1, $2, $3, $4, 'user', FALSE)
            RETURNING
                id,
                name,
                email,
                phone,
                role,
                email_verified,
                phone_verified,
                created_at
            `,
            [
                cleanName,
                cleanEmail,
                cleanPhone,
                passwordHash
            ]
        );

        return res.status(201).json({
            status: "success",
            message: "User account created successfully.",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("User registration error:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to create user account."
        });
    }
}


async function loginUser(req, res) {
    const { email, password } = req.body || {};

    try {
        if (!email || !password) {
            return res.status(400).json({
                status: "error",
                message: "Email and password are required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                phone,
                password_hash,
                role,
                email_verified,
                phone_verified,
                created_at
            FROM users
            WHERE email = $1
            LIMIT 1
            `,
            [cleanEmail]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                status: "error",
                message: "Invalid email or password."
            });
        }

        const user = result.rows[0];

        if (user.role !== "user") {
            return res.status(403).json({
                status: "error",
                message: "This account is not a user account."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                status: "error",
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            {
                sub: user.id,
                role: "user",
                emailVerified: user.email_verified
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "1d"
            }
        );

        return res.json({
            status: "success",
            message: "Login successful.",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                email_verified: user.email_verified,
                phone_verified: user.phone_verified,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error("User login error:", error);

        return res.status(500).json({
            status: "error",
            message: "Unable to log in."
        });
    }
}

module.exports = {
    registerOwner,
    loginOwner,

    registerUser,
    loginUser,

    getCurrentUser,
    updateCurrentUser,
    sendVerificationOtp,
    verifyAccountOtp,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
};
