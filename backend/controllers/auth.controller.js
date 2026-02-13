const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const supabase = require("../config/database");
const messages = require("../messages");
const { sendPasswordResetEmail } = require("../utils/email");

exports.register = async (req, res) => {
    try {
        const { first_name, email, password } = req.body;

        if (!first_name || !email || !password) {
            return res.status(400).json({ error: messages.auth.missingFields });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert([{ first_name, email, password: hashedPassword, is_admin: false }])
            .select();

        if (insertError) throw insertError;

        await supabase.from("api_usage").insert([{ user_id: newUser[0].id, api_calls_count: 0 }]);

        const token = jwt.sign(
            { userId: newUser[0].id, email: newUser[0].email, first_name: newUser[0].first_name, isAdmin: newUser[0].is_admin },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.status(201).json({
            message: messages.auth.registerSuccess,
            token,
            user: { id: newUser[0].id, email: newUser[0].email, firstName: newUser[0].first_name, isAdmin: newUser[0].is_admin },
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ error: messages.error.registrationFailed, details: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: messages.auth.missingCredentials });
        }

        const { data: user, error: fetchError } = await supabase.from("users").select("*").eq("email", email).single();

        if (fetchError || !user) {
            return res.status(401).json({ error: messages.auth.loginFailure });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: messages.auth.loginFailure });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, first_name: user.first_name, isAdmin: user.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        res.json({
            message: messages.auth.loginSuccess,
            token,
            user: { id: user.id, email: user.email, firstName: user.first_name, isAdmin: user.is_admin, apiCallsCount: user.api_calls_count },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: messages.error.loginFailed, details: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const { data: user } = await supabase.from("users").select("id, email, first_name").eq("email", email).single();

        res.json({ message: messages.auth.passwordResetSent });

        if (!user) return;

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpiry = new Date(Date.now() + 3600000);

        await supabase.from("password_reset_tokens").delete().eq("user_id", user.id);
        await supabase.from("password_reset_tokens").insert([{ user_id: user.id, token: resetToken, expires_at: resetTokenExpiry, used: false }]);

        await sendPasswordResetEmail(user.email, user.first_name, resetToken);
    } catch (error) {
        console.error("Password reset error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: messages.error.failedToResetPassword, message: error.message });
        }
    }
};

exports.verifyResetToken = async (req, res) => {
    try {
        const { token, email } = req.query;

        if (!token || !email) {
            return res.status(400).json({ error: "Missing token or email" });
        }

        const { data: user } = await supabase.from("users").select("id").eq("email", email).single();
        if (!user) {
            return res.status(400).json({ error: messages.auth.invalidResetRequest });
        }

        const { data: tokenData } = await supabase.from("password_reset_tokens").select("*").eq("token", token).eq("user_id", user.id).eq("used", false).single();

        if (!tokenData || new Date(tokenData.expires_at) < new Date()) {
            return res.status(400).json({ error: messages.auth.invalidToken });
        }

        res.json({ valid: true });
    } catch (error) {
        console.error("Token verification error:", error);
        res.status(500).json({ error: messages.error.failedToResetPassword, details: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, email, password } = req.body;

        const { data: user } = await supabase.from("users").select("id").eq("email", email).single();
        if (!user) {
            return res.status(400).json({ error: messages.auth.invalidResetRequest });
        }

        const { data: tokenData } = await supabase.from("password_reset_tokens").select("*").eq("token", token).eq("user_id", user.id).eq("used", false).single();

        if (!tokenData || new Date(tokenData.expires_at) < new Date()) {
            return res.status(400).json({ error: messages.auth.invalidToken });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await supabase.from("users").update({ password: hashedPassword }).eq("id", user.id);
        await supabase.from("password_reset_tokens").update({ used: true }).eq("id", tokenData.id);

        res.json({ message: messages.auth.passwordResetSuccess });
    } catch (error) {
        console.error("Password reset error:", error);
        res.status(500).json({ error: messages.error.failedToResetPassword, details: error.message });
    }
};