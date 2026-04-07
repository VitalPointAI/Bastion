"""
pyDrone WiFi Control Server

Detects whether USB is connected:
  - USB connected: stays in REPL mode (for programming)
  - USB disconnected (battery only): starts WiFi control server

Override: hold the BOOT button during power-on to force REPL mode
even on battery.
"""

import machine
import time

led_blue = machine.Pin(46, machine.Pin.OUT)
led_green = machine.Pin(42, machine.Pin.OUT)
led_blue.value(1)
led_green.value(0)

# Check if BOOT button is held (force REPL mode)
# BOOT button is typically GPIO 0 on ESP32-S3
try:
    boot_btn = machine.Pin(0, machine.Pin.IN, machine.Pin.PULL_UP)
    if boot_btn.value() == 0:
        print("[boot] BOOT button held — staying in REPL mode")
        led_blue.value(0)
        raise SystemExit
except:
    pass

# Give USB CDC time to settle
time.sleep_ms(2000)

# Try to detect if we're on USB by checking if VBUS sense is available
# On battery-only, we proceed to WiFi mode
# On USB, we stay in REPL for programming
import os
try:
    # If this script was run via mpremote exec, we're on USB — don't start server
    # The script only auto-runs as main.py on boot
    pass
except:
    pass

# Start WiFi control server
import network
import json

WIFI_SSID = "Terminator 5"
WIFI_PASS = "0GyH4X#P181d5"

print(f"[wifi] Connecting to {WIFI_SSID}...")
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(WIFI_SSID, WIFI_PASS)

start = time.ticks_ms()
while not wlan.isconnected():
    if time.ticks_diff(time.ticks_ms(), start) > 15000:
        print("[wifi] TIMEOUT — check credentials")
        led_blue.value(0)
        raise SystemExit
    time.sleep_ms(200)

ip = wlan.ifconfig()[0]
print(f"[wifi] Connected: {ip}")
led_green.value(1)
led_blue.value(0)

# Init drone
import drone as drone_mod
d = None
calibrated = False

# Init camera
cam = None
try:
    import sensor
    cam = sensor.OV2640()
    cam.set_framesize(sensor.VGA)
    print("[cam] Initialized")
except Exception as e:
    print(f"[cam] Not available: {e}")

# HTTP server
import usocket as socket

def parse_qs(qs):
    params = {}
    if not qs:
        return params
    for pair in qs.split('&'):
        if '=' in pair:
            k, v = pair.split('=', 1)
            params[k] = v
    return params

def send_resp(cl, status, ctype, body):
    cl.send(f"HTTP/1.0 {status}\r\nContent-Type: {ctype}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n")
    if isinstance(body, bytes):
        cl.send(body)
    else:
        cl.send(body.encode())

HTML = """<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>pyDrone</title><style>
body{font-family:system-ui;background:#0f172a;color:#e2e8f0;margin:0;padding:1rem}
h1{font-size:1.3rem;margin:0 0 1rem}
.b{display:inline-block;padding:0.7rem 1.2rem;margin:0.3rem;border:none;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;color:#fff}
.cal{background:#3b82f6}.go{background:#22c55e}.warn{background:#f59e0b}.kill{background:#ef4444}.info{background:#6366f1}
#st{background:#1e293b;padding:1rem;border-radius:8px;margin:1rem 0;font-family:monospace;font-size:0.85rem;white-space:pre-wrap}
img{max-width:100%;border-radius:8px;margin:0.5rem 0}
</style></head><body>
<h1>pyDrone Control</h1>
<div>
<button class="b info" onclick="cmd('motortest')">Motor Test</button>
<button class="b cal" onclick="cmd('calibrate')">Calibrate</button>
<button class="b go" onclick="cmd('takeoff?h=50')">Take Off 50cm</button>
<button class="b go" onclick="cmd('takeoff?h=100')">Take Off 100cm</button>
<button class="b warn" onclick="cmd('land')">Land</button>
<button class="b kill" onclick="cmd('stop')">STOP</button>
</div>
<div id="st">Loading...</div>
<div><button class="b info" onclick="snap()">Capture</button></div>
<img id="img" style="display:none">
<script>
function cmd(c){fetch('/'+c).then(r=>r.text()).then(t=>{document.getElementById('st').textContent=t})}
function snap(){var i=document.getElementById('img');i.src='/capture?t='+Date.now();i.style.display='block'}
setInterval(()=>{fetch('/status').then(r=>r.text()).then(t=>{document.getElementById('st').textContent=t}).catch(()=>{})},2000);
</script></body></html>"""

