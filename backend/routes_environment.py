# routes_environment.py
# The AERIS "Environment Data Engine": combines live weather, live AQI, and
# (when a user is known) the EXISTING risk_calculator.py into a single
# snapshot. This is the one place both GET /api/environment/live and the
# AERIS Assistant (routes_assistant.py) get their data from, so there is
# exactly one code path that talks to the outside world and exactly one
# code path that computes risk (risk_calculator.py itself, unchanged).

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User, RiskReport
from schemas import EnvironmentSnapshotOut
from helpers import success_response
from exceptions import WeatherApiError, PollutionApiError
import risk_calculator as calc
from weather_api import get_live_weather
from pollution_api import get_live_pollution_by_coords

router = APIRouter(prefix="/api/environment", tags=["Environment"])

# Neutral defaults used only for an on-demand, geolocation-triggered risk
# estimate. A user's smoking status and daily exposure hours are captured
# per pollution-submission, not stored on their profile, so a live "what's
# my risk right now" check uses the same neutral defaults already used by
# the existing GET /api/recommendations/dynamic endpoint.
_DEFAULT_SMOKER = False
_DEFAULT_EXPOSURE_HOURS = 4
_DEFAULT_EXPOSURE_LEVEL = "MEDIUM"


async def build_environment_snapshot(db: Session, latitude: float, longitude: float, user_id: Optional[int]):
    """
    Fetches live weather + live AQI for the given coordinates and, if a
    user id is given and live AQI was found, runs the existing AERIS risk
    calculator on top of it. Returns a plain dict where every field is
    present, but many will be None if that piece of live data could not be
    fetched - never filled in with 0 or a guess.
    """
    try:
        weather_data = await get_live_weather(latitude, longitude)
    except WeatherApiError:
        weather_data = None

    try:
        aqi_data = await get_live_pollution_by_coords(latitude, longitude)
    except PollutionApiError:
        aqi_data = None

    aqi_value = (aqi_data or {}).get("aqi")

    context = {
        "location": (aqi_data or {}).get("location"),
        "weatherAvailable": weather_data is not None,
        "temperature": (weather_data or {}).get("temperature"),
        "feelsLike": (weather_data or {}).get("feelsLike"),
        "humidity": (weather_data or {}).get("humidity"),
        "windSpeed": (weather_data or {}).get("windSpeed"),
        "weatherCondition": (weather_data or {}).get("condition"),
        "weatherSource": (weather_data or {}).get("source"),

        "aqiAvailable": aqi_value is not None,
        "aqi": aqi_value,
        "aqiCategory": calc.get_aqi_label(aqi_value) if aqi_value is not None else None,
        "pm25": (aqi_data or {}).get("pm25"),
        "pm10": (aqi_data or {}).get("pm10"),
        "coLevel": (aqi_data or {}).get("coLevel"),
        "no2Level": (aqi_data or {}).get("no2Level"),
        "so2Level": (aqi_data or {}).get("so2Level"),
        "o3Level": (aqi_data or {}).get("o3Level"),
        "stationName": (aqi_data or {}).get("location"),
        "aqiObservedAt": (aqi_data or {}).get("observedAt"),
        "aqiSource": (aqi_data or {}).get("source"),

        "riskAvailable": False,
        "riskPercentage": None,
        "riskLevel": None,
        "affectedOrgans": None,
        "alertMessage": None,
        "healthImpacts": None,
        "recommendations": None,
        "riskUnavailableReason": None,
        "personalFactorsNote": None,
        "previousReport": None,
    }

    if aqi_value is None:
        context["riskUnavailableReason"] = (
            "Live AQI data is currently unavailable for your location, so a personalised "
            "health risk can't be calculated right now."
        )
        return context

    if not user_id:
        context["riskUnavailableReason"] = (
            "Log in to get a personalised health risk based on your age and health profile."
        )
        return context

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        context["riskUnavailableReason"] = "User profile not found."
        return context

    calc_pm25 = context["pm25"] if context["pm25"] is not None else 0.0
    calc_pm10 = context["pm10"] if context["pm10"] is not None else 0.0
    calc_co = context["coLevel"] if context["coLevel"] is not None else 0.0
    calc_no2 = context["no2Level"] if context["no2Level"] is not None else 0.0
    calc_so2 = context["so2Level"] if context["so2Level"] is not None else 0.0

    # This is the EXISTING, unmodified risk calculator - the same function
    # routes_pollution.py calls for manual submissions.
    risk_percentage = calc.calculate_risk_percentage(
        aqi_value, calc_pm25, calc_pm10, calc_co, calc_no2, calc_so2,
        user.age, user.health_condition,
        _DEFAULT_SMOKER, _DEFAULT_EXPOSURE_HOURS, _DEFAULT_EXPOSURE_LEVEL,
    )
    risk_level = calc.get_risk_level(risk_percentage)

    context.update({
        "riskAvailable": True,
        "riskPercentage": risk_percentage,
        "riskLevel": risk_level,
        "affectedOrgans": calc.determine_affected_organs(
            aqi_value, calc_pm25, calc_pm10, calc_co, calc_no2, calc_so2
        ),
        "alertMessage": calc.generate_alert_message(risk_level, user.health_condition, _DEFAULT_SMOKER, user.age),
        "healthImpacts": calc.predict_health_impacts(
            aqi_value, calc_pm25, calc_pm10, calc_co, calc_no2, calc_so2,
            user.health_condition, _DEFAULT_SMOKER,
        ),
        "recommendations": calc.generate_recommendations(
            risk_level, calc_pm25, calc_co, user.health_condition, _DEFAULT_SMOKER, _DEFAULT_EXPOSURE_HOURS,
        ),
    })

    if user.health_condition and user.health_condition.upper() != "NORMAL":
        context["personalFactorsNote"] = (
            f"Since your saved profile lists {user.health_condition.replace('_', ' ').title()}, "
            f"this estimate already takes that into account."
        )

    last_report = (
        db.query(RiskReport)
        .filter(RiskReport.user_id == user_id)
        .order_by(RiskReport.calculated_at.desc())
        .first()
    )
    if last_report and last_report.pollution_record:
        context["previousReport"] = {
            "aqi": last_report.pollution_record.aqi,
            "riskPercentage": last_report.risk_percentage,
            "riskLevel": last_report.risk_level,
            "calculatedAt": str(last_report.calculated_at),
        }

    return context


