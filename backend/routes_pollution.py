# routes_pollution.py
# Handles pollution data: submitting a reading (which also runs the risk
# calculation), fetching live AQI data, and city-wide analysis.

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import User, PollutionRecord, RiskReport
from schemas import PollutionInput, PollutionRecordOut, RiskReportOut, RecommendationOut
from exceptions import NotFoundError, BadRequestError
from helpers import success_response
import risk_calculator as calc
from pollution_api import get_live_pollution_data
from routes_recommendations import get_recommendations_for_level

router = APIRouter(prefix="/api/pollution", tags=["Pollution"])


@router.post("/submit", status_code=201)
def submit_pollution_data(data: PollutionInput, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.userId).first()
    if not user:
        raise NotFoundError(f"User not found with id: {data.userId}")

    # Steps 1-3 (save the reading, calculate the risk, save the risk report)
    # now run as ONE database transaction. Previously the reading was
    # committed on its own before the risk was calculated; if step 2 or 3
    # failed afterwards, the pollution record was left saved with no
    # matching risk report. Wrapping everything in a single try/except with
    # one commit (and a rollback on any failure) makes the whole submission
    # atomic - it either fully succeeds or leaves nothing behind.
    try:
        # Step 1: save the pollution reading (not committed yet)
        record = PollutionRecord(
            user_id=user.id,
            location=data.location.strip(),
            aqi=data.aqi,
            pm25=data.pm25 or 0,
            pm10=data.pm10 or 0,
            co_level=data.coLevel or 0,
            no2_level=data.no2Level or 0,
            so2_level=data.so2Level or 0,
        )
        db.add(record)
        db.flush()  # assigns record.id without committing, so RiskReport can reference it

        # Step 2: calculate the health risk (risk_calculator.py is unchanged)
        risk_percentage = calc.calculate_risk_percentage(
            record.aqi, record.pm25, record.pm10, record.co_level, record.no2_level, record.so2_level,
            user.age, user.health_condition, data.smoker, data.exposureHours, data.pollutionExposureLevel,
        )
        risk_level = calc.get_risk_level(risk_percentage)
        affected_organs = calc.determine_affected_organs(
            record.aqi, record.pm25, record.pm10, record.co_level, record.no2_level, record.so2_level
        )
        alert_message = calc.generate_alert_message(risk_level, user.health_condition, data.smoker, user.age)

        # Step 3: save the risk report
        report = RiskReport(
            user_id=user.id,
            record_id=record.id,
            risk_percentage=risk_percentage,
            risk_level=risk_level,
            affected_organs=affected_organs,
            alert_message=alert_message,
        )
        db.add(report)

        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(record)
    db.refresh(report)

    # Step 4: build the full response
    health_impacts = calc.predict_health_impacts(
        record.aqi, record.pm25, record.pm10, record.co_level, record.no2_level,
        record.so2_level, user.health_condition, data.smoker,
    )
    tips = calc.generate_recommendations(
        risk_level, record.pm25, record.co_level, user.health_condition, data.smoker, data.exposureHours
    )
    db_recs = get_recommendations_for_level(db, risk_level)

    recommendations = list(db_recs)
    for tip in tips:
        already_there = any(r.recommendationText.lower() == tip.lower() for r in recommendations)
        if not already_there:
            recommendations.append(RecommendationOut(
                riskLevel=risk_level, category="GENERAL",
                recommendationText=tip, priorityOrder=len(recommendations) + 1,
            ))

    result = RiskReportOut(
        id=report.id, userId=user.id, userName=user.name, recordId=record.id,
        location=record.location, aqi=record.aqi, aqiCategory=calc.get_aqi_label(record.aqi),
        pm25=record.pm25, pm10=record.pm10, coLevel=record.co_level,
        no2Level=record.no2_level, so2Level=record.so2_level,
        riskPercentage=risk_percentage, riskLevel=risk_level, affectedOrgans=affected_organs,
        alertMessage=alert_message, healthImpacts=health_impacts,
        recommendations=recommendations, calculatedAt=report.calculated_at,
    )
    return success_response(result, "Pollution data submitted and analysed successfully")