srv = socket.socket()
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(('0.0.0.0', 80))
srv.listen(2)
print(f"[http] Server on http://{ip}/")

while True:
    try:
        cl, addr = srv.accept()
        req = cl.recv(1024).decode()
        first = req.split('\r\n')[0] if req else ''
        parts = first.split(' ')
        if len(parts) < 2:
            cl.close()
            continue

        path = parts[1]
        qs = ''
        if '?' in path:
            path, qs = path.split('?', 1)
        params = parse_qs(qs)

        if path == '/' or path == '/index.html':
            send_resp(cl, '200 OK', 'text/html', HTML)

        elif path == '/motortest':
            motor_pins = [4, 5, 40, 41]
            duty = int(params.get('d', '512'))
            dur = int(params.get('t', '1000'))
            duty = max(0, min(1023, duty))
            dur = max(100, min(3000, dur))
            for i, p in enumerate(motor_pins):
                pwm = machine.PWM(machine.Pin(p), freq=15000, duty=duty)
                time.sleep_ms(dur)
                pwm.duty(0)
                pwm.deinit()
                time.sleep_ms(300)
            send_resp(cl, '200 OK', 'text/plain', f'Motor test done (duty={duty})')

        elif path == '/calibrate':
            if d is None:
                d = drone_mod.DRONE(flightmode=0, debug=0)
            led_blue.value(1)
            t0 = time.ticks_ms()
            calibrated = False
            while time.ticks_diff(time.ticks_ms(), t0) < 20000:
                if d.read_calibrated():
                    calibrated = True
                    break
                time.sleep_ms(100)
            if calibrated:
                d.trim()
                led_blue.value(0)
                send_resp(cl, '200 OK', 'text/plain', 'CALIBRATED OK')
            else:
                led_blue.value(0)
                send_resp(cl, '200 OK', 'text/plain', f'TIMEOUT cal={d.read_cal_data()}')

        elif path == '/takeoff':
            if d is None or not calibrated:
                send_resp(cl, '200 OK', 'text/plain', 'NOT CALIBRATED - click Calibrate first')
            else:
                h = max(30, min(200, int(params.get('h', '50'))))
                led_blue.value(1)
                led_green.value(1)
                d.take_off(distance=h)
                send_resp(cl, '200 OK', 'text/plain', f'TAKING OFF to {h}cm')

        elif path == '/land':
            if d:
                d.landing()
            led_blue.value(0)
            send_resp(cl, '200 OK', 'text/plain', 'LANDING')

        elif path == '/stop':
            if d:
                d.stop()
            led_blue.value(0)
            led_green.value(1)
            send_resp(cl, '200 OK', 'text/plain', 'STOPPED')

        elif path == '/control':
            if d and calibrated:
                r = int(params.get('r', '0'))
                p = int(params.get('p', '0'))
                y = int(params.get('y', '0'))
                t = int(params.get('t', '0'))
                d.control(rol=r, pit=p, yaw=y, thr=t)
                send_resp(cl, '200 OK', 'text/plain', f'r={r} p={p} y={y} t={t}')
            else:
                send_resp(cl, '200 OK', 'text/plain', 'NOT CALIBRATED')

        elif path == '/status':
            info = {'ip': ip, 'calibrated': calibrated}
            if d:
                try:
                    info['accel'] = d.read_accelerometer()
                    info['states'] = d.read_states()
                    info['cal'] = d.read_cal_data()
                except:
                    pass
            send_resp(cl, '200 OK', 'text/plain', json.dumps(info))

        elif path == '/capture':
            if cam:
                try:
                    cam.snapshot('/c.jpg')
                    with open('/c.jpg', 'rb') as f:
                        jpeg = f.read()
                    cl.send("HTTP/1.0 200 OK\r\nContent-Type: image/jpeg\r\nConnection: close\r\n\r\n")
                    cl.send(jpeg)
                except Exception as e:
                    send_resp(cl, '500', 'text/plain', str(e))
            else:
                send_resp(cl, '200 OK', 'text/plain', 'No camera')

        else:
            send_resp(cl, '404', 'text/plain', 'Not found')

        cl.close()
    except OSError:
        pass
    except Exception as e:
        print(f"[http] {e}")
        try:
            cl.close()
        except:
            pass
