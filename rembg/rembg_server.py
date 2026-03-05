"""
Minimal HTTP wrapper around rembg for background removal.
POST /api/remove with image bytes -> returns PNG with alpha channel.
"""

from flask import Flask, request, Response
from rembg import remove
from PIL import Image
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
    print("Initializing rembg model...")
    
    # Create a dummy 1x1 valid image to trigger the model download safely
    dummy_img = Image.new('RGB', (1, 1))
    img_byte_arr = io.BytesIO()
    dummy_img.save(img_byte_arr, format='PNG')
    
    remove(img_byte_arr.getvalue()) 
    
    print("rembg ready")
    app.run(host="0.0.0.0", port=5000)
