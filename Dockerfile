FROM python:3.13-slim

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv huggingface_hub

WORKDIR /app

COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

WORKDIR /app/apps/api

RUN uv sync --no-dev

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 7860
ENV PORT=7860

CMD ["/app/start.sh"]
