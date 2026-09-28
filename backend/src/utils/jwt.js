const jwt = require("jsonwebtoken");
const env = require("../config/env");

function signToken(userId) {
    return jwt.sign(
        { id: userId },
        env.jwtSecret,
        { expiresIn: env.jwtExpiresIn }
    );
}

function verifyToken(token) {
    return jwt.verify(token, env.jwtSecret);
}

function cookieOptions() {
    return {
        httpOnly: true,
        secure: env.isProd,
        sameSite: env.isProd ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
}

module.exports = { signToken, verifyToken, cookieOptions };