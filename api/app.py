"""
TeamAI — Flask API
Minimal backend. Currently only /api/synthesis (scaffold).
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json, os

app = Flask(__name__)
CORS(app)


@app.route("/api/synthesis", methods=["POST"])
def synthesis():
    """
    Future endpoint: agrege les N réponses IA → Gemini Flash v4 → conclusion merge.
    Body: { "prompt": "...", "responses": [ { "provider": "...", "text": "..." } ] }
    """
    data = request.get_json(silent=True) or {}
    return jsonify({
        "status": "ok",
        "message": "Synthesis endpoint scaffolded — not yet implemented.",
        "prompt": data.get("prompt", ""),
        "responses_count": len(data.get("responses", [])),
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "app": "TeamAI API"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
