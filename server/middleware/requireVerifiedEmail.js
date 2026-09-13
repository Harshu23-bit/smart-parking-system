function requireVerifiedEmail(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            status: "error",
            message: "Authentication required.",
        });
    }

    if (!req.user.email_verified) {
        return res.status(403).json({
            status: "error",
            message: "Please verify your email address before continuing.",
        });
    }

    next();
}

module.exports = requireVerifiedEmail;