FROM python:3.13-slim

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgomp1 \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

# Pull the local packages from the monorepo (not in this subtree)
RUN git clone --depth=1 https://github.com/vees-1/lumina.git /tmp/lumina && \
    mkdir -p /app/packages && \
    cp -r /tmp/lumina/packages/. /app/packages/ && \
    rm -rf /tmp/lumina

# App code (subtree push puts apps/api contents here at repo root)
WORKDIR /app/apps/api
COPY . .

# Database — committed via git LFS at data/orpha.sqlite in Space root
# Path resolves to ../../data from WORKDIR = /app/data/orpha.sqlite
RUN mkdir -p /app/data
COPY data/orpha.sqlite /app/data/orpha.sqlite

# Install dependencies — local packages resolve via ../../packages = /app/packages
RUN uv sync --frozen --no-dev

EXPOSE 7860

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
