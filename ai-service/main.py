"""
AI Microservice — Smart Resource Allocation: Volunteer Coordination Platform
Exposes four routers: /ai/process, /ai/priority, /ai/match, /ai/geo
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from nlp.router      import router as nlp_router
from priority.router import router as priority_router
from matching.router import router as matching_router
from geo.router      import router as geo_router

app = FastAPI(
    title="Volunteer Coordination AI Service",
    version="1.0.0",
    description="NLP processing, priority scoring, volunteer matching, and geo-optimization.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(nlp_router,      prefix="/ai")
app.include_router(priority_router, prefix="/ai")
app.include_router(matching_router, prefix="/ai")
app.include_router(geo_router,      prefix="/ai")


@app.get("/health")
def health():
    return {"status": "ok"}
