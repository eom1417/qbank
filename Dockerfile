# QBank in one container (M25): Node 24 for the API and the AI host, the reading tools, the
# official Claude Code and Codex CLIs for subscription sign-ins, and the built app.
# Everything the owner makes lives in /data (a volume): database, files, backups, AI sign-ins.
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    poppler-utils mupdf-tools tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng \
    ca-certificates bsdutils \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g @anthropic-ai/claude-code @openai/codex \
  && npm cache clean --force

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY . .
# The vendored AI kit must match its lock; its own exact packages come from its lockfile.
RUN node scripts/vendor-lock.mjs --check \
  && cd vendor/t3-ai-providers-kit/kit \
  && CI=true COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm@10 install --frozen-lockfile \
  && cd /app && ln -sfn ../vendor/t3-ai-providers-kit/kit/apps/server/node_modules ai-host/node_modules \
  && npm run build \
  && mkdir -p /data && chown -R node:node /data

USER node
ENV NODE_ENV=production \
    QBANK_DATA_DIR=/data/app \
    HOME=/data/home \
    QBANK_API_HOST=0.0.0.0 \
    QBANK_SHOW_PAIRING_LINK=1
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "scripts/qbank.mjs", "--no-open"]
