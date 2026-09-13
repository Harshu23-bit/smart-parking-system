const twilio = require("twilio");

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

async function sendOtpVoiceCall({
    phone,
    otp,
    purpose,
}) {
    if (!phone) {
        throw new Error(
            "Phone number is required for voice verification."
        );
    }

    /*
     * ParkSmart Voice OTP implementation.
     *
     * Custom OTP speech through Twilio Voice requires functionality
     * that is restricted on the current Twilio trial account.
     *
     * We keep this service here so Voice verification can be enabled
     * later without changing the rest of the OTP architecture.
     */

    const error = new Error(
        "Voice OTP is unavailable on the current Twilio trial account."
    );

    error.code = "VOICE_TRIAL_UNAVAILABLE";

    throw error;
}

module.exports = {
    sendOtpVoiceCall,
};