"""
Minimal HTTP wrapper around rembg for background removal.
POST /api/remove with image bytes -> returns PNG with alpha channel.
"""

import io
import os
import threading

import onnxruntime as ort
from flask import Flask, Response, request
from PIL import Image
from rembg import new_session, remove

# rembg's own default is bria-rmbg: a 1.02GB model that infers at 1024x1024.
# Sprites here are downscaled to at most 260px right after the cutout, so u2net
# (168MB, 320x320) resolves far more detail than survives the resize. Override
# with REMBG_MODEL if a sharper cutout is ever worth the memory.
MODEL_NAME = os.getenv("REMBG_MODEL", "u2net")

# Request bodies are buffered whole, so an unbounded upload is an unbounded
# allocation. The backend posts single generated images, well under this.
MAX_UPLOAD_BYTES = int(os.getenv("REMBG_MAX_UPLOAD_BYTES", 16 * 1024 * 1024))

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES


def build_session():
    opts = ort.SessionOptions()
    # The arena keeps freed blocks around for reuse, holding RSS at the
    # high-water mark of the busiest request. Inference is serialized below, so
    # there is nothing to reuse it for.
    opts.enable_cpu_mem_arena = False
    threads = int(os.getenv("REMBG_THREADS", "2"))
    opts.intra_op_num_threads = threads
    opts.inter_op_num_threads = threads
    return new_session(MODEL_NAME, sess_opts=opts)


# One session for the life of the process. `remove()` builds a throwaway session
# when it isn't handed one, so without this every request re-downloads-or-reads
# the model off disk and rebuilds the ONNX graph before doing any work.
session = build_session()

# InferenceSession.run is thread-safe, but Flask's server is threaded by default
# and each concurrent inference allocates its own activations. Serializing keeps
# peak memory flat no matter how many requests land at once.
inference_lock = threading.Lock()


@app.route("/api/remove", methods=["POST"])
def remove_bg():
    input_bytes = request.get_data()
    if not input_bytes:
        return Response("No image data provided", status=400)

    with inference_lock:
        output_bytes = remove(input_bytes, session=session)
    return Response(output_bytes, mimetype="image/png")


@app.route("/health", methods=["GET"])
def health():
    return Response("ok", status=200)


if __name__ == "__main__":
    # Building the session above already fetched the weights; run one inference
    # so the first real request doesn't pay for allocating activation buffers.
    print(f"Warming up rembg model '{MODEL_NAME}'...")
    warmup = io.BytesIO()
    Image.new("RGB", (1, 1)).save(warmup, format="PNG")
    remove(warmup.getvalue(), session=session)

    print("rembg ready")
    app.run(host="0.0.0.0", port=5000)
