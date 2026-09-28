require("dotenv").config();

const env = {
    port: Number(process.env.PORT) || 5000,
    databaseUrl: process.env.DATABASE_URL,

    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: "7d",

    cookieName: "token",
    isProd: process.env.NODE_ENV === "production",
};

if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is missing in .env");
}

if (!env.jwtSecret) {
    throw new Error("JWT_SECRET is missing in .env");
}

module.exports = env;