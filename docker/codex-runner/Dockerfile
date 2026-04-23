FROM node:20-alpine

WORKDIR /workspace

# Deterministic runtime baseline for Codex sandbox jobs.
# Keep deps locked; no dev deps.
COPY package*.json ./
RUN npm ci --omit=dev

# Codex CLI/runtime is expected to be provided in the image at build time
# (or via a wrapper entrypoint in your infra).
# This image is a baseline for reproducible Node+deps behavior.

CMD ["node", "--version"]
