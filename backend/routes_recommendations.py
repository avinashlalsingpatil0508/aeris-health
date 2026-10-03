# routes_recommendations.py
# Handles protection recommendations (both database ones and the ones
# calculated live from pollutant values).

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Recommendation
from schemas import RecommendationIn, RecommendationOut
from exceptions import NotFoundError
from helpers import success_response
import risk_calculator as calc

router = APIRouter(prefix="/api/recommendations", tags=["Recommendations"])


def get_recommendations_for_level(db: Session, risk_level):
    """Used by other route files to fetch saved recommendations for a risk level."""
    rows = (
        db.query(Recommendation)
        .filter(Recommendation.risk_level == risk_level.upper())
        .order_by(Recommendation.priority_order.asc())
        .all()
    )
    return [RecommendationOut.from_recommendation(r) for r in rows]


@router.get("")
def get_all_recommendations(db: Session = Depends(get_db)):
    rows = db.query(Recommendation).all()
    result = [RecommendationOut.from_recommendation(r) for r in rows]
    return success_response(result, f"Found {len(result)} recommendations")


@router.get("/dynamic")
def get_dynamic_advice(
    aqi: float = Query(..., ge=0, le=500),
    pm25: float = Query(default=0.0),
    coLevel: float = Query(default=0.0),
    age: int = Query(..., ge=1, le=120),
    healthCondition: str = Query(default="NORMAL"),
    smoker: bool = Query(default=False),
    exposureHours: int = Query(default=4),
    exposureLevel: str = Query(default="MEDIUM"),
):
    """Gives quick advice without saving anything to the database."""
    risk_percentage = calc.calculate_risk_percentage(
        aqi, pm25, 0, coLevel, 0, 0, age, healthCondition, smoker, exposureHours, exposureLevel
    )
    risk_level = calc.get_risk_level(risk_percentage)

    advice = {
        "aqi": aqi,
        "aqiCategory": calc.get_aqi_category(aqi),
        "aqiCategoryLabel": calc.get_aqi_label(aqi),
        "riskPercentage": risk_percentage,
        "riskLevel": risk_level,
        "alertMessage": calc.generate_alert_message(risk_level, healthCondition, smoker, age),
        "healthImpacts": calc.predict_health_impacts(aqi, pm25, 0, coLevel, 0, 0, healthCondition, smoker),
        "recommendations": calc.generate_recommendations(risk_level, pm25, coLevel, healthCondition, smoker, exposureHours),
    }
    return success_response(advice, "Dynamic health advice generated")


@router.get("/level/{risk_level}")
def get_by_risk_level(risk_level: str, db: Session = Depends(get_db)):
    result = get_recommendations_for_level(db, risk_level)
    return success_response(result, f"Found {len(result)} recommendations for risk level: {risk_level.upper()}")


@router.post("", status_code=201)
def add_recommendation(data: RecommendationIn, db: Session = Depends(get_db)):
    rec = Recommendation(
        risk_level=data.riskLevel,
        category=data.category,
        recommendation_text=data.recommendationText,
        priority_order=data.priorityOrder or 1,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return success_response(RecommendationOut.from_recommendation(rec), "Recommendation added successfully")


@router.delete("/{rec_id}")
def delete_recommendation(rec_id: int, db: Session = Depends(get_db)):
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id).first()
    if not rec:
        raise NotFoundError(f"Recommendation not found with id: {rec_id}")
    db.delete(rec)
    db.commit()
    return success_response(None, "Recommendation deleted successfully")
