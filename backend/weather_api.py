# weather_api.py
# Live weather data for the Environment Data Engine / AERIS Assistant.
# Default provider is Open-Meteo (https://open-meteo.com) - free, no API
# key required, so AERIS works out of the box anywhere in the world.
# The provider is swappable via WEATHER_API_PROVIDER in .env, following the
# same "one working provider, config-driven" pattern already used for WAQI
# in pollution_api.py. Only "open-meteo" is implemented for now; adding a
# keyed provider later means adding a branch here, not touching any caller.

import httpx
from config import settings
from exceptions import WeatherApiError

# WMO weather codes -> a short human-readable label. This is a subset
# covering the common cases (Open-Meteo's full table is larger) - it exists
# only to make the assistant's sentences readable, not to classify severity.
_WEATHER_CODE_LABELS = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Light freezing drizzle", 57: "Dense freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
}


def _weather_label(code):
    if code is None:
        return None
    try:
        return _WEATHER_CODE_LABELS.get(int(code), "Mixed conditions")
    except (TypeError, ValueError):
        return None


async def get_live_weather(latitude, longitude):
    """
    Returns current weather for the given coordinates as a plain dict, or
    raises WeatherApiError if the provider is unreachable / misconfigured.
    Any field Open-Meteo doesn't report comes back as None - never guessed.
    """
    provider = (settings.WEATHER_API_PROVIDER or "open-meteo").strip().lower()
    if provider != "open-meteo":
        raise WeatherApiError(f"Weather provider '{provider}' is not supported yet.")

    url = f"{settings.WEATHER_API_BASE_URL}/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,"
                    "wind_speed_10m,wind_direction_10m,weather_code",
        "timezone": "auto",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.WEATHER_API_TIMEOUT_SECONDS) as client:
            response = await client.get(url, params=params)
    except httpx.RequestError as e:
        raise WeatherApiError(f"Could not reach the weather API: {e}")

    if response.status_code != 200:
        raise WeatherApiError(f"Weather API error (status {response.status_code})")

    result = response.json()
    current = result.get("current")
    if not current:
        raise WeatherApiError("Weather API returned no current conditions for this location.")

    return {
        "temperature": current.get("temperature_2m"),
        "feelsLike": current.get("apparent_temperature"),
        "humidity": current.get("relative_humidity_2m"),
        "windSpeed": current.get("wind_speed_10m"),
        "windDirection": current.get("wind_direction_10m"),
        "condition": _weather_label(current.get("weather_code")),
        "observedAt": current.get("time"),
        "source": "Open-Meteo",
    }