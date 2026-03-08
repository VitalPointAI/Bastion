# Ironclaw Agent Sidecar
# Builds from source (main branch) to pick up latest features (Anthropic OAuth).
# Multi-stage build: Rust builder → slim runtime image.

FROM rust:1.87-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone and build from main (includes PR #384: Anthropic OAuth support)
ARG IRONCLAW_COMMIT=main
RUN git clone --depth 1 https://github.com/nearai/ironclaw.git . \
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
