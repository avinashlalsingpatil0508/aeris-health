# models.py
# This file has all the database tables (SQLAlchemy models) for the project.
# Tables: users, pollution_records, risk_reports, recommendations

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False, unique=True, index=True)
    password = Column(String(255), nullable=False)  # stored as a hashed password, never plain text
    age = Column(Integer, nullable=False)
    gender = Column(String(10), nullable=False)
    health_condition = Column(String(100), nullable=False, default="NORMAL")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    pollution_records = relationship("PollutionRecord", back_populates="user", cascade="all, delete-orphan")
    risk_reports = relationship("RiskReport", back_populates="user", cascade="all, delete-orphan")


class PollutionRecord(Base):
    __tablename__ = "pollution_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    location = Column(String(150), nullable=False)
    aqi = Column(Float, nullable=False)
    pm25 = Column(Float, nullable=False, default=0.0)
    pm10 = Column(Float, nullable=False, default=0.0)
    co_level = Column(Float, nullable=False, default=0.0)
    no2_level = Column(Float, nullable=False, default=0.0)
    so2_level = Column(Float, nullable=False, default=0.0)
    recorded_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="pollution_records")
    risk_report = relationship("RiskReport", back_populates="pollution_record", uselist=False, cascade="all, delete-orphan")


class RiskReport(Base):
    __tablename__ = "risk_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    record_id = Column(Integer, ForeignKey("pollution_records.id"), nullable=False, unique=True)
    risk_percentage = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False, index=True)  # LOW, MODERATE, HIGH, CRITICAL
    affected_organs = Column(String(500), nullable=False)
    alert_message = Column(Text, nullable=False)
    calculated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="risk_reports")
    pollution_record = relationship("PollutionRecord", back_populates="risk_report")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    risk_level = Column(String(20), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    recommendation_text = Column(Text, nullable=False)
    priority_order = Column(Integer, nullable=False, default=1)
