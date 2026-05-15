import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import wearable, program, feedback, challenges, snacks

logger = logging.getLogger("forme1")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validation au démarrage : si les vars d'env sont absentes,
    # pydantic-settings a déjà planté avec un message clair avant d'arriver ici.
    logger.info("Forme 1 backend démarré. Origins autorisées : %s", settings.allowed_origins)
    yield


app = FastAPI(
    title="Forme 1 API",
    description="Backend du coach sportif personnalisé Forme 1",
    version="0.2.0",
    lifespan=lifespan,
)

# Origines autorisées — on inclut toujours * en dev, et les domaines prod en ALLOWED_ORIGINS
_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # previews Vercel
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# CORS headers présents même sur les erreurs non gérées
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Erreur non gérée : %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"},
    )


app.include_router(wearable.router)
app.include_router(program.router)
app.include_router(feedback.router)
app.include_router(challenges.router)
app.include_router(snacks.router)


@app.get("/health")
def health():
    return {"status": "ok", "version": app.version}
