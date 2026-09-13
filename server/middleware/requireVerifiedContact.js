function requireVerifiedContact(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            status: "error",
            message: "Authentication required.",
        });
    }

    const emailVerified =
        req.user.email_verified === true;

    const phoneVerified =
        req.user.phone_verified === true;

    if (!emailVerified && !phoneVerified) {
        return res.status(403).json({
            status: "error",
            message:
                "Please verify your email or phone number before continuing.",
        });
    }

    next();
}

module.exports = requireVerifiedContact;