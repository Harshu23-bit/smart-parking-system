const jwt = require("jsonwebtoken");
const pool = require("../config/db");

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                status: "error",
                message: "Authentication required.",
            });
        }

        const token = authHeader.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                status: "error",
                message: "Authentication required.",
            });
        }

        let decoded;

        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );
        } catch (error) {
            return res.status(401).json({
                status: "error",
                message: "Invalid or expired token.",
            });
        }

        const result = await pool.query(
            `
            SELECT
                id,
                name,
                email,
                phone,
                role,
                email_verified,
                phone_verified,
                created_at,
                updated_at
            FROM users
            WHERE id = $1
            LIMIT 1
            `,
            [decoded.sub]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                status: "error",
                message: "User account no longer exists.",
            });
        }

        req.user = result.rows[0];

        next();
    } catch (error) {
        console.error("Authentication middleware failed:", error);

        return res.status(500).json({
            status: "error",
            message: "Authentication check failed.",
        });
    }
}

module.exports = authenticate;