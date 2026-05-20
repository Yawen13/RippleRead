import bcrypt
import jwt
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app_config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_DAYS
from db import get_db_connection
from schemas import RegisterRequest, LoginRequest, ChangePasswordRequest, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_user_id(request: Request) -> int:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = auth[7:]
    payload = decode_token(token)
    return int(payload["sub"])


def row_to_user(row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "name": row["name"] or row["username"],
        "avatar_url": row["avatar_url"] if "avatar_url" in row.keys() else None,
        "created_at": row["created_at"] if "created_at" in row.keys() else None,
    }


@router.post("/register")
async def register(body: RegisterRequest):
    conn = get_db_connection()
    try:
        email = body.email.strip().lower()
        username = body.username.strip()

        existing = conn.execute(
            "SELECT id FROM users WHERE email = ? OR username = ?", (email, username)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Email or username already taken")

        password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt(rounds=12)).decode()

        cursor = conn.execute(
            """INSERT INTO users (username, email, password_hash, name, avatar_url, created_at, last_login_at)
               VALUES (?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (username, email, password_hash, username),
        )
        conn.commit()
        user_id = cursor.lastrowid

        conn.execute(
            """INSERT OR IGNORE INTO user_preferences (id, user_id, font_size, line_height, target_lexile, native_language, user_name, theme)
               VALUES (?, ?, 18, 1.6, 800, 'Chinese', ?, 'light')""",
            (user_id, user_id, username),
        )
        conn.commit()

        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()

        token = create_token(user_id)
        return {"token": token, "user": row_to_user(user)}
    except HTTPException:
        conn.close()
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def login(body: LoginRequest):
    conn = get_db_connection()
    try:
        email = body.email.strip().lower()

        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        conn.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", (user["id"],))
        conn.commit()

        token = create_token(user["id"])

        user_data = row_to_user(user)
        conn.close()
        return {"token": token, "user": user_data}
    except HTTPException:
        conn.close()
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_me(request: Request):
    user_id = get_user_id(request)
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"user": row_to_user(user)}
    except HTTPException:
        conn.close()
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


class UpdateMeRequest(BaseModel):
    name: str | None = None
    avatar_url: str | None = None


@router.put("/me")
async def update_me(request: Request, body: UpdateMeRequest):
    user_id = get_user_id(request)
    conn = get_db_connection()
    try:
        if body.name is not None:
            name = body.name.strip()
            if not name:
                raise HTTPException(status_code=400, detail="Name cannot be empty")
            conn.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
        if body.avatar_url is not None:
            conn.execute("UPDATE users SET avatar_url = ? WHERE id = ?", (body.avatar_url, user_id))
        conn.commit()

        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return {"user": row_to_user(user)}
    except HTTPException:
        conn.close()
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/change-password")
async def change_password(request: Request, body: ChangePasswordRequest):
    user_id = get_user_id(request)
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")

        if not bcrypt.checkpw(body.old_password.encode(), user["password_hash"].encode()):
            conn.close()
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt(rounds=12)).decode()
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
        conn.commit()
        conn.close()
        return {"message": "Password changed successfully"}
    except HTTPException:
        conn.close()
        raise
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=str(e))
