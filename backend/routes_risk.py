# routes_risk.py
# Handles viewing risk reports and basic stats for the dashboard.

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import RiskReport
from schemas import RiskReportOut
from exceptions import NotFoundError
from helpers import success_response
import risk_calculator as calc
from routes_recommendations import get_recommendations_for_level

router = APIRouter(prefix="/api/risk", tags=["Risk Reports"])


@router.get("/stats")
def get_risk_stats(db: Session = Depends(get_db)):
    low = db.query(RiskReport).filter(RiskReport.risk_level == "LOW").count()
    moderate = db.query(RiskReport).filter(RiskReport.risk_level == "MODERATE").count()
    high = db.query(RiskReport).filter(RiskReport.risk_level == "HIGH").count()
    critical = db.query(RiskReport).filter(RiskReport.risk_level == "CRITICAL").count()
    total = low + moderate + high + critical

    high_risk_percent = f"{round(((high + critical) / total) * 100)}%" if total > 0 else "0%"

    stats = {
        "totalReports": total,
        "lowRiskCount": low,
        "moderateCount": moderate,
        "highRiskCount": high,
        "criticalCount": critical,
        "highRiskPercent": high_risk_percent,
    }
    return success_response(stats, "Risk report statistics")


@router.get("/user/{user_id}")
def get_reports_for_user(user_id: int, db: Session = Depends(get_db)):
    reports = (
        db.query(RiskReport)
        .filter(RiskReport.user_id == user_id)
        .order_by(RiskReport.calculated_at.desc())
        .all()
    )
    result = [_report_to_out(r, db) for r in reports]
    return success_response(result, f"Found {len(result)} risk reports for user")


@router.get("/level/{risk_level}")
def get_reports_by_level(risk_level: str, db: Session = Depends(get_db)):
    reports = db.query(RiskReport).filter(RiskReport.risk_level == risk_level.upper()).all()
    result = [_report_to_out(r, db) for r in reports]
    return success_response(result, f"Found {len(result)} reports with risk level: {risk_level.upper()}")


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(RiskReport).filter(RiskReport.id == report_id).first()
    if not report:
        raise NotFoundError(f"Risk report not found with id: {report_id}")
    return success_response(_report_to_out(report, db))


def _report_to_out(report, db):
    record = report.pollution_record
    user = report.user

    health_impacts = calc.predict_health_impacts(
        record.aqi, record.pm25, record.pm10, record.co_level, record.no2_level,
        record.so2_level, user.health_condition, False,
    )
    recommendations = get_recommendations_for_level(db, report.risk_level)

    return RiskReportOut(
        id=report.id, userId=user.id, userName=user.name, recordId=record.id,
        location=record.location, aqi=record.aqi, aqiCategory=calc.get_aqi_label(record.aqi),
        pm25=record.pm25, pm10=record.pm10, coLevel=record.co_level,
        no2Level=record.no2_level, so2Level=record.so2_level,
        riskPercentage=report.risk_percentage, riskLevel=report.risk_level,
        affectedOrgans=report.affected_organs, alertMessage=report.alert_message,
        healthImpacts=health_impacts, recommendations=recommendations,
        calculatedAt=report.calculated_at,
    )