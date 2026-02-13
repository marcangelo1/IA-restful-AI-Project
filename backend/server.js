const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
const { deepSanitize } = require("./validators/validation");
const logApiCall = require("./middleware/logging");
const supabase = require("./config/database");

dotenv.config();

const app = express();

app.use(
    cors({
        origin: [
            "https://generate-lyrics.netlify.app",
            "https://lyrics-generator-backend.onrender.com",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
        ],
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);

app.use(express.json());
app.use((req, res, next) => {
    if (req.body) req.body = deepSanitize(req.body);
    next();
});

// Test routes
app.get("/api/test", (req, res) => {
    res.json({ message: "Backend server is running!" });
});

app.get("/api/test-db", async (req, res) => {
    try {
        const { data, error } = await supabase.from("users").select("*").limit(1);
        if (error) throw error;
        res.json({ message: "Supabase connection successful!", connection: "successful", data: data || [] });
    } catch (error) {
        console.error("Supabase connection error:", error);
        res.status(500).json({ error: "Failed to connect to database", details: error.message });
    }
});

// API v1 router
const v1Router = express.Router();
v1Router.use(logApiCall);

// Import routes
const authRoutes = require("./routes/auth.routes");
const lyricsRoutes = require("./routes/lyrics.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");

// Mount routes
v1Router.use("/auth", authRoutes);
v1Router.use("/", lyricsRoutes);
v1Router.use("/user", userRoutes);
v1Router.use("/admin", adminRoutes);

app.use("/api/v1", v1Router);

// Legacy redirects
app.use("/api/user", (req, res) => res.redirect(307, `/api/v1/user${req.url}`));
app.use("/api/admin", (req, res) => res.redirect(307, `/api/v1/admin${req.url}`));
app.use("/api/auth", (req, res) => res.redirect(307, `/api/v1/auth${req.url}`));
app.use("/api/generate-lyrics", (req, res) => res.redirect(307, `/api/v1/generate-lyrics`));

// Swagger docs
const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));
app.use("/doc", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err);
    if (err.name === "ValidationError") {
        return res.status(400).json({ error: "Validation Failed", details: err.errors });
    }
    res.status(500).json({ error: "Server error", message: err.message || "An unexpected error occurred" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
});