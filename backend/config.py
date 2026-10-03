# config.py
# Reads settings from the .env file (or environment variables).
# Never put real passwords/API keys directly in this file.

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME = os.getenv("APP_NAME", "AERIS Health API")

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "pollution_db")
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")

    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}",
    )

    POLLUTION_API_KEY = os.getenv("POLLUTION_API_KEY", "")
    POLLUTION_API_BASE_URL = os.getenv("POLLUTION_API_BASE_URL", "https://api.waqi.info")
    POLLUTION_API_TIMEOUT_SECONDS = float(os.getenv("POLLUTION_API_TIMEOUT_SECONDS", "8"))

    # Live weather for the Environment Data Engine / AERIS Assistant.
    # Open-Meteo needs no API key, so AERIS works out of the box; a keyed
    # provider can be added later without changing anything that calls it.
    WEATHER_API_PROVIDER = os.getenv("WEATHER_API_PROVIDER", "open-meteo")
    WEATHER_API_KEY = os.getenv("WEATHER_API_KEY", "")
    WEATHER_API_BASE_URL = os.getenv("WEATHER_API_BASE_URL", "https://api.open-meteo.com/v1")
    WEATHER_API_TIMEOUT_SECONDS = float(os.getenv("WEATHER_API_TIMEOUT_SECONDS", "8"))

    # Optional AI backend for the AERIS Assistant's explanation layer only.
    # Leave ASSISTANT_AI_PROVIDER blank to use the built-in deterministic
    # assistant - AERIS works fully without any of these set.
    ASSISTANT_AI_PROVIDER = os.getenv("ASSISTANT_AI_PROVIDER", "")
    ASSISTANT_AI_API_KEY = os.getenv("ASSISTANT_AI_API_KEY", "")
    ASSISTANT_AI_MODEL = os.getenv("ASSISTANT_AI_MODEL", "")
    ASSISTANT_AI_TIMEOUT_SECONDS = float(os.getenv("ASSISTANT_AI_TIMEOUT_SECONDS", "15"))

    CORS_ALLOWED_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:8000,http://127.0.0.1:8000,http://localhost:5500,http://127.0.0.1:5500"
        ).split(",")
        if origin.strip()
    ]

    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-secret-key")


settings = Settings()