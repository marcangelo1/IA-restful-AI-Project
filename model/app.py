import os
os.environ['TRANSFORMERS_CACHE'] = '/data/cache'

from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import torch

app = Flask(__name__)
CORS(app)

MODEL_NAME = "Blackop29/gpt-neo-lyrics-combined"
print(f"Loading model from Hugging Face: {MODEL_NAME}...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)

if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

device = 0 if torch.cuda.is_available() else -1
generator = pipeline('text-generation', model=model, tokenizer=tokenizer, device=device)

print("Model loaded successfully!")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'model': MODEL_NAME})

@app.route('/generate-pop-lyrics', methods=['POST'])
def generate_lyrics():
    try:
        data = request.get_json()
        
        artist = data.get('artist', 'a pop artist')
        description = data.get('description', 'love and life')
        max_length = data.get('max_length', 100)
        temperature = data.get('temperature', 0.9)
        top_p = data.get('top_p', 0.95)
        top_k = data.get('top_k', 50)
        
        prompt = f"""Write a song in the style of {artist} about {description}.

[Verse 1]
"""
        
        result = generator(
            prompt,
            max_new_tokens=max_length,
            temperature=temperature,
            top_p=top_p,
            top_k=top_k,
            num_return_sequences=1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
            repetition_penalty=1.2,
            no_repeat_ngram_size=3
        )
        
        lyrics = result[0]['generated_text'].replace(prompt, "").strip()
        
        return jsonify({
            'lyrics': lyrics,
            'metadata': {'artist': artist, 'description': description}
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)