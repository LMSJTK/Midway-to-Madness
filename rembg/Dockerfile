FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir rembg[cpu] flask pillow

COPY rembg_server.py /app/rembg_server.py

WORKDIR /app
EXPOSE 5000

CMD ["python", "rembg_server.py"]
