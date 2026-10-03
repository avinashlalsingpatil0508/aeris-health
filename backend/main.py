# main.py
# This is the starting point of the backend. Run it with:
#   uvicorn main:app --reload --port 8000

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import Base, engine
from exceptions import register_exception_handlers

import models  # needed so SQLAlchemy knows about the tables before create_all()

from routes_users import router as users_router
from routes_pollution import router as pollution_router
from routes_risk import router as risk_router
from routes_recommendations import router as recommendations_router
from routes_environment import router as environment_router
from routes_assistant import router as assistant_router

# Create the database tables if they don't exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Based Pollution and Emission Health Risk & Protection System - backend API",
    version="1.0.0",
)

register_exception_handlers(app)

# Allow the frontend (running on a different port) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(pollution_router)
app.include_router(risk_router)
app.include_router(recommendations_router)
app.include_router(environment_router)
app.include_router(assistant_router)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": settings.APP_NAME}