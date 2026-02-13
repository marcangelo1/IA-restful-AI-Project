const supabase = require("../config/database");

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
            await supabase.from("api_stats").update({ calls: data.calls + 1 }).eq("id", data.id);
        } else {
            await supabase.from("api_stats").insert([{ endpoint, method, calls: 1 }]);
        }
    } catch (error) {
        console.error("API logging error:", error);
    }

    next();
};

module.exports = logApiCall;