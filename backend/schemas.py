# schemas.py
# This file has all the request/response data shapes (Pydantic models).
# All field names are camelCase so the JSON matches what the existing
# frontend JavaScript already expects.

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------- User ----------

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=4)
    age: int = Field(..., ge=1, le=120)
    gender: str
    healthCondition: Optional[str] = "NORMAL"

    @field_validator("gender")
    @classmethod
    def check_gender(cls, v):
        if v.upper() not in ("MALE", "FEMALE", "OTHER"):
            raise ValueError("Gender must be MALE, FEMALE, or OTHER")
        return v.upper()


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    age: int
    gender: str
    healthCondition: str
    createdAt: datetime

    @staticmethod
    def from_user(user):
        """Builds a UserOut straight from a User database row."""
        return UserOut(
            id=user.id, name=user.name, email=user.email, age=user.age,
            gender=user.gender, healthCondition=user.health_condition,
            createdAt=user.created_at,
        )


# ---------- Pollution ----------

class PollutionInput(BaseModel):
    userId: int
    location: str
    aqi: float = Field(..., ge=0, le=500)
    pm25: Optional[float] = 0.0
    pm10: Optional[float] = 0.0
    coLevel: Optional[float] = 0.0
    no2Level: Optional[float] = 0.0
    so2Level: Optional[float] = 0.0
    exposureHours: int = Field(..., ge=0, le=24)
    smoker: bool = False
    pollutionExposureLevel: str = "MEDIUM"

    @field_validator("pollutionExposureLevel")
    @classmethod
    def check_exposure_level(cls, v):
        if v.upper() not in ("LOW", "MEDIUM", "HIGH"):
            raise ValueError("Exposure level must be LOW, MEDIUM, or HIGH")
        return v.upper()


class PollutionRecordOut(BaseModel):
    id: int
    userId: int
    userName: str
    location: str
    aqi: float
    aqiCategory: str
    pm25: float
    pm10: float
    coLevel: float
    no2Level: float
    so2Level: float
    recordedAt: datetime


# ---------- Recommendation ----------

VALID_RISK_LEVELS = ("LOW", "MODERATE", "HIGH", "CRITICAL")
VALID_CATEGORIES = ("OUTDOOR", "INDOOR", "MEDICAL", "DIETARY", "GENERAL")


class RecommendationIn(BaseModel):
    riskLevel: str
    category: str
    recommendationText: str
    priorityOrder: Optional[int] = 1

    @field_validator("riskLevel")
    @classmethod
    def check_risk_level(cls, v):
        if v.upper() not in VALID_RISK_LEVELS:
            raise ValueError("riskLevel must be one of LOW, MODERATE, HIGH, CRITICAL")
        return v.upper()

    @field_validator("category")
    @classmethod
    def check_category(cls, v):
        if v.upper() not in VALID_CATEGORIES:
            raise ValueError("category must be one of OUTDOOR, INDOOR, MEDICAL, DIETARY, GENERAL")
        return v.upper()


class RecommendationOut(BaseModel):
    id: Optional[int] = None
    riskLevel: str
    category: str
    recommendationText: str
    priorityOrder: int = 1

    @staticmethod
    def from_recommendation(rec):
        """Builds a RecommendationOut from a Recommendation database row."""
        return RecommendationOut(
            id=rec.id, riskLevel=rec.risk_level, category=rec.category,
            recommendationText=rec.recommendation_text, priorityOrder=rec.priority_order,
        )


# ---------- Risk Report ----------

class RiskReportOut(BaseModel):
    id: int
    userId: int
    userName: str
    recordId: int
    location: str
    aqi: float
    aqiCategory: str
    # Pollutant readings for the analysed record. These were previously
    # missing here, which is why the result page's pollutant bars and radar
    # chart always showed 0 - the frontend was reading fields that didn't
    # exist on this response. Fixed by adding them below.
    pm25: float = 0.0
    pm10: float = 0.0
    coLevel: float = 0.0
    no2Level: float = 0.0
    so2Level: float = 0.0
    riskPercentage: float
    riskLevel: str
    affectedOrgans: str
    alertMessage: str
    healthImpacts: List[str] = []
    recommendations: List[RecommendationOut] = []
    calculatedAt: datetime


# ---------- Environment & AERIS Assistant ----------

class EnvironmentSnapshotOut(BaseModel):
    """
    A live environment snapshot for one set of coordinates: weather + AQI +
    pollutants, and (only when a userId was given and live AQI was
    available) a personalised risk report computed by the EXISTING
    risk_calculator.py - never a second/alternative calculation.
    Every optional field is None, not 0 or a guess, when that piece of
    live data could not be fetched.
    """
    location: Optional[str] = None
    latitude: float
    longitude: float

    weatherAvailable: bool = False
    temperature: Optional[float] = None
    feelsLike: Optional[float] = None
    humidity: Optional[float] = None
    windSpeed: Optional[float] = None
    weatherCondition: Optional[str] = None
    weatherSource: Optional[str] = None

    aqiAvailable: bool = False
    aqi: Optional[float] = None
    aqiCategory: Optional[str] = None
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    coLevel: Optional[float] = None
    no2Level: Optional[float] = None
    so2Level: Optional[float] = None
    o3Level: Optional[float] = None
    stationName: Optional[str] = None
    aqiObservedAt: Optional[str] = None
    aqiSource: Optional[str] = None

    riskAvailable: bool = False
    riskPercentage: Optional[float] = None
    riskLevel: Optional[str] = None
    affectedOrgans: Optional[str] = None
    alertMessage: Optional[str] = None
    healthImpacts: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None
    riskUnavailableReason: Optional[str] = None
    personalFactorsNote: Optional[str] = None


class AssistantAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    userId: Optional[int] = None


class AssistantAskOut(BaseModel):
    intent: str
    reply: str
    context: EnvironmentSnapshotOut