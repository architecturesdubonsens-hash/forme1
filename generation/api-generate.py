"""
api-generate.py
FastAPI backend — endpoints HTTP pour le pipeline de génération bâtiment.
"""

import asyncio
import json
import os
import subprocess
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="CapInSitu — Génération Bâtiment",
    description="Pipeline de génération automatique de bâtiment à partir d'un cahier des charges",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

JOBS: dict = {}
GENERATOR_JS = Path(__file__).parent / "generator.js"
OUTPUT_DIR = Path(os.environ.get("GENERATION_OUTPUT_DIR", "/tmp/generation-output"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class Location(BaseModel):
    lat: float = Field(default=48.8566, description="Latitude WGS84")
    lng: float = Field(default=2.3522, description="Longitude WGS84")
    altitude: float = Field(default=0.0)
    trueNorth: float = Field(default=0.0, description="Angle nord vrai en degrés")
    groundElevation: float = Field(default=0.0)


class PLUConstraints(BaseModel):
    zone: Optional[str] = None
    emprise_max_m2: Optional[float] = None
    surface_plancher_max_m2: Optional[float] = None
    hauteur_max_m: Optional[float] = None
    niveaux_max: Optional[int] = None


class RenduParams(BaseModel):
    architectureLock: Optional[int] = Field(None, ge=0, le=100)
    materialLock: Optional[int] = Field(None, ge=0, le=100)
    creativity: Optional[int] = Field(None, ge=0, le=100)
    style: str = "photorealistic"


class GenerateRequest(BaseModel):
    texte_cdc: str = Field(..., min_length=20, description="Cahier des charges en texte libre")
    project_name: str = Field(default="projet", description="Nom du projet")
    location: Location = Field(default_factory=Location)
    emprise: dict = Field(default={"largeur": 20, "profondeur": 15})
    plu: Optional[PLUConstraints] = None
    rendu: Optional[RenduParams] = None
    generate_ifc: bool = Field(default=True)
    generate_glb: bool = Field(default=False)


class GenerateResponse(BaseModel):
    job_id: str
    status: str
    created_at: str
    message: str


async def run_generation_job(job_id: str, request: GenerateRequest):
    JOBS[job_id]["status"] = "running"
    JOBS[job_id]["started_at"] = datetime.utcnow().isoformat()

    input_data = {
        "texte_cdc": request.texte_cdc,
        "projectName": request.project_name,
        "location": request.location.dict(),
        "emprise": request.emprise,
        "generateIfc": request.generate_ifc,
        "generateGlb": request.generate_glb
    }
    if request.plu:
        input_data["plu"] = request.plu.dict(exclude_none=True)
    if request.rendu:
        input_data["rendu"] = request.rendu.dict(exclude_none=True)

    input_path = OUTPUT_DIR / job_id / "input.json"
    input_path.parent.mkdir(parents=True, exist_ok=True)
    input_path.write_text(json.dumps(input_data, ensure_ascii=False, indent=2))

    runner_script = f"""
import {{ generateBuilding }} from '{GENERATOR_JS}';
import {{ readFileSync }} from 'fs';
const input = JSON.parse(readFileSync('{input_path}', 'utf8'));
const result = await generateBuilding(input);
console.log(JSON.stringify(result));
"""
    runner_path = OUTPUT_DIR / job_id / "_runner.mjs"
    runner_path.write_text(runner_script)

    try:
        proc = await asyncio.create_subprocess_exec(
            "node", str(runner_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={**os.environ, "GENERATION_OUTPUT_DIR": str(OUTPUT_DIR)}
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)

        if proc.returncode != 0:
            raise RuntimeError(stderr.decode("utf-8", errors="replace")[-1000:])

        result = json.loads(stdout.decode("utf-8"))
        JOBS[job_id]["status"] = "done"
        JOBS[job_id]["result"] = result
        JOBS[job_id]["completed_at"] = datetime.utcnow().isoformat()

    except asyncio.TimeoutError:
        JOBS[job_id]["status"] = "error"
        JOBS[job_id]["error"] = "Timeout — génération > 5 minutes"
    except Exception as e:
        JOBS[job_id]["status"] = "error"
        JOBS[job_id]["error"] = str(e)


@app.post("/generate", response_model=GenerateResponse, status_code=202)
async def create_generation(request: GenerateRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "created_at": datetime.utcnow().isoformat(),
        "request_summary": {
            "project_name": request.project_name,
            "cdc_length": len(request.texte_cdc)
        }
    }
    background_tasks.add_task(run_generation_job, job_id, request)
    return GenerateResponse(
        job_id=job_id,
        status="queued",
        created_at=JOBS[job_id]["created_at"],
        message=f"Génération démarrée — interrogez GET /generate/{job_id}"
    )


@app.get("/generate/{job_id}")
async def get_generation_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job introuvable")
    job = JOBS[job_id].copy()
    if "result" in job:
        r = job["result"]
        job["summary"] = {
            "score_layout": r.get("score_layout"),
            "violations": len(r.get("violations", [])),
            "metres": r.get("metres"),
            "fichiers": list(r.get("fichiers", {}).keys()),
            "questions_clarification": r.get("questions_clarification", [])
        }
    return JSONResponse(content=job)


@app.get("/generate/{job_id}/svg")
async def get_layout_svg(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job introuvable")
    job = JOBS[job_id]
    if job.get("status") != "done":
        raise HTTPException(status_code=409, detail=f"Job status: {job.get('status')}")

    svg_path = job.get("result", {}).get("fichiers", {}).get("svg")
    if not svg_path or not Path(svg_path).exists():
        raise HTTPException(status_code=404, detail="SVG non disponible")

    return FileResponse(svg_path, media_type="image/svg+xml")


@app.get("/generate/{job_id}/files/{filename}")
async def get_generated_file(job_id: str, filename: str):
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job introuvable")

    safe_name = Path(filename).name
    if safe_name != filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Nom de fichier invalide")

    job_dir = OUTPUT_DIR / job_id
    file_path = job_dir / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    if not str(file_path.resolve()).startswith(str(OUTPUT_DIR.resolve())):
        raise HTTPException(status_code=403, detail="Accès refusé")

    media_types = {
        ".json": "application/json",
        ".ifc": "application/octet-stream",
        ".glb": "model/gltf-binary",
        ".svg": "image/svg+xml",
        ".md": "text/markdown"
    }
    suffix = file_path.suffix.lower()
    media_type = media_types.get(suffix, "application/octet-stream")
    return FileResponse(str(file_path), media_type=media_type, filename=safe_name)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "jobs_total": len(JOBS),
        "jobs_done": sum(1 for j in JOBS.values() if j.get("status") == "done"),
        "jobs_running": sum(1 for j in JOBS.values() if j.get("status") == "running"),
        "jobs_error": sum(1 for j in JOBS.values() if j.get("status") == "error")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
