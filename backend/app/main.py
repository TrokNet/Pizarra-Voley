from datetime import datetime
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import models, schemas
from .auth import create_access_token, hash_password, verify_password
from .config import settings
from .database import Base, engine, get_db
from .deps import get_current_user, require_permission


Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get(f"{settings.api_prefix}/health")
def health_api() -> dict:
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post(f"{settings.api_prefix}/auth/register", response_model=schemas.TokenResponse)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    user = models.User(
        username=username,
        password_hash=hash_password(payload.password),
        favorites=[],
        settings={},
    )
    db.add(user)
    db.flush()

    default_permissions = [
        models.UserPermission(user_id=user.id, permission="plays:write", granted=True),
        models.UserPermission(user_id=user.id, permission="roster:write", granted=True),
    ]
    db.add_all(default_permissions)
    db.commit()

    token = create_access_token(username)
    return schemas.TokenResponse(access_token=token, username=username)


@app.post(f"{settings.api_prefix}/auth/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")

    token = create_access_token(user.username)
    return schemas.TokenResponse(access_token=token, username=user.username)


@app.get(f"{settings.api_prefix}/auth/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    permissions = [p.permission for p in current_user.permissions if p.granted]
    return schemas.UserOut(
        id=current_user.id,
        username=current_user.username,
        is_admin=current_user.is_admin,
        favorites=current_user.favorites or [],
        permissions=permissions,
    )


@app.put(f"{settings.api_prefix}/users/me/favorites", response_model=schemas.UserOut)
def update_favorites(
    payload: schemas.FavoritesUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.favorites = payload.favorites
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    permissions = [p.permission for p in current_user.permissions if p.granted]
    return schemas.UserOut(
        id=current_user.id,
        username=current_user.username,
        is_admin=current_user.is_admin,
        favorites=current_user.favorites or [],
        permissions=permissions,
    )


@app.get(f"{settings.api_prefix}/roster", response_model=schemas.RosterResponse)
def get_roster(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    players = (
        db.query(models.RosterPlayer)
        .filter(models.RosterPlayer.user_id == current_user.id)
        .order_by(models.RosterPlayer.updated_at.desc())
        .all()
    )

    return schemas.RosterResponse(
        players=[
            schemas.RosterPlayerOut(
                id=f"srv_{p.id}",
                name=p.name,
                number=p.number,
                positions=p.positions or [],
                primaryPosition=p.primary_position,
            )
            for p in players
        ]
    )


@app.put(f"{settings.api_prefix}/roster", response_model=schemas.RosterResponse)
def save_roster(
    payload: schemas.RosterSaveRequest,
    current_user: models.User = Depends(require_permission("roster:write")),
    db: Session = Depends(get_db),
):
    db.query(models.RosterPlayer).filter(models.RosterPlayer.user_id == current_user.id).delete()

    new_rows = []
    for item in payload.players:
        new_rows.append(
            models.RosterPlayer(
                user_id=current_user.id,
                name=item.name,
                number=item.number,
                positions=item.positions,
                primary_position=item.primaryPosition,
            )
        )

    db.add_all(new_rows)
    db.commit()

    return schemas.RosterResponse(
        players=[
            schemas.RosterPlayerOut(
                id=f"srv_{row.id}",
                name=row.name,
                number=row.number,
                positions=row.positions or [],
                primaryPosition=row.primary_position,
            )
            for row in new_rows
        ]
    )


@app.get(f"{settings.api_prefix}/plays", response_model=list[schemas.PlayOut])
def list_plays(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    plays = (
        db.query(models.Play)
        .filter(models.Play.user_id == current_user.id)
        .order_by(models.Play.updated_at.desc())
        .all()
    )
    return [
        schemas.PlayOut(name=p.name, date=p.date_label, frames=p.frames or [], updatedAt=p.updated_at)
        for p in plays
    ]


@app.post(f"{settings.api_prefix}/plays", response_model=schemas.PlayOut)
def save_play(
    payload: schemas.PlayIn,
    current_user: models.User = Depends(require_permission("plays:write")),
    db: Session = Depends(get_db),
):
    play = (
        db.query(models.Play)
        .filter(models.Play.user_id == current_user.id, models.Play.name == payload.name)
        .first()
    )

    if play:
        play.frames = payload.frames
        play.date_label = payload.date
        play.updated_at = datetime.utcnow()
    else:
        play = models.Play(
            user_id=current_user.id,
            name=payload.name,
            date_label=payload.date,
            frames=payload.frames,
        )
        db.add(play)

    db.commit()
    db.refresh(play)

    return schemas.PlayOut(
        name=play.name,
        date=play.date_label,
        frames=play.frames or [],
        updatedAt=play.updated_at,
    )


@app.delete(f"{settings.api_prefix}/plays/{{play_name}}")
def delete_play(
    play_name: str,
    current_user: models.User = Depends(require_permission("plays:write")),
    db: Session = Depends(get_db),
):
    play = (
        db.query(models.Play)
        .filter(models.Play.user_id == current_user.id, models.Play.name == play_name)
        .first()
    )

    if not play:
        raise HTTPException(status_code=404, detail="Jugada no encontrada")

    db.delete(play)
    db.commit()
    return {"status": "deleted"}


@app.put(f"{settings.api_prefix}/admin/users/{{username}}/permissions")
def update_permission(
    username: str,
    payload: schemas.PermissionUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Solo administradores")

    user = db.query(models.User).filter(models.User.username == username.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no existe")

    row = (
        db.query(models.UserPermission)
        .filter(
            models.UserPermission.user_id == user.id,
            models.UserPermission.permission == payload.permission,
        )
        .first()
    )
    if not row:
        row = models.UserPermission(
            user_id=user.id,
            permission=payload.permission,
            granted=payload.granted,
        )
        db.add(row)
    else:
        row.granted = payload.granted

    db.commit()
    return {"status": "ok", "user": user.username, "permission": payload.permission, "granted": payload.granted}


frontend_dir = Path(__file__).resolve().parents[2]
if (frontend_dir / "index.html").exists():
    # Single-app mode: UI and API are served by the same backend process.
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
