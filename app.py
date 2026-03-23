#!/usr/bin/env python3
"""road-control — Fleet control plane"""
import json, sys, os
from http.server import HTTPServer, BaseHTTPRequestHandler

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/health":
            self.respond(200, {"status": "ok", "service": "road-control"})
        elif self.path == "/":
            self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers()
            self.wfile.write(b'<html><body style="background:#0a0a0a;color:#f5f5f5;font-family:monospace;padding:40px;max-width:600px;margin:0 auto"><h1>road-control</h1><p style="color:#737373">Fleet control plane</p><pre>GET /api/health</pre><p style="color:#333;margin-top:24px">Part of <a href="https://blackroad.io" style="color:#525252">BlackRoad OS</a></p></body></html>')
        else: self.respond(404, {"error": "Not found"})
    def respond(self, code, data):
        self.send_response(code); self.send_header("Content-Type","application/json"); self.send_header("Access-Control-Allow-Origin","*"); self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"road-control running on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
