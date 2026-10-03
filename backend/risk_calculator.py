# risk_calculator.py
# This file has all the functions that calculate health risk from
# pollution data. This is the "brain" of the project.

# WHO / CPCB safe limits for each pollutant (used to check if a
# pollutant is above a safe level)
PM25_SAFE = 12.0
PM25_MODERATE = 35.4
PM25_POOR = 55.4

PM10_SAFE = 54.0
PM10_MODERATE = 154.0

CO_SAFE = 4.4
CO_MODERATE = 9.4

NO2_SAFE = 53.0
NO2_MODERATE = 100.0

SO2_SAFE = 35.0

# ---------------------------------------------------------------
# Breakpoint tables used by the risk score.
# Each table is a list of (concentration, AQI sub-index) pairs. They use the
# same limits as the *_SAFE / *_MODERATE constants above, so a pollutant that
# is only just above its safe limit scores low and one far above it scores high.
# ---------------------------------------------------------------
_PM25_BP = [(0, 0), (12.0, 50), (35.4, 100), (55.4, 150), (150.4, 200), (250.4, 300), (500.4, 500)]
_PM10_BP = [(0, 0), (54, 50), (154, 100), (254, 150), (354, 200), (424, 300), (604, 500)]
_CO_BP = [(0, 0), (4.4, 50), (9.4, 100), (12.4, 150), (15.4, 200), (30.4, 300), (50.4, 500)]
_NO2_BP = [(0, 0), (53, 50), (100, 100), (360, 150), (649, 200), (1249, 300), (2049, 500)]
_SO2_BP = [(0, 0), (35, 50), (75, 100), (185, 150), (304, 200), (604, 300), (1004, 500)]

# Converts an AQI-style value (0-500) into a health severity score (0-100).
# It rises faster than a straight line in the upper categories.
_SEVERITY_BP = [(0, 0), (50, 10), (100, 25), (150, 45), (200, 60), (300, 80), (500, 100)]


def _interpolate(value, table):
    """Piecewise-linear lookup of `value` in a list of (x, y) breakpoints."""
    if value <= table[0][0]:
        return float(table[0][1])
    for (x0, y0), (x1, y1) in zip(table, table[1:]):
        if value <= x1:
            return y0 + (value - x0) / (x1 - x0) * (y1 - y0)
    return float(table[-1][1])


def _num(value):
    """Safely turns None / bad input into a float (0.0 when missing)."""
    try:
        return float(value) if value is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def get_aqi_category(aqi):
    """Returns the AQI category code for a given AQI value."""
    if aqi <= 50:
        return "GOOD"
    elif aqi <= 100:
        return "MODERATE"
    elif aqi <= 150:
        return "UNHEALTHY_SENSITIVE"
    elif aqi <= 200:
        return "UNHEALTHY"
    elif aqi <= 300:
        return "VERY_UNHEALTHY"
    else:
        return "HAZARDOUS"


def get_aqi_label(aqi):
    """Returns a readable label for the AQI value (shown on screen)."""
    labels = {
        "GOOD": "Good",
        "MODERATE": "Moderate",
        "UNHEALTHY_SENSITIVE": "Unhealthy for Sensitive Groups",
        "UNHEALTHY": "Unhealthy",
        "VERY_UNHEALTHY": "Very Unhealthy",
        "HAZARDOUS": "Hazardous",
    }
    return labels[get_aqi_category(aqi)]


