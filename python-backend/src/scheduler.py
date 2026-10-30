import time
import threading
import datetime
import http.server
import socketserver
import json
import urllib.parse
from typing import Dict, Any
from storage import load_endpoints, load_keywords, append_tenders_to_history
from api_client import fetch_latest_items
from matcher import evaluate_items
from zoneinfo import ZoneInfo

class BackgroundScheduler:
    def __init__(self):
        self._is_running = False
        self._interval_minutes = 5
        self._last_run: float = 0.0
        self._next_run: float = 0.0
        self._last_run_str: str = "Brak"
        self._lock = threading.Lock()
        self._thread: threading.Thread = None

    def start(self, interval_minutes: int):
        with self._lock:
            self._interval_minutes = max(1, interval_minutes)
            self._is_running = True
            now = time.time()
            self._next_run = now + (self._interval_minutes * 60)
            
            if self._thread is None or not self._thread.is_alive():
                self._thread = threading.Thread(target=self._worker_loop, daemon=True)
                self._thread.start()

    def stop(self):
        with self._lock:
            self._is_running = False
            self._next_run = 0.0

    def trigger_now(self):
        """Wymusza natychmiastowe uruchomienie cyklu."""
        threading.Thread(target=self._run_cycle, daemon=True).start()

    def _worker_loop(self):
        while True:
            time.sleep(1)
            with self._lock:
                if not self._is_running:
                    continue
                now = time.time()
                if now >= self._next_run:
                    self._last_run = now
                    self._last_run_str = datetime.datetime.now(ZoneInfo("Europe/Warsaw")).strftime("%Y-%m-%d %H:%M:%S")
                    self._next_run = now + (self._interval_minutes * 60)
                    # Uruchomienie cyklu w osobnym wątku, by nie blokować pętli timera
                    threading.Thread(target=self._run_cycle, daemon=True).start()

    def _run_cycle(self):
        endpoints = load_endpoints()
        keywords = load_keywords()
        if not endpoints:
            return

        for ep in endpoints:
            try:
                success, items, _ = fetch_latest_items(ep["url"], limit=20)
                if success and items:
                    evaluated = evaluate_items(items, keywords)
                    append_tenders_to_history(ep["name"], evaluated)
            except Exception:
                pass

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            now = time.time()
            remaining = max(0, int(self._next_run - now)) if self._is_running else 0
            mins, secs = divmod(remaining, 60)
            return {
                "is_running": self._is_running,
                "interval_minutes": self._interval_minutes,
                "remaining_seconds": remaining,
                "countdown_formatted": f"{mins:02d}:{secs:02d}",
                "last_run": self._last_run_str
            }

# Globalna instancja (singleton w procesie Pythona)
scheduler_instance = BackgroundScheduler()

import urllib.parse

class TriggerHandler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/scheduler/status":
            status_data = scheduler_instance.get_status()
            self._send_json(200, status_data)
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/trigger":
            scheduler_instance.trigger_now()
            self._send_json(200, {"status": "triggered", "message": "Pojedynczy skan uruchomiony"})

        elif path == "/scheduler/start":
            params = urllib.parse.parse_qs(parsed.query)
            interval = int(params.get("interval", [5])[0])
            scheduler_instance.start(interval)
            self._send_json(200, {
                "status": "started", 
                "interval_minutes": interval, 
                "message": f"Harmonogram uruchomiony (co {interval} min)"
            })

        elif path == "/scheduler/stop":
            scheduler_instance.stop()
            self._send_json(200, {"status": "stopped", "message": "Harmonogram zatrzymany"})

        else:
            self._send_json(404, {"error": "Not Found"})

    def log_message(self, format, *args):
        pass  # wyciszenie logów HTTP w konsoli

def start_webhook_server(port=8502):
    class ReusableTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    def run_server():
        try:
            with ReusableTCPServer(("0.0.0.0", port), TriggerHandler) as httpd:
                httpd.serve_forever()
        except Exception as ex:
            print(f"[Webhook] Błąd serwera HTTP: {ex}")

    t = threading.Thread(target=run_server, daemon=True)
    t.start()

# Uruchomienie webhooka w tle
start_webhook_server(port=8502)