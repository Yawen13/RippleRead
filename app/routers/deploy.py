"""
GitHub webhook endpoint for auto-deploy.
Receives push events from GitHub, validates signature, triggers redeploy.
"""
import hashlib
import hmac
import os
import subprocess
import sys

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api", tags=["deploy"])

DEPLOY_SECRET = os.getenv("DEPLOY_SECRET", "")


def verify_signature(payload_body: bytes, signature_header: str) -> bool:
    if not DEPLOY_SECRET or not signature_header:
        return False
    sha_name, signature = signature_header.split("=", 1)
    if sha_name != "sha256":
        return False
    mac = hmac.new(DEPLOY_SECRET.encode(), msg=payload_body, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature)


@router.post("/deploy")
async def deploy_webhook(request: Request):
    if not DEPLOY_SECRET:
        return JSONResponse(status_code=503, content={"detail": "Deploy not configured"})

    signature = request.headers.get("X-Hub-Signature-256", "")
    body = await request.body()

    if not verify_signature(body, signature):
        return JSONResponse(status_code=403, content={"detail": "Invalid signature"})

    try:
        result = subprocess.run(
            ["git", "-C", "/app", "pull", "origin", "main"],
            capture_output=True, text=True, timeout=30
        )
        git_output = result.stdout.strip()

        if result.returncode != 0:
            return JSONResponse(
                status_code=500,
                content={"detail": "git pull failed", "output": result.stderr.strip()},
            )

        restart_result = subprocess.run(
            ["docker", "compose", "-f", "/app/docker-compose.yml", "up", "-d", "--build"],
            capture_output=True, text=True, timeout=120
        )

        return {
            "detail": "Deployed successfully",
            "git": git_output,
        }
    except subprocess.TimeoutExpired:
        return JSONResponse(status_code=500, content={"detail": "Deploy timeout"})
    except FileNotFoundError:
        return JSONResponse(status_code=500, content={"detail": "git or docker not found in container"})