@router.get("/live")
async def get_live_data(location: str = Query(..., min_length=1)):
    """
    Gets live AQI + pollutant data for a location from the WAQI API.
    This does NOT save anything - it is only used to pre-fill the submit
    form. The user still has to press "Run Health Risk Analysis" to save it.
    """
    data = await get_live_pollution_data(location)
    return success_response(data, f"Live pollution data retrieved for: {location}")


@router.get("/aqi-info")
def get_aqi_info(aqi: float = Query(..., ge=0, le=500)):
    info = {
        "aqi": aqi,
        "category": calc.get_aqi_category(aqi),
        "categoryLabel": calc.get_aqi_label(aqi),
    }
    return success_response(info, "AQI info")


@router.get("/city-analysis")
def get_city_analysis(location: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    records = db.query(PollutionRecord).filter(PollutionRecord.location.ilike(f"%{location}%")).all()

    if not records:
        return success_response(
            {"location": location, "totalRecords": 0},
            f"No data found for location: {location}",
        )

    total = len(records)
    avg_aqi = round(sum(r.aqi for r in records) / total, 1)
    avg_pm25 = round(sum(r.pm25 for r in records) / total, 1)
    avg_pm10 = round(sum(r.pm10 for r in records) / total, 1)
    avg_co = round(sum(r.co_level for r in records) / total, 1)
    avg_no2 = round(sum(r.no2_level for r in records) / total, 1)
    avg_so2 = round(sum(r.so2_level for r in records) / total, 1)

    city_data = {
        "location": location,
        "totalRecords": total,
        "averageAqi": avg_aqi,
        "aqiCategory": calc.get_aqi_category(avg_aqi),
        "aqiCategoryLabel": calc.get_aqi_label(avg_aqi),
        "averagePm25": avg_pm25,
        "averagePm10": avg_pm10,
        "averageCoLevel": avg_co,
        "averageNo2Level": avg_no2,
        "averageSo2Level": avg_so2,
        "overallRiskLevel": calc.get_risk_level(
            calc.calculate_risk_percentage(avg_aqi, avg_pm25, avg_pm10, avg_co, avg_no2, avg_so2,
                                            30, "NORMAL", False, 4, "MEDIUM")
        ),
    }
    return success_response(city_data, f"City pollution analysis for: {location}")


@router.get("/user/{user_id}")
def get_records_for_user(user_id: int, db: Session = Depends(get_db)):
    records = (
        db.query(PollutionRecord)
        .filter(PollutionRecord.user_id == user_id)
        .order_by(PollutionRecord.recorded_at.desc())
        .all()
    )
    result = [_record_to_out(r) for r in records]
    return success_response(result, f"Found {len(result)} records for user")


@router.get("/search")
def search_by_location(location: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    records = db.query(PollutionRecord).filter(PollutionRecord.location.ilike(f"%{location}%")).all()
    result = [_record_to_out(r) for r in records]
    return success_response(result, f"Found {len(result)} records for location: {location}")


@router.get("/{record_id}")
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(PollutionRecord).filter(PollutionRecord.id == record_id).first()
    if not record:
        raise NotFoundError(f"Pollution record not found with id: {record_id}")
    return success_response(_record_to_out(record))


@router.delete("/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(PollutionRecord).filter(PollutionRecord.id == record_id).first()
    if not record:
        raise NotFoundError(f"Pollution record not found with id: {record_id}")
    db.delete(record)
    db.commit()
    return success_response(None, "Pollution record deleted successfully")


def _record_to_out(record):
    return PollutionRecordOut(
        id=record.id, userId=record.user_id, userName=record.user.name,
        location=record.location, aqi=record.aqi, aqiCategory=calc.get_aqi_label(record.aqi),
        pm25=record.pm25, pm10=record.pm10, coLevel=record.co_level,
        no2Level=record.no2_level, so2Level=record.so2_level, recordedAt=record.recorded_at,
    )