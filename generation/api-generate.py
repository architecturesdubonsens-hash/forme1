"""
api-generate.py — CapInSitu Générateur Bâtiment
FastAPI backend : pipeline de génération bâtiment + bibliothèque typologique + sessions dialogue.

Rôle dans l'architecture multi-produits :
  Ce service est développé comme module autonome mais conçu pour s'intégrer à CapInSitu.
  Le point d'intégration principal : POST /sessions/{id}/lock produit un schéma fonctionnel validé
  qui deviendra la source d'un projet CapInSitu. Le champ capinsitu_project_id dans generation_sessions
  est réservé à ce lien. Voir generation/INTEGRATION.md pour le contrat complet.

  Supabase projet : fnfrusblyzndbzckkfir (CapInSitu/VIZinSITU) — NE PAS utiliser ojoswtbarspntovtcfsh (Forme1).
"""

import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="CapInSitu — Génération Bâtiment",
    description="Pipeline génération + bibliothèque typologique + sessions dialogue",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

GEN_DIR        = Path(__file__).parent
GENERATOR_JS   = GEN_DIR / "generator.js"
PLAN_ANALYZER  = GEN_DIR / "plan-analyzer.js"
DIALOGUE_ENG   = GEN_DIR / "dialogue-engine.js"
TYPO_LIB       = GEN_DIR / "typo-library.js"
CDC_PARSER     = GEN_DIR / "cdc-parser.js"

