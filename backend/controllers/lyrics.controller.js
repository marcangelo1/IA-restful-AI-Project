const supabase = require("../config/database");
const messages = require("../messages");

const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";

exports.generateLyrics = async (req, res) => {
    try {
        const { artist, description, max_length = 150, temperature = 0.8, top_p = 0.9, top_k, complete_song } = req.body;

        const systemPrompt = `You are a talented songwriter and lyricist. Generate original song lyrics based on the user's request. 
Format the output with clear verse/chorus/bridge structure using labels like [Verse 1], [Chorus], [Bridge], etc.
Only output the lyrics, no explanations or commentary.`;

        const userPrompt = `Write ${complete_song ? "a complete" : "partial"} song lyrics in the style of ${artist}. 
Theme/description: ${description}
${max_length ? `Approximate length: ${max_length} words.` : ""}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 50000);

        const response = await fetch(HF_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
            },
            body: JSON.stringify({
                model: "mistralai/Mistral-7B-Instruct-v0.3:hf-inference",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                max_tokens: max_length ? Math.min(max_length * 4, 1024) : 512,
                temperature: temperature || 0.8,
                top_p: top_p || 0.9,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Hugging Face API error: ${response.status} - ${errorBody}`);
            return res.status(502).json({
                error: messages.api.lyricsGenerationError,
                details: `Hugging Face API error: ${response.status} - ${errorBody}`,
            });
        }

        const data = await response.json();

        const generatedLyrics = data.choices?.[0]?.message?.content || "No lyrics generated.";

        // Update API usage count
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
            generated_lyrics: generatedLyrics,
            artist: artist,
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