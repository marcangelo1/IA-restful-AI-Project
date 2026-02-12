const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
    validate,
    deepSanitize,
    registrationValidation,
    loginValidation,
    generateLyricsValidation,
    userIdValidation,
    forgotPasswordValidation,
    resetPasswordValidation,
} = require("./validation");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
const messages = require("./messages");

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_KEY || supabaseKey);

const app = express();
app.use(
    cors({
        origin: [
            "https://generate-lyrics.netlify.app/",
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
    if (req.body) {
        req.body = deepSanitize(req.body);
    }
    next();
});

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

const logApiCall = async (req, res, next) => {
    if (!req.originalUrl.startsWith("/api") || req.originalUrl === "/api/test" || req.originalUrl === "/api/test-db") {
        return next();
    }

    try {
        let endpoint = req.originalUrl;
        endpoint = endpoint.replace(/\/[0-9a-fA-F-]{36}(?:\/|$)/g, "/:id/");
        endpoint = endpoint.replace(/\/\d+(?:\/|$)/g, "/:id/");

        const method = req.method;

        const { data, error: selectError } = await supabase.from("api_stats").select("*").eq("endpoint", endpoint).eq("method", method).maybeSingle();

        if (selectError) {
            console.error("Error checking API stats entry:", selectError);
            return next();
        }

        if (data) {
            const { error: updateError } = await supabase
                .from("api_stats")
                .update({ calls: data.calls + 1 })
                .eq("id", data.id);

            if (updateError) {
                console.error("Error updating API stats:", updateError);
            }
        } else {
            const { error: insertError } = await supabase.from("api_stats").insert([{ endpoint, method, calls: 1 }]);

            if (insertError) {
                console.error("Error inserting API stats:", insertError);
            }
        }
    } catch (error) {
        console.error("API logging error:", error);
    }

    next();
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

const v1Router = express.Router();

v1Router.use(logApiCall);

app.use("/api/v1", v1Router);

app.get("/api/test", (req, res) => {
    res.json({ message: "Backend server is running!" });
});

app.get("/api/test-db", async (req, res) => {
    try {
        const { data, error } = await supabase.from("users").select("*").limit(1);

        if (error) {
            if (error.code === "42P01") {
                return res.json({
                    message: "Connected to Supabase, but users table not found.",
                    connection: "successful",
                    error: error.message,
                });
            }
            throw error;
        }

        res.json({
            message: "Supabase connection successful!",
            connection: "successful",
            data: data || [],
        });
    } catch (error) {
        console.error("Supabase connection error:", error);
        res.status(500).json({
            error: "Failed to connect to database",
            details: error.message,
        });
    }
});

app.use("/api/user", (req, res) => {
    res.redirect(307, `/api/v1/user${req.url}`);
});

app.use("/api/admin", (req, res) => {
    res.redirect(307, `/api/v1/admin${req.url}`);
});

app.use("/api/auth", (req, res) => {
    res.redirect(307, `/api/v1/auth${req.url}`);
});

app.use("/api/generate-lyrics", (req, res) => {
    res.redirect(307, `/api/v1/generate-lyrics`);
});

app.use(logApiCall);

v1Router.post("/generate-lyrics", authenticateToken, generateLyricsValidation, validate, async (req, res) => {
    try {
        const requestBody = {
            artist: req.body.artist,
            description: req.body.description,
            max_length: req.body.max_length,
            temperature: req.body.temperature,
            top_p: req.body.top_p,
            top_k: req.body.top_k,
            complete_song: req.body.complete_song,
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 50000);

        const response = await fetch("http://146.190.124.66:8000/generate-pop-lyrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        const data = await response.json();

        let { data: usageRow, error: usageSelectError } = await supabase.from("api_usage").select("*").eq("user_id", req.user.userId).maybeSingle();

        if (usageSelectError) {
            console.error("Error fetching usage row:", usageSelectError);
        }

        if (!usageRow) {
            const { data: insertedUsage, error: usageInsertError } = await supabase
                .from("api_usage")
                .insert([{ user_id: req.user.userId, api_calls_count: 1 }])
                .select()
                .single();

            if (usageInsertError) {
                console.error("Error inserting new usage row:", usageInsertError);
            }
            usageRow = insertedUsage;
        } else {
            const newCount = usageRow.api_calls_count + 1;
            const { data: updatedUsage, error: usageUpdateError } = await supabase
                .from("api_usage")
                .update({ api_calls_count: newCount })
                .eq("id", usageRow.id)
                .select()
                .single();

            if (usageUpdateError) {
                console.error("Error updating usage row:", usageUpdateError);
            }
            usageRow = updatedUsage;
        }

        const hasReachedLimit = usageRow.api_calls_count >= 20;

        res.json({
            ...data,
            apiCallsCount: usageRow.api_calls_count,
            limitReached: hasReachedLimit,
            limitMessage: hasReachedLimit ? messages.api.apiLimitReached : null,
        });
    } catch (error) {
        if (error.name === "AbortError") {
            return res.status(408).json({ error: messages.api.lyricsTimeout });
        }
        console.error("Error generating lyrics:", error);
        res.status(500).json({ error: messages.api.lyricsGenerationError, details: error.message });
    }
});

v1Router.post("/auth/register", registrationValidation, validate, async (req, res) => {
    try {
        const { first_name, email, password } = req.body;

        if (!first_name || !email || !password) {
            return res.status(400).json({ error: messages.auth.missingFields });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert([
                {
                    first_name,
                    email,
                    password: hashedPassword,
                    is_admin: false,
                },
            ])
            .select();

        if (insertError) {
            throw insertError;
        }

        const { error: usageError } = await supabase.from("api_usage").insert([
            {
                user_id: newUser[0].id,
                api_calls_count: 0,
            },
        ]);

        if (usageError) {
            console.error("Error creating API usage entry:", usageError);
        }

        const token = jwt.sign(
            {
                userId: newUser[0].id,
                email: newUser[0].email,
                first_name: newUser[0].first_name,
                isAdmin: newUser[0].is_admin,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.status(201).json({
            message: messages.auth.registerSuccess,
            token,
            user: {
                id: newUser[0].id,
                email: newUser[0].email,
                firstName: newUser[0].first_name,
                isAdmin: newUser[0].is_admin,
            },
        });
    } catch (error) {
        console.error("FULL Registration error:", error);
        res.status(500).json({
            error: messages.error.registrationFailed,
            details: error.message,
        });
    }
});

v1Router.post("/auth/login", loginValidation, validate, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: messages.auth.missingCredentials });
        }

        const { data: user, error: fetchError } = await supabase.from("users").select("*").eq("email", email).single();

        if (fetchError) {
            if (fetchError.code === "PGRST116") {
                return res.status(401).json({ error: messages.auth.loginFailure });
            }
            throw fetchError;
        }

        if (!user) {
            return res.status(401).json({ error: messages.auth.loginFailure });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: messages.auth.loginFailure });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                first_name: user.first_name,
                isAdmin: user.is_admin,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.json({
            message: messages.auth.loginSuccess,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                isAdmin: user.is_admin,
                apiCallsCount: user.api_calls_count,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: messages.error.loginFailed, details: error.message });
    }
});

v1Router.get("/user/profile", authenticateToken, async (req, res) => {
    try {
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id, email, first_name, is_admin, created_at")
            .eq("id", req.user.userId)
            .single();

        if (userError) {
            console.error("Error fetching user:", userError);
            return res.status(500).json({ error: messages.api.databaseError, details: userError.message });
        }
        if (!userData) {
            return res.status(404).json({ error: messages.api.userNotFound });
        }

        const { data: usageRow, error: usageSelectError } = await supabase
            .from("api_usage")
            .select("api_calls_count")
            .eq("user_id", req.user.userId)
            .maybeSingle();

        if (usageSelectError) {
            console.error("Error fetching usage row:", usageSelectError);
        }

        const usageCount = usageRow ? usageRow.api_calls_count : 0;

        res.json({
            id: userData.id,
            email: userData.email,
            firstName: userData.first_name,
            isAdmin: userData.is_admin,
            apiCallsCount: usageCount,
            createdAt: userData.created_at,
        });
    } catch (error) {
        console.error("Error in user profile:", error);
        res.status(500).json({ error: messages.api.serverError, details: error.message });
    }
});

v1Router.get("/admin/users", authenticateToken, checkAdmin, async (req, res) => {
    try {
        const { data: users, error } = await supabase.from("users").select("id, email, first_name, is_admin, created_at");
        if (error) throw error;

        const usersWithUsage = await Promise.all(
            users.map(async (user) => {
                const { data: usageRow, error: usageSelectError } = await supabase
                    .from("api_usage")
                    .select("api_calls_count")
                    .eq("user_id", user.id)
                    .maybeSingle();

                let usageCount = 0;
                if (!usageSelectError && usageRow) {
                    usageCount = usageRow.api_calls_count;
                }

                return {
                    ...user,
                    apiCallsCount: usageCount,
                };
            })
        );

        res.json(usersWithUsage);
    } catch (error) {
        console.error("Error fetching admin users:", error);
        res.status(500).json({ error: messages.error.failedToLoadUsers, details: error.message });
    }
});

v1Router.post("/admin/reset-api-count/:userId", authenticateToken, checkAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        let { data: usageRow, error: usageSelectError } = await supabase.from("api_usage").select("*").eq("user_id", userId).maybeSingle();

        if (usageSelectError) {
            console.error("Error fetching usage row:", usageSelectError);
        }

        if (!usageRow) {
            const { error: usageInsertError } = await supabase.from("api_usage").insert([{ user_id: userId, api_calls_count: 0 }]);
            if (usageInsertError) {
                throw usageInsertError;
            }
        } else {
            const { error: usageUpdateError } = await supabase.from("api_usage").update({ api_calls_count: 0 }).eq("id", usageRow.id);
            if (usageUpdateError) {
                throw usageUpdateError;
            }
        }

        res.json({ success: true, message: messages.api.apiCountReset });
    } catch (error) {
        console.error("Error resetting API count:", error);
        res.status(500).json({ error: messages.error.failedToResetApiCount, details: error.message });
    }
});

