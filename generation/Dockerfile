# ============================================================
# ModelInSitu Generation Backend
# Python 3.11 + Node.js 20
# ============================================================
FROM python:3.11-slim

# --- Dépendances système ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    ca-certificates \
    libglu1-mesa \
    libgl1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# --- Node.js 20 ---
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Python — couche cachée si requirements.txt n'a pas changé ---
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Node.js — couche cachée si package.json n'a pas changé ---
COPY package.json .
RUN npm install --omit=dev

# --- Code applicatif ---
COPY . .

# --- Répertoire de sortie des générations ---
RUN mkdir -p /tmp/generation-output

# --- Variables d'environnement par défaut (surchargeables dans Railway) ---
ENV GENERATION_OUTPUT_DIR=/tmp/generation-output
ENV PYTHON_BIN=python3
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["python", "api-generate.py"]
