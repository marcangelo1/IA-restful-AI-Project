const supabase = require("../config/database");
const messages = require("../messages");

exports.getAllUsers = async (req, res) => {
    try {
        const { data: users } = await supabase.from("users").select("id, email, first_name, is_admin, created_at");

        const usersWithUsage = await Promise.all(
            users.map(async (user) => {
                const { data: usageRow } = await supabase.from("api_usage").select("api_calls_count").eq("user_id", user.id).maybeSingle();
                return { ...user, apiCallsCount: usageRow ? usageRow.api_calls_count : 0 };
            })
        );

        res.json(usersWithUsage);
    } catch (error) {
        console.error("Error fetching admin users:", error);
        res.status(500).json({ error: messages.error.failedToLoadUsers, details: error.message });
    }
};

exports.resetApiCount = async (req, res) => {
    try {
        const { userId } = req.params;

        let { data: usageRow } = await supabase.from("api_usage").select("*").eq("user_id", userId).maybeSingle();

        if (!usageRow) {
            await supabase.from("api_usage").insert([{ user_id: userId, api_calls_count: 0 }]);
        } else {
            await supabase.from("api_usage").update({ api_calls_count: 0 }).eq("id", usageRow.id);
        }

        res.json({ success: true, message: messages.api.apiCountReset });
    } catch (error) {
        console.error("Error resetting API count:", error);
        res.status(500).json({ error: messages.error.failedToResetApiCount, details: error.message });
    }
};

exports.getStats = async (req, res) => {
    try {
        const { count: totalUsers } = await supabase.from("users").select("*", { count: "exact", head: true });
        const { data: apiCallsData } = await supabase.from("users").select("api_calls_count");
        const totalApiCalls = apiCallsData.reduce((sum, user) => sum + user.api_calls_count, 0);
        const { data: limitedUsers } = await supabase.from("users").select("id").gte("api_calls_count", 20);

        res.json({
            totalUsers,
            totalApiCalls,
            usersAtLimit: limitedUsers.length,
            averageApiCallsPerUser: totalUsers > 0 ? totalApiCalls / totalUsers : 0,
        });
    } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ error: messages.error.failedToFetchStats, details: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: messages.validation.userIdRequired });
    }

    try {
        const { data: user } = await supabase.from("users").select("id").eq("id", id).single();

        if (!user) {
            return res.status(404).json({ error: messages.api.userNotFound });
        }

        await supabase.from("users").delete().eq("id", id);
        res.json({ message: messages.api.userDeleted });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: messages.error.failedToDeleteUser, details: error.message });
    }
};

exports.getEndpointStats = async (req, res) => {
    try {
        const { data } = await supabase.from("api_stats").select("*").order("calls", { ascending: false });
        res.json(data);
    } catch (error) {
        console.error("Error fetching API stats:", error);
        res.status(500).json({ error: messages.error.failedToFetchStats, details: error.message });
    }
};