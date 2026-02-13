const supabase = require("../config/database");
const messages = require("../messages");

exports.generateLyrics = async (req, res) => {
    try {
        const { artist, description, max_length = 100, temperature = 0.9, top_p = 0.95, top_k = 50 } = req.body;
        
        // Create the prompt for lyrics generation
        const prompt = `Write a song in the style of ${artist} about ${description}:\n\nVerse 1:\n`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        // Call Hugging Face Inference API
        const response = await fetch(
            "https://router.huggingface.co/models/openai-community/gpt2",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: max_length,
                        temperature: temperature,
                        top_p: top_p,
                        top_k: top_k,
                        return_full_text: false,
                    },
                }),
                signal: controller.signal,
            }
        );
        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Hugging Face API error:", response.status, errorText);
            throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        // Extract the generated text from the response
        let generatedLyrics = "";
        if (Array.isArray(data) && data.length > 0) {
            generatedLyrics = data[0].generated_text || "";
        } else if (data.generated_text) {
            generatedLyrics = data.generated_text;
        } else {
            console.error("Unexpected response format:", data);
            generatedLyrics = "Error: Unexpected response format from AI model";
        }

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
            lyrics: generatedLyrics,
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