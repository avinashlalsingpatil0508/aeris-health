# pollution_api.py
# This file talks to the WAQI (World Air Quality Index) website to get
# live AQI and pollutant data for a location.
# WAQI is free to use for student projects. Get a token here:
# https://aqicn.org/data-platform/token/
#
# Two ways to look up a station are supported:
#   - by city/location name (get_live_pollution_data) - used by the
#     existing "Fetch Live Data" city search feature.
#   - by latitude/longitude (get_live_pollution_by_coords) - used by the
#     new Environment Data Engine / AERIS Assistant, so it can work for
#     any location without the user typing a city name.
# Both share the same response parsing, so they always return the same
# shape and the same "never invent a missing value" behaviour.

import httpx
from config import settings
from exceptions import PollutionApiError


def _parse_waqi_result(result, fallback_location):
    """
    Turns a raw WAQI JSON response into AERIS's simple pollutant dict.
    Any pollutant WAQI doesn't report for this station comes back as None,
    never a made-up number.
    """
    if result.get("status") != "ok":
        raise PollutionApiError(f"Could not find live data for '{fallback_location}'")

    data = result.get("data", {})
    iaqi = data.get("iaqi", {})

    def get_value(key):
        item = iaqi.get(key)
        if item and "v" in item:
            return item["v"]
        return None

    city = data.get("city", {}) or {}
    geo = city.get("geo") or [None, None]

    return {
        "location": city.get("name", fallback_location),
        "aqi": data.get("aqi"),
        "pm25": get_value("pm25"),
        "pm10": get_value("pm10"),
        "coLevel": get_value("co"),
        "no2Level": get_value("no2"),
        "so2Level": get_value("so2"),
        "o3Level": get_value("o3"),
        "stationLatitude": geo[0] if len(geo) > 0 else None,
        "stationLongitude": geo[1] if len(geo) > 1 else None,
        "observedAt": data.get("time", {}).get("iso"),
        "source": "WAQI (aqicn.org)",
    }


async def get_live_pollution_data(location):
    """
    Calls the WAQI API for the given city/location name and returns
    the AQI and pollutant values as a simple dictionary.
    If a pollutant is not available for that location, it is returned
    as None instead of a made-up number.
    """
    if not settings.POLLUTION_API_KEY:
        raise PollutionApiError(
            "Live pollution API is not set up. Add POLLUTION_API_KEY in your .env file."
        )

    if not location or not location.strip():
        raise PollutionApiError("Please enter a location.")

    url = f"{settings.POLLUTION_API_BASE_URL}/feed/{location.strip()}/"

    try:
        async with httpx.AsyncClient(timeout=settings.POLLUTION_API_TIMEOUT_SECONDS) as client:
            response = await client.get(url, params={"token": settings.POLLUTION_API_KEY})
    except httpx.RequestError as e:
        raise PollutionApiError(f"Could not reach the live pollution API: {e}")

    if response.status_code != 200:
        raise PollutionApiError(f"Live pollution API error (status {response.status_code})")

    return _parse_waqi_result(response.json(), location)


async def get_live_pollution_by_coords(latitude, longitude):
    """
    Calls the WAQI API for the nearest available monitoring station to the
    given coordinates (WAQI's geo:lat;lon lookup). Works for any location
    worldwide - nothing here is tied to a specific city or station id.
    """
    if not settings.POLLUTION_API_KEY:
        raise PollutionApiError(
            "Live pollution API is not set up. Add POLLUTION_API_KEY in your .env file."
        )

    url = f"{settings.POLLUTION_API_BASE_URL}/feed/geo:{latitude};{longitude}/"

    try:
        async with httpx.AsyncClient(timeout=settings.POLLUTION_API_TIMEOUT_SECONDS) as client:
            response = await client.get(url, params={"token": settings.POLLUTION_API_KEY})
    except httpx.RequestError as e:
        raise PollutionApiError(f"Could not reach the live pollution API: {e}")

    if response.status_code != 200:
        raise PollutionApiError(f"Live pollution API error (status {response.status_code})")

    return _parse_waqi_result(response.json(), f"{latitude},{longitude}")