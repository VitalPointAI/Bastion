# Ironclaw Agent Sidecar
# Builds from source to pick up latest features (Anthropic OAuth).
# Multi-stage build: Rust builder → slim runtime image.
#
# IRONCLAW_COMMIT pins the upstream SHA. Update this when you want a newer
# build — the Docker layer cache (and GHA build cache) will skip the Rust
# compile when the SHA hasn't changed.

FROM rust:1.87-bookworm AS builder

# ironclaw main now requires rust >= 1.92 (edition 2024).
# Upgrade toolchain since the Docker image ships 1.87.
RUN rustup update stable && rustup default stable

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Pin to specific commit so Docker/GHA cache is stable across deploys.
# Bump this SHA to pull in new upstream changes.
ARG IRONCLAW_COMMIT=56b72188974e042c379f9b74384a82bd0f5e8449
RUN git clone https://github.com/nearai/ironclaw.git . \
    && git checkout ${IRONCLAW_COMMIT}

RUN cargo build --release \
    && strip target/release/ironclaw

# --- Runtime stage ---
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/target/release/ironclaw /usr/local/bin/ironclaw
RUN chmod +x /usr/local/bin/ironclaw

RUN useradd -m -u 1000 -s /bin/bash ironclaw
USER ironclaw
WORKDIR /home/ironclaw

EXPOSE 8080

ENV RUST_LOG=ironclaw=info

ENTRYPOINT ["ironclaw"]