OUTPUT_DIR = Path(os.environ.get("GENERATION_OUTPUT_DIR", "/tmp/generation-output"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

JOBS:          Dict[str, Any] = {}
ANALYSIS_JOBS: Dict[str, Any] = {}

MEDIA_TYPES = {
    ".json": "application/json",
    ".ifc":  "application/octet-stream",
    ".glb":  "model/gltf-binary",
    ".svg":  "image/svg+xml",
    ".md":   "text/markdown"
}


# ===================================================================
# HELPERS
# ===================================================================

async def _run_node(runner_code: str, input_data: dict, timeout: int = 120) -> dict:
    run_id  = str(uuid.uuid4())
    run_dir = OUTPUT_DIR / "_runners" / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    input_path  = run_dir / "input.json"
    runner_path = run_dir / "runner.mjs"
    input_path.write_text(json.dumps(input_data, ensure_ascii=False))
    runner_path.write_text(runner_code)
    env = {**os.environ, "GENERATION_OUTPUT_DIR": str(OUTPUT_DIR)}
    try:
        proc = await asyncio.create_subprocess_exec(
            "node", str(runner_path), str(input_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        if proc.returncode != 0:
            raise RuntimeError(stderr.decode("utf-8", errors="replace")[-2000:])
        return json.loads(stdout.decode("utf-8"))
    finally:
        for f in run_dir.iterdir():
            try: f.unlink()
            except: pass
        try: run_dir.rmdir()
        except: pass


def _safe_file(job_dir: Path, filename: str) -> Path:
    safe = Path(filename).name
    if safe != filename or ".." in filename:
        raise HTTPException(400, "Nom de fichier invalide")
    p = job_dir / safe
    if not p.exists() or not p.is_file():
        raise HTTPException(404, "Fichier introuvable")
    if not str(p.resolve()).startswith(str(OUTPUT_DIR.resolve())):
        raise HTTPException(403, "Accès refusé")
    return p


# ===================================================================
# MODÈLES PYDANTIC
# ===================================================================

class Location(BaseModel):
    lat:            float = 48.8566
    lng:            float = 2.3522
    altitude:       float = 0.0
    trueNorth:      float = 0.0
    groundElevation: float = 0.0

class PLUConstraints(BaseModel):
    zone:                    Optional[str]   = None
    emprise_max_m2:          Optional[float] = None
    surface_plancher_max_m2: Optional[float] = None
    hauteur_max_m:           Optional[float] = None
    niveaux_max:             Optional[int]   = None

class RenduParams(BaseModel):
    architectureLock: Optional[int] = Field(None, ge=0, le=100)
    materialLock:     Optional[int] = Field(None, ge=0, le=100)
    creativity:       Optional[int] = Field(None, ge=0, le=100)
    style:            str = "photorealistic"

class GenerateRequest(BaseModel):
    texte_cdc:    str  = Field(..., min_length=20)
    project_name: str  = "projet"
    location:     Location = Field(default_factory=Location)
    emprise:      dict = Field(default={"largeur": 20, "profondeur": 15})
    plu:          Optional[PLUConstraints] = None
    rendu:        Optional[RenduParams]    = None
    generate_ifc: bool = True
    generate_glb: bool = False

class ImageRef(BaseModel):
    data:       Optional[str] = Field(None, description="Base64")
    url:        Optional[str] = Field(None, description="URL publique")
    media_type: str           = "image/jpeg"
    filename:   Optional[str] = None

class AnalyzePlansRequest(BaseModel):
    images:          List[ImageRef] = Field(..., min_length=1, max_length=6)
    typology:        str  = "autre"
    context:         str  = ""
    session_id:      Optional[str]  = None
    save_to_library: bool = False
    template_name:   Optional[str]  = None
    template_tags:   List[str]      = []
    is_public:       bool = True
    user_id:         Optional[str]  = None

class TemplateUpdate(BaseModel):
    nom:          Optional[str]       = None
    description:  Optional[str]       = None
    tags:         Optional[List[str]] = None
    is_public:    Optional[bool]      = None
    is_validated: Optional[bool]      = None

class CreateSessionRequest(BaseModel):
    project_name:  str  = "Nouveau projet"
    cdc_texte:     Optional[str]  = None
    guide_answers: dict = {}
    programme:     dict = {}
    location:      dict = {}
    emprise:       dict = Field(default={"largeur": 20, "profondeur": 15})
    plu:           dict = {}
    template_ids:  List[str] = []
    user_id:       Optional[str] = None

class DialogueCommandRequest(BaseModel):
    command:    str  = Field(..., min_length=3)
    force_edit: bool = False
    user_id:    Optional[str] = None

class GenerateFromSessionRequest(BaseModel):
    generate_ifc: bool = True
    generate_glb: bool = False
    style_refs:   dict = {}
    user_id:      Optional[str] = None


# ===================================================================
# STANDALONE GENERATION
# ===================================================================

async def _run_generation_job(job_id: str, request: GenerateRequest):
    JOBS[job_id]["status"]     = "running"
    JOBS[job_id]["started_at"] = datetime.utcnow().isoformat()

    input_data = {
        "texte_cdc":   request.texte_cdc,
        "projectName": request.project_name,
        "location":    request.location.dict(),
        "emprise":     request.emprise,
        "generateIfc": request.generate_ifc,
        "generateGlb": request.generate_glb
    }
    if request.plu:   input_data["plu"]   = request.plu.dict(exclude_none=True)
    if request.rendu: input_data["rendu"] = request.rendu.dict(exclude_none=True)

    job_dir = OUTPUT_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    input_path  = job_dir / "input.json"
    runner_path = job_dir / "_runner.mjs"
    input_path.write_text(json.dumps(input_data, ensure_ascii=False, indent=2))
    runner_path.write_text(f"""
import {{ generateBuilding }} from '{GENERATOR_JS}';
import {{ readFileSync }} from 'fs';
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await generateBuilding(input);
console.log(JSON.stringify(result));
""")
    env = {**os.environ, "GENERATION_OUTPUT_DIR": str(OUTPUT_DIR)}
    try:
        proc = await asyncio.create_subprocess_exec(
            "node", str(runner_path), str(input_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        if proc.returncode != 0:
            raise RuntimeError(stderr.decode("utf-8", errors="replace")[-1000:])
        result = json.loads(stdout.decode("utf-8"))
        JOBS[job_id].update({"status": "done", "result": result,
                              "completed_at": datetime.utcnow().isoformat()})
    except asyncio.TimeoutError:
        JOBS[job_id].update({"status": "error", "error": "Timeout > 5 min"})
    except Exception as e:
        JOBS[job_id].update({"status": "error", "error": str(e)})


@app.post("/generate", status_code=202)
async def create_generation(request: GenerateRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"job_id": job_id, "status": "queued",
                    "created_at": datetime.utcnow().isoformat(),
                    "request_summary": {"project_name": request.project_name,
                                        "cdc_length": len(request.texte_cdc)}}
    background_tasks.add_task(_run_generation_job, job_id, request)
    return {"job_id": job_id, "status": "queued",
            "message": f"Génération démarrée — GET /generate/{job_id}"}


@app.get("/generate/{job_id}")
async def get_generation_status(job_id: str):
    if job_id not in JOBS: raise HTTPException(404, "Job introuvable")
    job = JOBS[job_id].copy()
    if "result" in job:
        r = job["result"]
        job["summary"] = {"score_layout": r.get("score_layout"),
                          "violations":   len(r.get("violations", [])),
                          "metres":       r.get("metres"),
                          "fichiers":     list(r.get("fichiers", {}).keys()),
                          "questions":    r.get("questions_clarification", [])}
    return JSONResponse(content=job)


@app.get("/generate/{job_id}/svg")
async def get_job_svg(job_id: str):
    if job_id not in JOBS: raise HTTPException(404, "Job introuvable")
    job = JOBS[job_id]
    if job.get("status") != "done": raise HTTPException(409, f"Status: {job.get('status')}")
    svg = job.get("result", {}).get("fichiers", {}).get("svg")
    if not svg or not Path(svg).exists(): raise HTTPException(404, "SVG non disponible")
    return FileResponse(svg, media_type="image/svg+xml")


@app.get("/generate/{job_id}/files/{filename}")
async def get_job_file(job_id: str, filename: str):
    if job_id not in JOBS: raise HTTPException(404, "Job introuvable")
    p = _safe_file(OUTPUT_DIR / job_id, filename)
    return FileResponse(str(p), media_type=MEDIA_TYPES.get(p.suffix.lower(), "application/octet-stream"),
                        filename=p.name)


# ===================================================================
# ANALYSE DE PLANS
# ===================================================================

async def _run_analysis(analysis_id: str, images: list, typology: str, context: str,
                        session_id: Optional[str], save_to_library: bool,
                        template_name: Optional[str], template_tags: list,
                        is_public: bool, user_id: Optional[str]):
    ANALYSIS_JOBS[analysis_id]["status"] = "processing"
    runner = f"""
import {{ analyzePlans }} from '{PLAN_ANALYZER}';
import {{ readFileSync }} from 'fs';
const inp = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await analyzePlans(inp.images, {{ typology: inp.typology, context: inp.context }});
console.log(JSON.stringify(result));
"""
    try:
        result = await _run_node(runner, {"images": images, "typology": typology, "context": context}, timeout=120)
        ANALYSIS_JOBS[analysis_id].update({"status": "done", "result": result,
                                           "completed_at": datetime.utcnow().isoformat()})
        if save_to_library and result.get("programme"):
            save_runner = f"""
import {{ saveTemplate }} from '{TYPO_LIB}';
import {{ readFileSync }} from 'fs';
const inp = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const tpl = await saveTemplate(inp);
console.log(JSON.stringify(tpl));
"""
            tpl = await _run_node(save_runner, {
                "nom":       template_name or f"Template {typology} {datetime.utcnow().strftime('%Y-%m-%d')}",
                "typology":  typology, "tags": template_tags,
                "source_plans": images, "programme": result["programme"],
                "stats": result.get("stats", {}), "confiance": result.get("confiance", 0.7),
                "is_public": is_public, "created_by": user_id
            }, timeout=15)
            ANALYSIS_JOBS[analysis_id]["template_id"] = tpl.get("id")
    except Exception as e:
        ANALYSIS_JOBS[analysis_id].update({"status": "error", "error": str(e)})


@app.post("/analyze-plans", status_code=202)
async def analyze_plans(request: AnalyzePlansRequest, background_tasks: BackgroundTasks):
    if not any(img.data or img.url for img in request.images):
        raise HTTPException(400, "Chaque image doit avoir 'data' (base64) ou 'url'")
    analysis_id = str(uuid.uuid4())
    ANALYSIS_JOBS[analysis_id] = {"id": analysis_id, "status": "queued",
                                   "typology": request.typology,
                                   "nb_images": len(request.images),
                                   "created_at": datetime.utcnow().isoformat()}
    background_tasks.add_task(_run_analysis, analysis_id,
        [img.dict() for img in request.images], request.typology, request.context,
        request.session_id, request.save_to_library, request.template_name,
        request.template_tags, request.is_public, request.user_id)
    return {"analysis_id": analysis_id, "status": "queued",
            "message": f"Analyse démarrée — GET /analyze-plans/{analysis_id}"}


@app.get("/analyze-plans/{analysis_id}")
async def get_analysis_status(analysis_id: str):
    if analysis_id not in ANALYSIS_JOBS: raise HTTPException(404, "Analyse introuvable")
    job = ANALYSIS_JOBS[analysis_id].copy()
    if "result" in job:
        r = job.pop("result")
        job["summary"] = {"nb_espaces":  len(r.get("programme", {}).get("espaces", [])),
                          "nb_liaisons": len(r.get("programme", {}).get("liaisons", [])),
                          "confiance":   r.get("confiance"),
                          "observations": (r.get("observations") or "")[:200]}
        job["programme_available"] = True
    return JSONResponse(content=job)


@app.get("/analyze-plans/{analysis_id}/programme")
async def get_analysis_programme(analysis_id: str):
    if analysis_id not in ANALYSIS_JOBS: raise HTTPException(404, "Analyse introuvable")
    job = ANALYSIS_JOBS[analysis_id]
    if job.get("status") != "done": raise HTTPException(409, f"Status: {job.get('status')}")
    return JSONResponse(content=job["result"])


# ===================================================================
# BIBLIOTHÈQUE TYPOLOGIQUE
# ===================================================================

@app.get("/library/templates")
async def list_templates(
    typology:  Optional[str]  = Query(None),
    is_public: Optional[bool] = Query(None),
    user_id:   Optional[str]  = Query(None),
    limit:     int            = Query(50, ge=1, le=200)
):
    runner = f"""
import {{ listTemplates }} from '{TYPO_LIB}';
import {{ readFileSync }} from 'fs';
const inp = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await listTemplates(inp);
console.log(JSON.stringify(result));
"""
    result = await _run_node(runner, {"typology": typology, "is_public": is_public,
                                      "created_by": user_id, "limit": limit}, timeout=15)
    return JSONResponse(content=result)


@app.get("/library/templates/match")
async def match_templates(
    typology:          str            = Query(...),
    nb_espaces:        Optional[int]  = Query(None),
    surface_totale_m2: Optional[float]= Query(None),
    limit:             int            = Query(3, ge=1, le=10)
):
    runner = f"""
import {{ findMatchingTemplates }} from '{TYPO_LIB}';
import {{ readFileSync }} from 'fs';
const inp = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await findMatchingTemplates(inp.typology, inp.stats, inp.limit);
console.log(JSON.stringify(result));
"""
    result = await _run_node(runner, {
        "typology": typology,
        "stats": {"nb_espaces": nb_espaces, "surface_totale_m2": surface_totale_m2},
        "limit": limit
    }, timeout=15)
    return JSONResponse(content=result)


@app.get("/library/templates/{template_id}")
async def get_template(template_id: str):
    runner = f"""
import {{ getTemplate }} from '{TYPO_LIB}';
import {{ readFileSync }} from 'fs';
const {{ id }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await getTemplate(id);
console.log(JSON.stringify(result));
"""
    result = await _run_node(runner, {"id": template_id}, timeout=10)
    return JSONResponse(content=result)


@app.put("/library/templates/{template_id}")
async def update_template(template_id: str, update: TemplateUpdate, user_id: str = Query(...)):
    runner = f"""
import {{ updateTemplate }} from '{TYPO_LIB}';
import {{ readFileSync }} from 'fs';
const {{ id, updates, userId }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await updateTemplate(id, updates, userId);
console.log(JSON.stringify(result));
"""
    result = await _run_node(runner, {
        "id": template_id, "updates": update.dict(exclude_none=True), "userId": user_id
    }, timeout=10)
    return JSONResponse(content=result)


@app.delete("/library/templates/{template_id}", status_code=204)
async def delete_template(template_id: str, user_id: str = Query(...)):
    runner = f"""
import {{ deleteTemplate }} from '{TYPO_LIB}';
import {{ readFileSync }} from 'fs';
const {{ id, userId }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
await deleteTemplate(id, userId);
console.log('{{}}');
"""
    await _run_node(runner, {"id": template_id, "userId": user_id}, timeout=10)


# ===================================================================
# SESSIONS DE CONCEPTION
# ===================================================================

async def _parse_cdc_background(session_id: str, cdc_texte: str):
    """Parse le CdC en arrière-plan et met à jour la session."""
    runner = f"""
import {{ parseCahierDesCharges, extraireQuestionsClarification }} from '{CDC_PARSER}';
import {{ updateSessionProgramme, appendHistory }} from '{DIALOGUE_ENG}';
import {{ readFileSync }} from 'fs';
const {{ sessionId, cdcTexte }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
try {{
  const programme = await parseCahierDesCharges(cdcTexte);
  const questions = extraireQuestionsClarification(programme);
  programme.metadata = programme.metadata || {{}};
  programme.metadata.questions_clarification = questions;
  await updateSessionProgramme(sessionId, programme, {{ status: 'functional_schema' }});
  await appendHistory(sessionId, 'cdc_parse', null, null, programme, {{
    confiance: programme.metadata.confiance,
    nb_espaces: programme.espaces?.length,
    questions_clarification: questions
  }});
  console.log(JSON.stringify({{ ok: true }}));
}} catch(e) {{
  await updateSessionProgramme(sessionId, {{}}, {{ status: 'erreur' }});
  console.log(JSON.stringify({{ ok: false, error: e.message }}));
}}
"""
    try:
        await _run_node(runner, {"sessionId": session_id, "cdcTexte": cdc_texte}, timeout=120)
    except Exception as e:
        print(f"[parse_cdc_background] Erreur session {session_id}: {e}")


@app.post("/sessions", status_code=201)
async def create_session(request: CreateSessionRequest, background_tasks: BackgroundTasks):
    has_cdc     = bool(request.cdc_texte and request.cdc_texte.strip())
    has_prog    = bool((request.programme or {}).get('espaces'))
    needs_parse = has_cdc and not has_prog
    initial_status = 'parsing' if needs_parse else 'functional_schema'

    runner = f"""
import {{ createSession }} from '{DIALOGUE_ENG}';
import {{ readFileSync }} from 'fs';
const inp = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await createSession(inp);
console.log(JSON.stringify(result));
"""
    result = await _run_node(runner, {
        "user_id": request.user_id, "project_name": request.project_name,
        "cdc_texte": request.cdc_texte, "guide_answers": request.guide_answers,
        "programme": request.programme, "location": request.location,
        "emprise": request.emprise, "plu": request.plu, "template_ids": request.template_ids,
        "status": initial_status
    }, timeout=15)

    if needs_parse:
        background_tasks.add_task(_parse_cdc_background, result["id"], request.cdc_texte)

    return JSONResponse(content=result, status_code=201)


@app.get("/sessions")
async def list_sessions(user_id: str = Query(...), status: Optional[str] = Query(None),
                        limit: int = Query(20, ge=1, le=100)):
    runner = f"""
import {{ listSessions }} from '{DIALOGUE_ENG}';
import {{ readFileSync }} from 'fs';
const {{ userId, status, limit }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await listSessions(userId, {{ status, limit }});
console.log(JSON.stringify(result));
"""
    result = await _run_node(runner, {"userId": user_id, "status": status, "limit": limit}, timeout=10)
    return JSONResponse(content=result)


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    runner = f"""
import {{ getSession }} from '{DIALOGUE_ENG}';
import {{ readFileSync }} from 'fs';
const {{ id }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await getSession(id);
console.log(JSON.stringify(result));
"""
    result = await _run_node(runner, {"id": session_id}, timeout=10)
    return JSONResponse(content=result)


@app.post("/sessions/{session_id}/command")
async def apply_dialogue_command(session_id: str, request: DialogueCommandRequest):
    runner = f"""
import {{ applyCommandAndPersist }} from '{DIALOGUE_ENG}';
import {{ readFileSync }} from 'fs';
const {{ sessionId, command, options }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await applyCommandAndPersist(sessionId, command, options);
console.log(JSON.stringify(result));
"""
    result = await _run_node(runner, {
        "sessionId": session_id, "command": request.command,
        "options": {
            "forceEdit": request.force_edit,
            "model": os.environ.get("DIALOGUE_MODEL", "claude-haiku-4-5-20251001"),
        }
    }, timeout=60)
    return JSONResponse(content=result)


@app.post("/sessions/{session_id}/lock")
async def lock_schema(session_id: str):
    runner = f"""
import {{ lockFunctionalSchema }} from '{DIALOGUE_ENG}';
import {{ readFileSync }} from 'fs';
const {{ id }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await lockFunctionalSchema(id);
console.log(JSON.stringify(result));
"""
    result = await _run_node(runner, {"id": session_id}, timeout=10)
    return JSONResponse(content=result)


@app.post("/sessions/{session_id}/generate", status_code=202)
async def generate_from_session(session_id: str, request: GenerateFromSessionRequest,
                                 background_tasks: BackgroundTasks):
    get_runner = f"""
import {{ getSession }} from '{DIALOGUE_ENG}';
import {{ readFileSync }} from 'fs';
const {{ id }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await getSession(id);
console.log(JSON.stringify(result));
"""
    session = await _run_node(get_runner, {"id": session_id}, timeout=10)
    if session.get("status") not in ("schema_locked", "functional_schema", "draft"):
        raise HTTPException(409, f"Session status incompatible: {session.get('status')}")

    job_id = str(uuid.uuid4())
    JOBS[job_id] = {"job_id": job_id, "status": "queued", "session_id": session_id,
                    "created_at": datetime.utcnow().isoformat()}

    async def _run():
        JOBS[job_id]["status"] = "running"
        input_data = {
            "texte_cdc":   session.get("cdc_texte") or "",
            "programme":   session.get("programme"),
            "projectName": session.get("project_name", "projet"),
            "location":    session.get("location", {}),
            "emprise":     session.get("emprise", {"largeur": 20, "profondeur": 15}),
            "generateIfc": request.generate_ifc,
            "generateGlb": request.generate_glb,
            "skipParsing": bool((session.get("programme") or {}).get("espaces")),
            "sessionId":   session_id
        }
        gen_runner = f"""
import {{ generateBuilding }} from '{GENERATOR_JS}';
import {{ saveGenerationResult }} from '{DIALOGUE_ENG}';
import {{ readFileSync }} from 'fs';
const inp = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const result = await generateBuilding(inp);
if (inp.sessionId) await saveGenerationResult(inp.sessionId, result);
console.log(JSON.stringify(result));
"""
        try:
            result = await _run_node(gen_runner, input_data, timeout=300)
            JOBS[job_id].update({"status": "done", "result": result,
                                  "completed_at": datetime.utcnow().isoformat()})
        except Exception as e:
            JOBS[job_id].update({"status": "error", "error": str(e)})

    background_tasks.add_task(_run)
    return {"job_id": job_id, "session_id": session_id, "status": "queued",
            "message": f"Génération démarrée — GET /generate/{job_id}"}


@app.get("/sessions/{session_id}/layout")
async def get_session_layout(session_id: str):
    layout_engine = GEN_DIR / "layout-engine.js"
    runner = f"""
import {{ getSession }} from '{DIALOGUE_ENG}';
import {{ resolveLayout }} from '{layout_engine}';
import {{ readFileSync }} from 'fs';
const {{ id }} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const session = await getSession(id);
const programme = session.programme;
if (!programme?.espaces?.length) throw new Error('Programme non disponible');
const emprise = session.emprise || {{ largeur: 20, profondeur: 15 }};
const layout = resolveLayout(programme, emprise);
console.log(JSON.stringify(layout));
"""
    result = await _run_node(runner, {"id": session_id}, timeout=30)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return JSONResponse(content=result)


@app.get("/sessions/{session_id}/svg")
async def get_session_svg(session_id: str):
    job = next((j for j in reversed(list(JOBS.values()))
                if j.get("session_id") == session_id and j.get("status") == "done"), None)
    if not job: raise HTTPException(404, "Aucun layout SVG disponible")
    svg = job.get("result", {}).get("fichiers", {}).get("svg")
    if not svg or not Path(svg).exists(): raise HTTPException(404, "SVG non disponible")
    return FileResponse(svg, media_type="image/svg+xml")


# ===================================================================
# SANTÉ
# ===================================================================

@app.get("/health")
async def health():
    return {
        "status":         "ok",
        "jobs_total":     len(JOBS),
        "jobs_done":      sum(1 for j in JOBS.values()          if j.get("status") == "done"),
        "jobs_running":   sum(1 for j in JOBS.values()          if j.get("status") == "running"),
        "jobs_error":     sum(1 for j in JOBS.values()          if j.get("status") == "error"),
        "analyses_total": len(ANALYSIS_JOBS),
        "analyses_done":  sum(1 for j in ANALYSIS_JOBS.values() if j.get("status") == "done")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
