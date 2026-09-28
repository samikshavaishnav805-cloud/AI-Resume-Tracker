const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"],
            index: true,
        },

        passwordHash: {
            type: String,
            required: true,
            select: false,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },
    },
    {
        timestamps: true,
    }
);

// Hash password
userSchema.statics.hashPassword = function (plainPassword) {
    return bcrypt.hash(plainPassword, 12);
};

// Compare password
userSchema.methods.comparePassword = function (plainPassword) {
    return bcrypt.compare(plainPassword, this.passwordHash);
};

// Remove sensitive fields from JSON response
userSchema.methods.toJSON = function () {
    const obj = this.toObject();

    delete obj.passwordHash;
    delete obj.__v;

    return obj;
};

module.exports = mongoose.model("User", userSchema);