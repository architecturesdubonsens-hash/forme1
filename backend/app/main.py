from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import wearable, program, feedback, challenges, snacks

app = FastAPI(
    title="Forme 1 API",
    description="Backend du coach sportif personnalisé Forme 1",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CORS headers présents même sur les erreurs non gérées
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
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
    return {"status": "ok"}
