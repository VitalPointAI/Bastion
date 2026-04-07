#!/bin/bash
# Build custom pyDrone firmware with working camera + drone flight controller.
#
# This script:
#   1. Clones the 01Studio MicroPython fork
#   2. Replaces the old esp32-camera driver with the official Espressif version
#   3. Sets up ESP-IDF 4.4.x toolchain
#   4. Builds the PYDRONE firmware
#
# Prerequisites: git, python3, pip
# Time: ~30-60 minutes (mostly ESP-IDF toolchain download/setup)
#
# Usage: ./build-firmware.sh
# Output: ./output/custom-pydrone-firmware.bin

set -e

WORKDIR="$(cd "$(dirname "$0")" && pwd)/build"
OUTPUT="$(cd "$(dirname "$0")" && pwd)/output"
mkdir -p "$WORKDIR" "$OUTPUT"

echo "============================================"
echo "  pyDrone Custom Firmware Builder"
echo "============================================"
echo "Work directory: $WORKDIR"
echo ""

# Step 1: Clone 01Studio MicroPython fork
if [ ! -d "$WORKDIR/micropython" ]; then
    echo "[1/6] Cloning 01Studio MicroPython fork..."
    git clone https://github.com/01studio-lab/micropython.git "$WORKDIR/micropython"
else
    echo "[1/6] MicroPython repo already cloned"
fi

# Step 2: Replace esp32-camera driver with official Espressif version
echo "[2/6] Updating esp32-camera driver..."
CAMDIR="$WORKDIR/micropython/ports/esp32/esp32-camera"

# Back up original
if [ ! -d "$CAMDIR.orig" ]; then
    cp -r "$CAMDIR" "$CAMDIR.orig"
fi

# Clone official esp32-camera
if [ ! -d "$WORKDIR/esp32-camera-official" ]; then
    git clone https://github.com/espressif/esp32-camera.git "$WORKDIR/esp32-camera-official"
fi

# Replace driver files (keep the 01Studio CMakeLists.txt for build compat)
cp "$CAMDIR/CMakeLists.txt" /tmp/01studio-cam-cmake-backup.txt

# Copy official driver source
rm -rf "$CAMDIR/driver" "$CAMDIR/target" "$CAMDIR/conversions" "$CAMDIR/sensors"
cp -r "$WORKDIR/esp32-camera-official/driver" "$CAMDIR/"
cp -r "$WORKDIR/esp32-camera-official/target" "$CAMDIR/"
cp -r "$WORKDIR/esp32-camera-official/conversions" "$CAMDIR/"
cp -r "$WORKDIR/esp32-camera-official/sensors" "$CAMDIR/"

# Restore original CMakeLists.txt (or use official if compatible)
# Check if original CMake works with new structure
cp /tmp/01studio-cam-cmake-backup.txt "$CAMDIR/CMakeLists.txt"

echo "  Camera driver updated to official Espressif version"

# Step 3: Clone and set up ESP-IDF
if [ ! -d "$WORKDIR/esp-idf" ]; then
    echo "[3/6] Cloning ESP-IDF (this takes a while)..."
    git clone https://github.com/espressif/esp-idf.git "$WORKDIR/esp-idf"
    cd "$WORKDIR/esp-idf"
    # Checkout the commit used by 01Studio (just before v5.0-dev, late IDF 4.4.x)
    git checkout 142bb32c50fa9875b8b69fa539a2d59559460d72

    echo "  Initializing ESP-IDF submodules..."
    git submodule update --init \
        components/bt/host/nimble/nimble \
        components/esp_wifi \
        components/esptool_py/esptool \
        components/lwip/lwip \
        components/mbedtls/mbedtls

    if [ -d components/bt/controller/lib_esp32 ]; then
        git submodule update --init \
            components/bt/controller/lib_esp32 \
            components/bt/controller/lib_esp32c3_family
    else
        git submodule update --init components/bt/controller/lib
    fi
else
    echo "[3/6] ESP-IDF already cloned"
fi

# Step 4: Install ESP-IDF toolchain
echo "[4/6] Installing ESP-IDF toolchain..."
cd "$WORKDIR/esp-idf"
./install.sh esp32s3

# Step 5: Build MicroPython cross-compiler
echo "[5/6] Building mpy-cross..."
source "$WORKDIR/esp-idf/export.sh"

cd "$WORKDIR/micropython"
git submodule update --init lib/berkeley-db-1.xx

make -C mpy-cross

# Step 6: Build PYDRONE firmware
echo "[6/6] Building PYDRONE firmware..."
cd "$WORKDIR/micropython/ports/esp32"
make submodules
make BOARD=PYDRONE

# Copy output
BINDIR="$WORKDIR/micropython/ports/esp32/build-PYDRONE"
if [ -f "$BINDIR/firmware.bin" ]; then
    cp "$BINDIR/firmware.bin" "$OUTPUT/custom-pydrone-firmware.bin"
    echo ""
    echo "============================================"
    echo "  BUILD SUCCESSFUL!"
    echo "  Output: $OUTPUT/custom-pydrone-firmware.bin"
    echo "============================================"
    echo ""
    echo "Flash with:"
    echo "  esptool.py --chip esp32s3 --port /dev/ttyACM0 --baud 460800 \\"
    echo "    erase_flash"
    echo "  esptool.py --chip esp32s3 --port /dev/ttyACM0 --baud 460800 \\"
    echo "    write_flash 0x0 $OUTPUT/custom-pydrone-firmware.bin"
else
    echo "ERROR: firmware.bin not found in $BINDIR"
    echo "Check build output above for errors."
    ls "$BINDIR"/*.bin 2>/dev/null
    exit 1
fi
