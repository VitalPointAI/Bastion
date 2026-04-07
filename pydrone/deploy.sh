#!/bin/bash
# Deploy pyDrone BASTION client to the ESP32-S3 via mpremote.
# Usage: ./deploy.sh [port]
#   port defaults to /dev/ttyACM0

PORT="${1:-/dev/ttyACM0}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Deploying pyDrone client to $PORT..."

FILES="boot.py config.py wifi.py led.py cam.py flight.py bastion_client.py main.py"

for f in $FILES; do
    echo "  uploading $f..."
    mpremote connect "$PORT" cp "$DIR/$f" ":/$f"
    if [ $? -ne 0 ]; then
        echo "  ERROR: failed to upload $f"
        exit 1
    fi
done

echo ""
echo "Deploy complete. Files on device:"
mpremote connect "$PORT" exec "import os; print(os.listdir('/'))"
echo ""
echo "To run: mpremote connect $PORT exec \"import main\""
echo "To reset: mpremote connect $PORT reset"
