from typing import Optional, List

from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @field_validator('username')
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 30:
            raise ValueError('Username must be 3-30 characters')
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username can only contain letters, numbers, _, -')
        return v

    @field_validator('password')
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        has_letter = any(c.isalpha() for c in v)
        has_digit = any(c.isdigit() for c in v)
        if not has_letter or not has_digit:
            raise ValueError('Password must contain both letters and numbers')
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        has_letter = any(c.isalpha() for c in v)
        has_digit = any(c.isdigit() for c in v)
        if not has_letter or not has_digit:
            raise ValueError('Password must contain both letters and numbers')
        return v


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None


class AddVocabularyRequest(BaseModel):
    text: str
    translation: str
    context: str = ""
    item_type: str = "word"
    book_title: str = ""
    chapter_title: str = ""


class SettingsUpdate(BaseModel):
    font_size: Optional[int] = None
    line_height: Optional[float] = None
    target_lexile: Optional[int] = None
    native_language: Optional[str] = None
    user_name: Optional[str] = None
    theme: Optional[str] = None


class TranslationRequest(BaseModel):
    word: str


class WeaverRequest(BaseModel):
    words: List[str]
    target_lexile: int
    word_count: int = 400


class WeaverSaveRequest(BaseModel):
    title: str
    content: str
    lexile_level: int


class CompanionChatRequest(BaseModel):
    book_id: int
    current_chapter_index: int = 0
    target_chapter_index: int = 0
    action: Optional[str] = None
    message: str = ""


class ChapterInsightsRequest(BaseModel):
    book_id: int
    chapter_index: int = 0


class UpdateProgressRequest(BaseModel):
    current_chapter_index: Optional[int] = None
    progress: int = -1
    total_chapters: int = 0
