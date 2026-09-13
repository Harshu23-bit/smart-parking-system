const twilio = require("twilio");

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function sendOtpSms({
    phone,
    otp,
    purpose,
}) {
    if (!phone) {
        throw new Error(
            "Phone number is required for SMS verification."
        );
    }

    /*
     * Twilio trial accounts only allow predefined SMS templates.
     *
     * The predefined trial template generates/displays content that
     * cannot be synchronized with ParkSmart's locally generated OTP.
     *
     * Therefore SMS OTP verification is disabled during development
     * until the Twilio account supports custom messaging or Verify.
     */

    const error = new Error(
        "SMS OTP verification is unavailable on the current Twilio trial account."
    );

    error.code = "SMS_TRIAL_UNAVAILABLE";

    throw error;
}

module.exports = {
    sendOtpSms,
};