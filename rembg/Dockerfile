FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Pinned deliberately: rembg changed its default model to a 1GB one between
# releases, and an unpinned rebuild is how that arrived here unannounced.
RUN pip install --no-cache-dir "rembg[cpu]==2.0.81" "flask==3.1.3" pillow

# Weights live here so compose can mount a volume over it and the download
# survives container rebuilds. rembg defaults this to ~/.rembg, which does not.
ENV REMBG_HOME=/models
RUN mkdir -p /models

COPY rembg_server.py /app/rembg_server.py

WORKDIR /app
EXPOSE 5000

CMD ["python", "rembg_server.py"]
