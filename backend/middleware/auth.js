const jwt = require("jsonwebtoken");
const messages = require("../messages");

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: messages.auth.tokenRequired });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error("Token verification error:", error);
        return res.status(403).json({ error: messages.auth.tokenInvalid });
    }
};

const checkAdmin = (req, res, next) => {
    if (!req.user.isAdmin) {
        return res.status(403).json({
            error: "Access denied",
            message: messages.auth.accessDenied,
        });
    }
    next();
};

module.exports = { authenticateToken, checkAdmin };