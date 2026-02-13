const supabase = require("../config/database");
const messages = require("../messages");

exports.generateLyrics = async (req, res) => {
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

        let { data: usageRow } = await supabase.from("api_usage").select("*").eq("user_id", req.user.userId).maybeSingle();

        if (!usageRow) {
            const { data: insertedUsage } = await supabase.from("api_usage").insert([{ user_id: req.user.userId, api_calls_count: 1 }]).select().single();
            usageRow = insertedUsage;
        } else {
            const newCount = usageRow.api_calls_count + 1;
            const { data: updatedUsage } = await supabase.from("api_usage").update({ api_calls_count: newCount }).eq("id", usageRow.id).select().single();
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
};