v1Router.get("/admin/stats", authenticateToken, checkAdmin, async (req, res) => {
    try {
        const { count: totalUsers, error: countError } = await supabase.from("users").select("*", { count: "exact", head: true });

        if (countError) {
            throw countError;
        }

        const { data: apiCallsData, error: apiCallsError } = await supabase.from("users").select("api_calls_count");

        if (apiCallsError) {
            throw apiCallsError;
        }

        const totalApiCalls = apiCallsData.reduce((sum, user) => sum + user.api_calls_count, 0);

        const { data: limitedUsers, error: limitedError } = await supabase.from("users").select("id").gte("api_calls_count", 20);

        if (limitedError) {
            throw limitedError;
        }

        res.json({
            totalUsers,
            totalApiCalls,
            usersAtLimit: limitedUsers.length,
            averageApiCallsPerUser: totalUsers > 0 ? totalApiCalls / totalUsers : 0,
        });
    } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({
            error: messages.error.failedToFetchStats,
            details: error.message,
        });
    }
});

v1Router.delete("/admin/users/:id", authenticateToken, checkAdmin, userIdValidation, validate, async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: messages.validation.userIdRequired });
    }

    try {
        const { data: user, error: userError } = await supabase.from("users").select("id").eq("id", id).single();

        if (userError || !user) {
            return res.status(404).json({ error: messages.api.userNotFound });
        }
        const { error: deleteError } = await supabase.from("users").delete().eq("id", id);

        if (deleteError) {
            throw deleteError;
        }

        res.json({ message: messages.api.userDeleted });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: messages.error.failedToDeleteUser, details: error.message });
    }
});

