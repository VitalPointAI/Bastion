# Ironclaw Agent Sidecar
# Downloads prebuilt release binary from GitHub — no Rust compile needed.
# Build time: ~10 seconds vs ~10 minutes from source.
#
# IRONCLAW_VERSION pins the release tag. Update this to pull a newer release.

FROM debian:bookworm-slim

ARG IRONCLAW_VERSION=0.23.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3 curl \
    && rm -rf /var/lib/apt/lists/*

# Download prebuilt binary from GitHub release
RUN curl -fsSL "https://github.com/nearai/ironclaw/releases/download/ironclaw-v${IRONCLAW_VERSION}/ironclaw-x86_64-unknown-linux-gnu.tar.gz" \
    -o /tmp/ironclaw.tar.gz \
    && tar -xzf /tmp/ironclaw.tar.gz -C /tmp \
    && find /tmp -name ironclaw -type f -exec mv {} /usr/local/bin/ironclaw \; \
    && chmod +x /usr/local/bin/ironclaw \
    && rm -rf /tmp/ironclaw*

# Write version for runtime reporting
RUN echo "${IRONCLAW_VERSION}" > /tmp/ironclaw-version

# Token-sync entrypoint: reads refreshed OAuth tokens from shared volume
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

RUN useradd -m -u 1000 -s /bin/bash ironclaw
USER ironclaw
WORKDIR /home/ironclaw

EXPOSE 8080

ENV RUST_LOG=ironclaw=info

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
