# Ironclaw Agent Sidecar
# Downloads pre-built release binary from GitHub releases.
# Pin version via build arg: docker build --build-arg IRONCLAW_VERSION=0.16.1 .

ARG IRONCLAW_VERSION=0.16.1

FROM debian:bookworm-slim

ARG IRONCLAW_VERSION

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL \
    "https://github.com/nearai/ironclaw/releases/download/v${IRONCLAW_VERSION}/ironclaw-x86_64-unknown-linux-gnu.tar.gz" \
    | tar -xz --strip-components=1 -C /usr/local/bin ironclaw-x86_64-unknown-linux-gnu/ironclaw \
    && chmod +x /usr/local/bin/ironclaw

RUN useradd -m -u 1000 -s /bin/bash ironclaw
USER ironclaw
WORKDIR /home/ironclaw

EXPOSE 8080

ENV RUST_LOG=ironclaw=info

ENTRYPOINT ["ironclaw"]