def context_to_snapshot(context, latitude, longitude):
    """Converts the internal context dict into the EnvironmentSnapshotOut
    response shape, shared by /environment/live and /assistant/ask."""
    return EnvironmentSnapshotOut(
        location=context["location"],
        latitude=latitude,
        longitude=longitude,
        weatherAvailable=context["weatherAvailable"],
        temperature=context["temperature"],
        feelsLike=context["feelsLike"],
        humidity=context["humidity"],
        windSpeed=context["windSpeed"],
        weatherCondition=context["weatherCondition"],
        weatherSource=context["weatherSource"],
        aqiAvailable=context["aqiAvailable"],
        aqi=context["aqi"],
        aqiCategory=context["aqiCategory"],
        pm25=context["pm25"],
        pm10=context["pm10"],
        coLevel=context["coLevel"],
        no2Level=context["no2Level"],
        so2Level=context["so2Level"],
        o3Level=context["o3Level"],
        stationName=context["stationName"],
        aqiObservedAt=context["aqiObservedAt"],
        aqiSource=context["aqiSource"],
        riskAvailable=context["riskAvailable"],
        riskPercentage=context["riskPercentage"],
        riskLevel=context["riskLevel"],
        affectedOrgans=context["affectedOrgans"],
        alertMessage=context["alertMessage"],
        healthImpacts=context["healthImpacts"],
        recommendations=context["recommendations"],
        riskUnavailableReason=context["riskUnavailableReason"],
        personalFactorsNote=context["personalFactorsNote"],
    )


@router.get("/live")
async def get_live_environment(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    userId: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Live environment snapshot for any coordinates: weather + AQI + pollutants,
    and (if userId is given) a personalised risk report computed with the
    existing risk_calculator.py. Works for any location - nothing is
    hardcoded to a specific city.
    """
    context = await build_environment_snapshot(db, latitude, longitude, userId)
    snapshot = context_to_snapshot(context, latitude, longitude)
    return success_response(snapshot, "Live environment snapshot retrieved")