# VoleyTactics Backend (FastAPI + PostgreSQL)

Backend centralizado para multiusuario real:
- API REST con FastAPI
- PostgreSQL como BD central
- JWT para autenticacion
- Datos aislados por usuario (jugadas, plantilla, favoritos)
- Permisos por usuario

## 1) Levantar con Docker

Desde la raiz del proyecto:

```bash
docker compose up --build
```

Servicios:
- API: http://localhost:8000
- Health: http://localhost:8000/health
- Postgres: localhost:5432

## 2) Configurar frontend

El frontend detecta API automaticamente cuando se sirve por http(s) y usa:

- `${location.origin}/api`

Si quieres forzar otra URL (por ejemplo API remota), abre consola del navegador y ejecuta:

```js
localStorage.setItem('voley_api_base', 'https://tu-dominio.com/api')
location.reload()
```

## 3) Ejecutar backend sin Docker

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 3.1) Modo una sola vista (frontend + backend)

La misma app FastAPI sirve `index.html` y todos los assets (`app.js`, `style.css`, `js/*`) junto con la API.

- Vista: `http://TU_HOST:8000/`
- API: `http://TU_HOST:8000/api/...`
- Health: `http://TU_HOST:8000/health`

Con este modo no necesitas un servidor estatico aparte para la pizarra.

## 4) Backups centralizados

Script incluido:

```bash
chmod +x backend/scripts_backup_postgres.sh
DATABASE_URL='postgresql://trok:123456@localhost:5432/voley' ./backend/scripts_backup_postgres.sh
```

Programa este script con cron/systemd en el servidor para snapshots regulares.
