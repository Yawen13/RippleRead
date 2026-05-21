"""
RippleRead Auto-Deploy Webhook Server
Listens for GitHub push webhooks and triggers redeploy.

Run on the HOST (not in Docker):
  python webhook_server.py

Then add a Cloudflare Tunnel DNS route:
  deploy.rippleread.me -> localhost:9000
"""

import hashlib
import hmac
import http.server
import json
import os
import subprocess
import sys
from pathlib import Path

HOST = "127.0.0.1"
PORT = 9000
DEPLOY_SECRET = os.getenv("DEPLOY_SECRET", "")
PROJECT_DIR = Path(__file__).resolve().parent.parent
PS_PATH = PROJECT_DIR / "deploy.ps1"


def verify_signature(body: bytes, signature_header: str) -> bool:
    if not DEPLOY_SECRET or not signature_header:
        return False
    try:
        sha_name, signature = signature_header.split("=", 1)
    except ValueError:
        return False
    if sha_name != "sha256":
        return False
    mac = hmac.new(DEPLOY_SECRET.encode(), msg=body, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature)


class DeployHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/deploy":
            self.send_response(404)
            self.end_headers()
            return

        body_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(body_length)
        signature = self.headers.get("X-Hub-Signature-256", "")

        if not verify_signature(body, signature):
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'{"detail":"Invalid signature"}')
            return

        print(f"[Webhook] Deploy triggered from GitHub")

        try:
            result = subprocess.run(
                ["powershell.exe", "-ExecutionPolicy", "Bypass", "-File", str(PS_PATH)],
                cwd=str(PROJECT_DIR),
                capture_output=True,
                text=True,
                timeout=180,
            )
            output = result.stdout.strip() + "\n" + result.stderr.strip()
            print(output)

            if result.returncode == 0:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps({
                    "detail": "Deployed successfully",
                    "output": output[-500:],
                }).encode())
            else:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({
                    "detail": "Deploy failed",
                    "output": output[-500:],
                }).encode())
        except subprocess.TimeoutExpired:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'{"detail":"Deploy timeout"}')

    def log_message(self, fmt, *args):
        print(f"[Webhook] {fmt % args}")


def main():
    if not DEPLOY_SECRET:
        print("[Webhook] WARNING: DEPLOY_SECRET not set. "
              "Add it to your .env file and run: $env:DEPLOY_SECRET='your-secret'; python webhook_server.py")
        print("[Webhook] Continue without signature verification? (y/N): ", end="")
        if input().strip().lower() != "y":
            sys.exit(1)

    server = http.server.HTTPServer((HOST, PORT), DeployHandler)
    print(f"[Webhook] Listening on http://{HOST}:{PORT}/api/deploy")
    print(f"[Webhook] Tunnel DNS: deploy.rippleread.me -> localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Webhook] Shutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
