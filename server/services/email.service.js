const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 465),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

async function sendOtpEmail({
    email,
    otp,
    purpose,
    userName,
}) {
    const isReset = purpose === "password_reset";
    const displayName = userName?.trim() || "ParkSmart Owner";

    const subject = isReset
        ? "Reset your ParkSmart password"
        : "Verify your ParkSmart Owner account";

    const heading = isReset
        ? "Reset your ParkSmart password"
        : "Verify your Owner Portal";

    const description = isReset
        ? "Use the verification code below to reset your ParkSmart password securely."
        : "Use the verification code below to continue securely with your ParkSmart owner account.";

    const mailOptions = {
        from: 
            process.env.EMAIL_FROM ||
            `ParkSmart <${process.env.EMAIL_USER}>`,

        to: email,

        subject,

        text: `
Hi ${displayName},

${heading}

Your verification code is: ${otp}

This code will expire shortly.

If you did not request this code, you can safely ignore this email.

ParkSmart Security
        `.trim(),

        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>

<body
    style="
        margin:0;
        padding:0;
        background:#f4f6fa;
        font-family:Arial,Helvetica,sans-serif;
        color:#172033;
    "
>

<table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    role="presentation"
    style="
        background:#f4f6fa;
        padding:32px 16px;
    "
>
<tr>
<td align="center">

    <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        role="presentation"
        style="
            max-width:560px;
            background:#ffffff;
            border-radius:16px;
            overflow:hidden;
            box-shadow:0 10px 30px rgba(15,23,42,.08);
        "
    >

        <tr>
            <td
                style="
                    padding:24px 28px;
                    background:#172d5b;
                    color:#ffffff;
                    font-size:22px;
                    font-weight:700;
                "
            >
                Park<span style="color:#4f7cff;">Smart</span>
            </td>
        </tr>

        <tr>
            <td style="padding:32px 28px;">

                <h2
                    style="
                        margin:0 0 14px;
                        font-size:22px;
                        color:#172033;
                    "
                >
                    ${heading}
                </h2>

                <p
                    style="
                        margin:0 0 20px;
                        font-size:15px;
                        line-height:1.6;
                        color:#667085;
                    "
                >
                    Hi ${displayName},
                </p>

                <p
                    style="
                        margin:0 0 20px;
                        font-size:15px;
                        line-height:1.6;
                        color:#667085;
                    "
                >
                    ${description}
                </p>

                <div
                    style="
                        margin:24px 0;
                        padding:18px;
                        text-align:center;
                        background:#f4f6fa;
                        border-radius:12px;
                        font-size:32px;
                        font-weight:800;
                        letter-spacing:8px;
                        color:#172d5b;
                    "
                >
                    ${otp}
                </div>

                <p
                    style="
                        margin:0 0 12px;
                        font-size:14px;
                        color:#667085;
                    "
                >
                    This code expires in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes for security reasons.
                </p>

                <p
                    style="
                        margin:0;
                        font-size:13px;
                        line-height:1.6;
                        color:#98a2b3;
                    "
                >
                    If you did not request this code, you can safely ignore this email.
                </p>

            </td>
        </tr>

        <tr>
            <td
                style="
                    padding:18px 28px;
                    background:#f8fafc;
                    color:#98a2b3;
                    font-size:12px;
                    text-align:center;
                "
            >
                ParkSmart Security • Owner Verification
            </td>
        </tr>

    </table>

</td>
</tr>
</table>

</body>
</html>
        `,
    };

    await transporter.sendMail(mailOptions);
}

module.exports = {
    sendOtpEmail,
};