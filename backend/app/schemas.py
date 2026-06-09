from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=4, max_length=120)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool
    favorites: list[str]
    permissions: list[str]


class FavoritesUpdateRequest(BaseModel):
    favorites: list[str]


class RosterPlayerIn(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    number: int = Field(ge=1, le=99)
    positions: list[str] = Field(default_factory=list)
    primaryPosition: str


class RosterPlayerOut(BaseModel):
    id: str
    name: str
    number: int
    positions: list[str]
    primaryPosition: str


class RosterSaveRequest(BaseModel):
    players: list[RosterPlayerIn]


class RosterResponse(BaseModel):
    players: list[RosterPlayerOut]


class PlayIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    date: str
    frames: list[Any]


class PlayOut(BaseModel):
    name: str
    date: str
    frames: list[Any]
    updatedAt: datetime


class PermissionUpdateRequest(BaseModel):
    permission: str
    granted: bool
