const supabase = require("../config/database");
const messages = require("../messages");

exports.getProfile = async (req, res) => {
    try {
        const { data: userData } = await supabase.from("users").select("id, email, first_name, is_admin, created_at").eq("id", req.user.userId).single();

        if (!userData) {
            return res.status(404).json({ error: messages.api.userNotFound });
        }

        const { data: usageRow } = await supabase.from("api_usage").select("api_calls_count").eq("user_id", req.user.userId).maybeSingle();
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
};