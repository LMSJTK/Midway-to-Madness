"""
Minimal HTTP wrapper around rembg for background removal.
POST /api/remove with image bytes -> returns PNG with alpha channel.
"""

from flask import Flask, request, Response
from rembg import remove
import io

app = Flask(__name__)


@app.route("/api/remove", methods=["POST"])
def remove_bg():
    input_bytes = request.get_data()
    if not input_bytes:
        return Response("No image data provided", status=400)

    output_bytes = remove(input_bytes)
    return Response(output_bytes, mimetype="image/png")


@app.route("/health", methods=["GET"])
def health():
    return Response("ok", status=200)


if __name__ == "__main__":
    # Pre-download the model on startup so the first request isn't slow
    print("Initializing rembg model...")
    remove(b"")  # triggers model download
    print("rembg ready")
    app.run(host="0.0.0.0", port=5000)
