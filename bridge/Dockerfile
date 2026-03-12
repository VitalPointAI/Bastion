FROM python:3.11-slim

WORKDIR /app

# Copy shared robot common package (normalised discovery schema, models, etc.)
COPY robot/common/ /app/robot/common/
COPY robot/models.py /app/robot/models.py
# robot/__init__.py may or may not exist — COPY with a shell trick via RUN below
# We use a RUN copy so the build doesn't fail if the file is absent.

# Copy bridge code
COPY bridge/ /app/bridge/

# Create robot/__init__.py if missing so Python treats it as a package
RUN [ -f /app/robot/__init__.py ] || touch /app/robot/__init__.py

# Install Python dependencies
RUN pip install --no-cache-dir -r /app/bridge/requirements.txt

# Set PYTHONPATH so "from bridge.xxx" and "from robot.xxx" imports work correctly
ENV PYTHONPATH=/app

# Expose the bridge relay port and the optional web UI port
EXPOSE 8765 8766

# Health check — verifies the web UI is responding when --ui is enabled.
# If --ui is not used, this check will fail gracefully (bridge still runs).
# For production deployments without UI, replace with a TCP check on port 8765.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8766/api/status')" || exit 1

# Default entry point — pass CLI args via CMD or docker-compose command:
ENTRYPOINT ["python", "-m", "bridge.bridge_main"]
CMD []