def calculate_risk_percentage(aqi, pm25, pm10, co_level, no2_level, so2_level,
                               age, health_condition, smoker, exposure_hours, exposure_level):
    """
    Works out a risk score from 0 to 100 using 3 parts:
    - 40% from the overall AQI value
    - 30% from the individual pollutant levels
    - 30% from the person's age, health, smoking and exposure
    """
    aqi = _num(aqi)
    pm25 = _num(pm25)
    pm10 = _num(pm10)
    co_level = _num(co_level)
    no2_level = _num(no2_level)
    so2_level = _num(so2_level)
    exposure_hours = _num(exposure_hours)

    # Part 1: AQI score (out of 100)
    aqi_score = _interpolate(aqi, _SEVERITY_BP)

    # Part 2: pollutant score (out of 100)
    # Each pollutant is scored against its own health limits. PM2.5 counts the
    # most because it is the most harmful. The final pollutant score blends the
    # weighted average with the single worst pollutant, so one very dangerous
    # gas (for example CO) is not hidden by the other pollutants being low.
    def pollutant_severity(value, table):
        return _interpolate(_interpolate(value, table), _SEVERITY_BP)

    weighted_scores = [
        (0.35, pollutant_severity(pm25, _PM25_BP)),
        (0.20, pollutant_severity(pm10, _PM10_BP)),
        (0.20, pollutant_severity(co_level, _CO_BP)),
        (0.15, pollutant_severity(no2_level, _NO2_BP)),
        (0.10, pollutant_severity(so2_level, _SO2_BP)),
    ]
    if any(v > 0 for v in (pm25, pm10, co_level, no2_level, so2_level)):
        weighted_average = sum(w * s for w, s in weighted_scores)
        worst_pollutant = max(s for _, s in weighted_scores)
        pollutant_score = (0.5 * weighted_average) + (0.5 * worst_pollutant)
    else:
        # No individual pollutant readings were given, so fall back to the AQI.
        pollutant_score = aqi_score

    # Part 3: personal risk score
    personal_score = 0
    if age is not None:
        if age < 5:
            personal_score += 35
        elif age < 12:
            personal_score += 25
        elif age < 18:
            personal_score += 15
        elif age <= 45:
            personal_score += 5
        elif age <= 60:
            personal_score += 15
        elif age <= 75:
            personal_score += 25
        else:
            personal_score += 35

    condition_points = {"ASTHMA": 20, "HEART_DISEASE": 20, "COPD": 25, "DIABETES": 10, "ALLERGIES": 15}
    if health_condition:
        personal_score += condition_points.get(health_condition.upper(), 0)

    if smoker:
        personal_score += 20

    # Long exposure matters: 12 or more hours gives the full 15 points.
    personal_score += min(max(exposure_hours, 0) / 12, 1) * 15

    level = (exposure_level or "").upper()
    if level == "HIGH":
        personal_score += 10
    elif level == "MEDIUM":
        personal_score += 5

    personal_score = min(personal_score, 100)

    # Final combined score
    final_score = (aqi_score * 0.40) + (pollutant_score * 0.30) + (personal_score * 0.30)
    return min(round(final_score, 1), 100)


def get_risk_level(risk_percentage):
    """Turns the risk percentage into a simple risk level."""
    if risk_percentage <= 25:
        return "LOW"
    elif risk_percentage <= 50:
        return "MODERATE"
    elif risk_percentage <= 75:
        return "HIGH"
    else:
        return "CRITICAL"


def predict_health_impacts(aqi, pm25, pm10, co_level, no2_level, so2_level, health_condition, smoker):
    """Returns a list of possible health effects based on current pollution levels."""
    impacts = []

    if pm25 > PM25_SAFE or pm10 > PM10_SAFE:
        impacts.append("Breathing Difficulty")
        impacts.append("Lung Irritation")
    if pm25 > PM25_MODERATE or pm10 > PM10_MODERATE:
        impacts.append("Reduced Lung Function")

    if co_level > CO_SAFE:
        impacts.append("Headache")
        impacts.append("Fatigue and Dizziness")
    if co_level > CO_MODERATE:
        impacts.append("Reduced Oxygen to Brain and Heart")

    if no2_level > NO2_SAFE:
        impacts.append("Eye Irritation")
        impacts.append("Throat Irritation")
    if no2_level > NO2_MODERATE:
        impacts.append("Inflammation of Airways")

    if so2_level > SO2_SAFE:
        impacts.append("Skin Irritation")
        impacts.append("Coughing and Wheezing")

    if aqi > 150:
        impacts.append("Asthma Risk Increased")
        impacts.append("Chest Tightness")
    if aqi > 200:
        impacts.append("Serious Cardiovascular Stress")
        impacts.append("Severe Respiratory Distress")
    if aqi > 300:
        impacts.append("Risk of Premature Death (Prolonged Exposure)")

    hc = (health_condition or "").upper()
    if hc == "ASTHMA" and aqi > 100:
        impacts.append("Asthma Attack Risk - High")
    if hc == "HEART_DISEASE" and aqi > 100:
        impacts.append("Cardiac Event Risk Elevated")
    if hc == "COPD" and aqi > 50:
        impacts.append("COPD Exacerbation Risk")
    if smoker and pm25 > PM25_SAFE:
        impacts.append("Smoking with high PM2.5 greatly increases lung cancer risk")

    if not impacts:
        impacts.append("No significant health impacts detected at current pollution levels")

    return impacts


