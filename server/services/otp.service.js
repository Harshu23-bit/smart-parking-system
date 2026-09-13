const crypto = require("crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const {
    sendOtpEmail,
} = require("./email.service");

const {
    sendOtpSms,
} = require("./sms.service");

const {
    sendOtpVoiceCall,
} = require("./voice.service");

const OTP_LENGTH = 6;
const OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
    const min = 10 ** (OTP_LENGTH - 1);
    const max = 10 ** OTP_LENGTH;

    return crypto.randomInt(min, max).toString();
}

function getCooldownSeconds(channel) {
    if (channel === "voice") {
        return 120;
    }

    return 60;
}

async function createOtpForUser({
    userId,
    purpose,
    channel,
    destination,
    userName,
}) {
    const cooldownSeconds =
        getCooldownSeconds(channel);

    const recentResult =
        await pool.query(
            `
            SELECT created_at
            FROM auth_otps
            WHERE user_id = $1
            AND purpose = $2
            AND channel = $3
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [
                userId,
                purpose,
                channel,
            ]
        );

    if (recentResult.rowCount > 0) {
        const lastCreatedAt =
            new Date(
                recentResult.rows[0].created_at
            );

        const secondsSinceLastOtp =
            (
                Date.now() -
                lastCreatedAt.getTime()
            ) / 1000;

        if (
            secondsSinceLastOtp <
            cooldownSeconds
        ) {
            return {
                success: false,
                reason: "cooldown",
                retryAfter: Math.ceil(
                    cooldownSeconds -
                    secondsSinceLastOtp
                ),
            };
        }
    }

    const otp =
        generateOtp();

    const otpHash =
        await bcrypt.hash(
            otp,
            10
        );

    const expiryMinutes =
        Number(
            process.env.OTP_EXPIRY_MINUTES ||
            10
        );

    const expiresAt =
        new Date(
            Date.now() +
            expiryMinutes *
            60 *
            1000
        );

    await pool.query(
        `
        UPDATE auth_otps
        SET used_at = NOW()
        WHERE user_id = $1
        AND purpose = $2
        AND used_at IS NULL
        `,
        [
            userId,
            purpose,
        ]
    );

    const insertResult =
        await pool.query(
            `
            INSERT INTO auth_otps (
                user_id,
                otp_hash,
                purpose,
                channel,
                destination,
                expires_at,
                attempts
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, 0
            )
            RETURNING id
            `,
            [
                userId,
                otpHash,
                purpose,
                channel,
                destination,
                expiresAt,
            ]
        );

    const otpId =
        insertResult.rows[0].id;

    try {
        if (channel === "email") {
            await sendOtpEmail({
                email: destination,
                otp,
                purpose,
                userName,
            });
        }

        else if (channel === "sms") {
            await sendOtpSms({
                phone: destination,
                otp,
                purpose,
            });
        }

        else if (channel === "voice") {
            await sendOtpVoiceCall({
                phone: destination,
                otp,
                purpose,
            });
        }

        else {
            throw new Error(
                "Unsupported OTP channel."
            );
        }

    } catch (error) {
        await pool.query(
            `
            UPDATE auth_otps
            SET used_at = NOW()
            WHERE id = $1
            `,
            [otpId]
        );

        throw error;
    }

    return {
        success: true,
        expiresAt,
    };
}

async function verifyOtpForUser({
    userId,
    otp,
    purpose,
}) {
    const result =
        await pool.query(
            `
            SELECT
                id,
                otp_hash,
                channel,
                destination,
                expires_at,
                attempts
            FROM auth_otps
            WHERE user_id = $1
            AND purpose = $2
            AND used_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [
                userId,
                purpose,
            ]
        );

    if (result.rowCount === 0) {
        return {
            success: false,
            reason: "not_found",
        };
    }

    const otpRecord =
        result.rows[0];

    if (
        new Date(otpRecord.expires_at) <
        new Date()
    ) {
        return {
            success: false,
            reason: "expired",
        };
    }

    if (
        otpRecord.attempts >=
        OTP_MAX_ATTEMPTS
    ) {
        return {
            success: false,
            reason: "too_many_attempts",
        };
    }

    const matches =
        await bcrypt.compare(
            String(otp),
            otpRecord.otp_hash
        );

    if (!matches) {
        await pool.query(
            `
            UPDATE auth_otps
            SET attempts = attempts + 1
            WHERE id = $1
            `,
            [otpRecord.id]
        );

        return {
            success: false,
            reason: "invalid",
        };
    }

    await pool.query(
        `
        UPDATE auth_otps
        SET used_at = NOW()
        WHERE id = $1
        `,
        [otpRecord.id]
    );

    return {
        success: true,
        channel: otpRecord.channel,
        destination: otpRecord.destination,
    };
}

module.exports = {
    createOtpForUser,
    verifyOtpForUser,
};