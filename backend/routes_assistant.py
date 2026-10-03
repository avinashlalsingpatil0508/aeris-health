# routes_assistant.py
# The AERIS Assistant endpoint. This route does NOT calculate risk itself -
# it asks routes_environment.py for a live snapshot (which in turn uses the
# existing, unmodified risk_calculator.py), then hands that snapshot to
# assistant_engine to be turned into a natural-language reply.
#
#   User question
#     -> current location (lat/lon, from the browser)
#     -> live environment data (routes_environment.build_environment_snapshot)
#     -> existing AERIS risk engine (risk_calculator.py, inside the step above)
#     -> health impacts + recommendations (also inside the step above)
#     -> assistant explanation (assistant_engine.answer_question)

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from schemas import AssistantAskRequest, AssistantAskOut
from exceptions import BadRequestError
from helpers import success_response
from routes_environment import build_environment_snapshot, context_to_snapshot
import assistant_engine

router = APIRouter(prefix="/api/assistant", tags=["Assistant"])


@router.post("/ask")
async def ask_assistant(payload: AssistantAskRequest, db: Session = Depends(get_db)):
    if payload.latitude is None or payload.longitude is None:
        raise BadRequestError(
            "Location is required to answer environment questions. Please share your location and try again."
        )

    context = await build_environment_snapshot(db, payload.latitude, payload.longitude, payload.userId)
    result = assistant_engine.answer_question(payload.question, context)
    snapshot = context_to_snapshot(context, payload.latitude, payload.longitude)

    response = AssistantAskOut(intent=result["intent"], reply=result["reply"], context=snapshot)
    return success_response(response, "Assistant response generated")