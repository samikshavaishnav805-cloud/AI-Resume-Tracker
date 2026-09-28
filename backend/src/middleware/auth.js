const { verifyToken } = require("../utils/jwt");

function requireAuth(req, res, next) {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                message: "Please login first",
            });
        }

        const decoded = verifyToken(token);

        req.user = {
            id: decoded.id,
        };

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired session",
        });
    }
}

module.exports = { requireAuth };