v1Router.get("/admin/endpoint-stats", authenticateToken, checkAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase.from("api_stats").select("*").order("calls", { ascending: false });

        if (error) {
            throw error;
        }

        res.json(data);
    } catch (error) {
        console.error("Error fetching API stats:", error);
        res.status(500).json({
            error: messages.error.failedToFetchStats,
            details: error.message,
        });
    }
});

app.use((err, req, res, next) => {
    console.error("Server error:", err);

    if (err.name === "ValidationError") {
        return res.status(400).json({
            error: "Validation Failed",
            details: err.errors,
        });
    }

    res.status(500).json({
        error: messages.api.serverError,
        message: err.message || "An unexpected error occurred",
    });
});

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

v1Router.post("/auth/forgot-password", forgotPasswordValidation, validate, async (req, res) => {
    console.log("FORGOT PASSWORD REQUEST RECEIVED:", req.body);

    try {
        const { email } = req.body;
        console.log("Processing password reset for email:", email);

        const { data: user, error: userError } = await supabase.from("users").select("id, email, first_name").eq("email", email).single();

        console.log("User lookup result:", user ? "User found" : "User not found", userError ? `Error: ${userError.message}` : "No error");

        res.json({
            message: messages.auth.passwordResetSent,
        });

        if (!user) {
            console.log("No user found with that email, skipping reset token creation");
            return;
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        console.log("Generated reset token for user:", user.id);

        try {
            const { data: tableCheck, error: tableError } = await supabase.from("password_reset_tokens").select("*").limit(1);

            console.log("Table check result:", tableError ? `Error: ${tableError.message}` : "Table exists");

            if (tableError && tableError.code === "42P01") {
                console.log("Creating password_reset_tokens table as it doesn't exist");

                console.error("The password_reset_tokens table doesn't exist in the database!");
                return;
            }
        } catch (tableCheckError) {
            console.error("Error checking for table:", tableCheckError);
        }

        try {
            const { error: deleteError } = await supabase.from("password_reset_tokens").delete().eq("user_id", user.id);

            if (deleteError) {
                console.log("Error deleting existing tokens:", deleteError);
            } else {
                console.log("Cleared any existing tokens for user");
            }
        } catch (deleteErr) {
            console.error("Error when trying to delete old tokens:", deleteErr);
        }

        console.log("Attempting to insert token with data:", {
            user_id: user.id,
            token: resetToken.substring(0, 10) + "...", // Only log part of the token for security
            expires_at: resetTokenExpiry,
            used: false,
        });

        const { data: insertData, error: insertError } = await supabase
            .from("password_reset_tokens")
            .insert([
                {
                    user_id: user.id,
                    token: resetToken,
                    expires_at: resetTokenExpiry,
                    used: false,
                },
            ])
            .select();

        if (insertError) {
            console.error("Error inserting reset token:", insertError);
            console.error("Error code:", insertError.code);
            console.error("Error message:", insertError.message);
            console.error("Error details:", insertError.details);
            return;
        }

        console.log("Reset token stored successfully:", insertData ? "Data returned" : "No data returned");
        console.log("About to attempt sending password reset email");

        const resetUrl = `${process.env.FRONTEND_URL}reset_password.html?token=${resetToken}&email=${encodeURIComponent(email)}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Password Reset - Lyrics Generator",
            html: `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
    <h1 style="color: #4a6ee0;">Reset Your Password</h1>
    <p>Hi ${user.first_name || "there"},</p>
    <p>We received a request to reset your password for your Lyrics Generator account.</p>
    <p>Click the button below to set a new password:</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4a6ee0; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
    </p>
    <p><strong>Note:</strong> This link is valid for 1 hour.</p>
    <p>If you didn't request this, please ignore this email or contact support if you have concerns.</p>
    <p>Best regards,<br>The Lyrics Generator Team</p>
  </div>
</body>
</html>
`,
        };

        try {
            console.log("Attempting to send email via transporter");
            const info = await transporter.sendMail(mailOptions);
            console.log("Password reset email sent successfully:", info.messageId);
        } catch (emailError) {
            console.error("Failed to send password reset email:", emailError);
            console.error("Email error details:", emailError.message);
            if (emailError.code) console.error("Email error code:", emailError.code);
        }
    } catch (error) {
        console.error("Detailed password reset error:", error);
        if (!res.headersSent) {
            res.status(500).json({
                error: messages.error.failedToResetPassword,
                message: error.message,
            });
        }
    }
});

v1Router.get("/auth/verify-reset-token", async (req, res) => {
    try {
        const { token, email } = req.query;

        if (!token || !email) {
            return res.status(400).json({ error: "Missing token or email" });
        }

        const { data: user, error: userError } = await supabase.from("users").select("id").eq("email", email).single();

        if (userError || !user) {
            return res.status(400).json({ error: messages.auth.invalidResetRequest });
        }

        const { data: tokenData, error: tokenError } = await supabase
            .from("password_reset_tokens")
            .select("*")
            .eq("token", token)
            .eq("user_id", user.id)
            .eq("used", false)
            .single();

        if (tokenError || !tokenData) {
            return res.status(400).json({ error: messages.auth.invalidToken });
        }

        if (new Date(tokenData.expires_at) < new Date()) {
            return res.status(400).json({ error: messages.auth.tokenExpired });
        }

        res.json({ valid: true });
    } catch (error) {
        console.error("Token verification error:", error);
        res.status(500).json({ error: messages.error.failedToResetPassword, details: error.message });
    }
});

v1Router.put("/auth/reset-password", resetPasswordValidation, validate, async (req, res) => {
    try {
        const { token, email, password } = req.body;

        const { data: user, error: userError } = await supabase.from("users").select("id").eq("email", email).single();

        if (userError || !user) {
            return res.status(400).json({ error: messages.auth.invalidResetRequest });
        }

        const { data: tokenData, error: tokenError } = await supabase
            .from("password_reset_tokens")
            .select("*")
            .eq("token", token)
            .eq("user_id", user.id)
            .eq("used", false)
            .single();

        if (tokenError || !tokenData) {
            return res.status(400).json({ error: messages.auth.invalidToken });
        }

        if (new Date(tokenData.expires_at) < new Date()) {
            return res.status(400).json({ error: messages.auth.tokenExpired });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const { error: updateError } = await supabase.from("users").update({ password: hashedPassword }).eq("id", user.id);

        if (updateError) {
            throw updateError;
        }

        await supabase.from("password_reset_tokens").update({ used: true }).eq("id", tokenData.id);

        res.json({ message: messages.auth.passwordResetSuccess });
    } catch (error) {
        console.error("Password reset error:", error);
        res.status(500).json({ error: messages.error.failedToResetPassword, details: error.message });
    }
});

const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));
app.use("/doc", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
});
