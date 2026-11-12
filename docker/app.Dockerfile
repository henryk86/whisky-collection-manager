FROM node:22-bookworm-slim
# Debian-based Node.js 22 runtime for Raspberry Pi 4 (arm64). On Raspberry Pi OS
# 64-bit, the Alpine/musl variant segfaulted before application startup.
# Backup tools live in the same image. No SSH server; openssh-client is only
# needed for optional SFTP backup destinations configured through Rclone.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates restic rclone openssh-client \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
# Stop the build if /app/package.json or the lockfile is invalid. A broken
# package manifest prevents Node from even loading the app entrypoint.
RUN node -e 'const fs=require("node:fs"); for (const f of ["package.json","package-lock.json"]) JSON.parse(fs.readFileSync(f,"utf8"));' \
    && npm ci --omit=dev --ignore-scripts \
    && node -p 'require("./package.json").version' \
    && npm cache clean --force
COPY --chown=node:node public/ ./public/
COPY scripts/prepare-cutout-assets.js ./scripts/prepare-cutout-assets.js
# Fetch and verify the small ONNX model and WASM runtime at image-build time.
# Serving the app requires no external AI service or CDN.
RUN node scripts/prepare-cutout-assets.js
COPY --chown=node:node server/ ./server/
COPY --chown=node:node shared/ ./shared/
COPY --chown=node:node seed/ ./seed/
COPY --chown=node:node worker/ ./worker/
COPY --chown=node:node docker/entrypoint.js ./docker/entrypoint.js
# Check the final, installed entrypoint before producing an image.
RUN node --check docker/entrypoint.js \
    && node -p 'require("./package.json").version'
USER node
EXPOSE 3543
CMD ["node", "docker/entrypoint.js"]