def determine_affected_organs(aqi, pm25, pm10, co_level, no2_level, so2_level):
    """Returns a comma separated string of body parts that could be affected."""
    organs = []

    if pm25 > PM25_SAFE or pm10 > PM10_SAFE:
        organs.append("Lungs")
        organs.append("Respiratory Tract")
    if no2_level > NO2_SAFE or so2_level > SO2_SAFE:
        organs.append("Eyes")
    if no2_level > NO2_SAFE or pm10 > PM10_SAFE:
        organs.append("Throat")
    if so2_level > SO2_SAFE:
        organs.append("Skin")
    if co_level > CO_SAFE:
        organs.append("Brain")
        organs.append("Heart")
    if co_level > CO_MODERATE:
        organs.append("Blood")
    # "Serious Cardiovascular Stress" is listed as a health impact above AQI 200,
    # so the heart must also be listed as an affected organ.
    if aqi > 200 and "Heart" not in organs:
        organs.append("Heart")
    if aqi > 300 and "Kidneys" not in organs:
        organs.append("Kidneys")

    if not organs:
        return "None"
    return ", ".join(organs)


def is_vulnerable_person(age, health_condition):
    """A simple check used to decide how strong the alert message should be."""
    if age < 12 or age > 60:
        return True
    if health_condition and health_condition.upper() != "NORMAL":
        return True
    return False


def generate_alert_message(risk_level, health_condition, smoker, age):
    """Builds a short warning message shown to the user based on the risk level."""
    vulnerable = is_vulnerable_person(age, health_condition)
    msg = ""

    if risk_level == "LOW":
        msg = "Air quality is acceptable. Enjoy your day with normal activities."

    elif risk_level == "MODERATE":
        msg = "Moderate pollution detected. "
        msg += "As a sensitive individual, limit prolonged outdoor exertion." if vulnerable \
            else "Unusually sensitive people may experience minor discomfort."

    elif risk_level == "HIGH":
        msg = "HIGH POLLUTION ALERT! Air quality is unhealthy. Avoid outdoor activities."
        if vulnerable:
            msg += " Your health condition increases your risk - take extra precautions."
        if smoker:
            msg += " Smoking combined with current pollution levels is extremely dangerous."

    elif risk_level == "CRITICAL":
        msg = "CRITICAL HEALTH EMERGENCY! Air quality is severely hazardous. Do not go outside."
        if vulnerable:
            msg += " You are at critical health risk - seek medical attention if symptoms appear."
        if smoker:
            msg += " Stop smoking immediately - your lungs are at severe risk."

    return msg


def generate_recommendations(risk_level, pm25, co_level, health_condition, smoker, exposure_hours):
    """Builds a list of protection tips based on the risk level and personal factors."""
    tips = ["Stay hydrated - drink at least 8 glasses of water daily."]

    if risk_level == "LOW":
        tips.append("Air quality is good. Outdoor activities are safe.")
        tips.append("Eat fresh fruits and vegetables rich in antioxidants.")

    elif risk_level == "MODERATE":
        tips.append("Sensitive groups should wear a basic dust mask outdoors.")
        tips.append("Keep windows partially closed during peak traffic hours.")
        if exposure_hours > 4:
            tips.append("Reduce time spent outdoors - you have high exposure hours.")

    elif risk_level == "HIGH":
        tips.append("Wear an N95 mask if outdoor activity is unavoidable.")
        tips.append("Avoid all non-essential outdoor activities.")
        tips.append("Keep windows and doors closed and use an air purifier if available.")
        if pm25 > PM25_POOR:
            tips.append("PM2.5 levels are dangerous - double-mask if going outside.")
        if co_level > CO_MODERATE:
            tips.append("Carbon monoxide is elevated - ensure proper ventilation indoors.")

    elif risk_level == "CRITICAL":
        tips.append("Do not go outside under any circumstances.")
        tips.append("Run air purifiers continuously and seal door gaps.")
        tips.append("Seek immediate medical attention if you feel chest pain or breathlessness.")

    hc = (health_condition or "").upper()
    if hc == "ASTHMA" and risk_level != "LOW":
        tips.append("Keep your rescue inhaler easily accessible at all times.")
    if hc == "HEART_DISEASE" and risk_level != "LOW":
        tips.append("Monitor your blood pressure and heart rate regularly.")
    if hc == "COPD":
        tips.append("Use your prescribed bronchodilator as directed by your doctor.")
    if smoker and risk_level != "LOW":
        tips.append("Avoid smoking during high pollution periods.")

    return tips