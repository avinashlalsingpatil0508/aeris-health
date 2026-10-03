# assistant_engine.py
# LAYER 2 of the AERIS Assistant: understands the user's question and turns
# already-computed environment/risk data into a natural-language reply.
#
# This file NEVER calculates a risk value itself. Every number it uses comes
# from the "context" dict built by routes_environment.py, which in turn gets
# its risk numbers from the EXISTING, unmodified risk_calculator.py. If a
# value is missing from context, the explainers say so - they never invent
# or estimate one.
#
# Two explanation backends share one interface (explain(intent, context,
# question) -> str):
#   - DeterministicExplainer: always available, template-based. This is
#     what runs when no AI provider is configured, and it's also the
#     fallback if the AI provider fails or looks like it invented a number.
#   - LLMExplainer: only used if ai_provider.get_configured_provider()
#     returns something. Only rephrases the same context - it is
#     instructed never to compute or restate a different risk value.

import re
import json

import risk_calculator as calc
import ai_provider

# A leading "Hey AERIS," / "Hi AERIS" / "Hello AERIS" is a greeting attached
# to a real question, not a greeting on its own - it's stripped so the rest
# of the question still gets matched normally against the intents below.
_GREETING_PREFIX_RE = re.compile(r"^\s*(hey|hi|hello)\s+aeris[,!]?\s*", re.IGNORECASE)

# A message that IS only a greeting (or empty after the prefix above is
# stripped) goes straight to GREETING_HELP. This is matched with word
# boundaries against the WHOLE message, not a plain substring check, because
# a naive `"hi" in question` would also match inside ordinary words such as
# "this" or "highest".
_BARE_GREETING_RE = re.compile(r"^\s*(hi|hey|hello)[\s!.,]*$", re.IGNORECASE)
_HELP_PHRASES = ["what can you do", "help me", "how do you work"]


# ── Intent detection ─────────────────────────────────────────────────────
# This is honest pattern/keyword matching, not true NLU: each intent has a
# set of trigger phrases (including common paraphrases), and the first
# intent (in priority order) whose phrase appears in the question wins.
# It reliably covers natural variations of the example questions in the
# product spec; a question far outside these patterns falls back to
# ENVIRONMENT_OVERVIEW, which still answers with real data rather than
# refusing outright.

INTENT_PRIORITY = [
    "RISK_REASON",
    "CHANGE_SINCE_LAST",
    "SAFETY_QUERY",
    "POLLUTANT_SPECIFIC",
    "HEALTH_IMPACTS",
    "RECOMMENDATIONS",
    "RISK_QUERY",
    "AQI_QUERY",
    "WEATHER_QUERY",
    "ENVIRONMENT_OVERVIEW",
]
# GREETING_HELP is handled separately in detect_intent() (see the regexes
# above it), not through the keyword loop - it needs whole-message matching,
# not substring matching, to avoid false positives like "hi" inside "this".

INTENT_KEYWORDS = {
    "RISK_REASON": [
        "why is my risk", "why is the risk", "causing my risk", "what's causing",
        "what is causing", "reason for my risk", "why high", "why is it high",
        "what's making", "what is making",
    ],
    "CHANGE_SINCE_LAST": [
        "changed since", "since my last", "compared to before", "compared to last",
        "different from last", "since last check", "since last time",
    ],
    "SAFETY_QUERY": [
        "safe to go outside", "go outside", "can i go", "can i exercise",
        "can i walk", "go for a walk", "go for a run", "should i stay in",
        "reduce outdoor exposure", "is it okay", "is it safe", "okay to go",
    ],
    "POLLUTANT_SPECIFIC": [
        "which pollutant", "highest pollutant", "worst pollutant", "pm2.5", "pm25",
        "pm10", " co ", "carbon monoxide", "no2", "nitrogen dioxide", "so2",
        "sulfur dioxide", "sulphur dioxide", "ozone", " o3",
    ],
    "HEALTH_IMPACTS": [
        "health effect", "health impact", "affect my health", "affect me",
        "organs", "symptoms",
    ],
    "RECOMMENDATIONS": [
        "what should i do", "what can i do", "advice", "recommend", "precaution",
        "protect myself", "protection",
    ],
    "RISK_QUERY": [
        "my risk", "health risk", "risk score", "risk percentage", "how risky",
        "explain my risk", "show my risk", "show my current health risk", "my score",
    ],
    "AQI_QUERY": [
        "aqi", "air quality", "is the air", "pollution level", "how polluted",
    ],
    "WEATHER_QUERY": [
        "weather", "temperature", "how hot", "how cold", "humidity", "wind",
        "raining", "rain today",
    ],
    "ENVIRONMENT_OVERVIEW": [
        "environment", "outside right now", "what's outside", "what is outside",
        "how is it outside", "current condition", "my condition", "my pollution",
        "tell me about", "explain my current",
    ],
}


def detect_intent(question):
    raw = (question or "").strip()
    if not raw or _BARE_GREETING_RE.match(raw):
        return "GREETING_HELP"

    # Drop a leading "Hey AERIS," style greeting so a question like
    # "Hey AERIS, what is my environment right now?" is matched on the
    # actual question, not treated as just a greeting.
    q = _GREETING_PREFIX_RE.sub("", raw).strip().lower()
    if not q:
        return "GREETING_HELP"
    if any(phrase in q for phrase in _HELP_PHRASES):
        return "GREETING_HELP"

    for intent in INTENT_PRIORITY:
        for phrase in INTENT_KEYWORDS[intent]:
            if phrase in q:
                return intent
    return "ENVIRONMENT_OVERVIEW"


# ── Shared helpers ────────────────────────────────────────────────────────

_POLLUTANT_LIMITS = {
    "pm25": ("PM2.5", calc.PM25_SAFE),
    "pm10": ("PM10", calc.PM10_SAFE),
    "coLevel": ("CO", calc.CO_SAFE),
    "no2Level": ("NO2", calc.NO2_SAFE),
    "so2Level": ("SO2", calc.SO2_SAFE),
}


def _dominant_pollutant(context):
    """
    Finds whichever tracked pollutant is furthest above its own safe limit
    (using the same limits risk_calculator.py already defines). Returns
    (label, value, ratio) or None if no pollutant readings are available.
    """
    best = None
    for key, (label, safe_limit) in _POLLUTANT_LIMITS.items():
        value = context.get(key)
        if value is None or safe_limit <= 0:
            continue
        ratio = value / safe_limit
        if best is None or ratio > best[2]:
            best = (label, value, ratio)
    return best


def _location_phrase(context):
    return context.get("location") or "your location"


# ── Deterministic explainer (always available) ───────────────────────────

class DeterministicExplainer:
    """
    Always-available explanation backend. Turns the already-computed
    environment/risk context into plain sentences. Every value it uses
    comes straight from the context dict it is given; any missing value is
    reported as unavailable rather than being skipped or defaulted to 0.
    """

    def explain(self, intent, context, question):
        handler = getattr(self, f"_handle_{intent.lower()}", self._handle_environment_overview)
        return handler(context)

    # -- shared sentence builders --

    def _weather_sentence(self, context):
        if not context.get("weatherAvailable"):
            return "Weather data is currently unavailable for your location."
        parts = []
        temp = context.get("temperature")
        feels = context.get("feelsLike")
        humidity = context.get("humidity")
        wind = context.get("windSpeed")
        condition = context.get("weatherCondition")
        if temp is not None:
            t = f"{temp}°C"
            if feels is not None and round(feels) != round(temp):
                t += f" (feels like {feels}°C)"
            parts.append(t)
        if condition:
            parts.append(condition.lower())
        if humidity is not None:
            parts.append(f"{humidity}% humidity")
        if wind is not None:
            parts.append(f"wind at {wind} km/h")
        if not parts:
            return "Weather data is currently unavailable for your location."
        return "Weather is currently " + ", ".join(parts) + "."

    def _aqi_sentence(self, context):
        if not context.get("aqiAvailable"):
            return "Live AQI data is currently unavailable for your location."
        aqi = context.get("aqi")
        category = context.get("aqiCategory")
        station = context.get("stationName")
        sentence = f"The AQI is {aqi}"
        if category:
            sentence += f", which is considered {category.lower()}"
        sentence += "."
        if station:
            sentence += f" (from the nearest available station: {station})"
        return sentence

    def _risk_sentence(self, context):
        if not context.get("riskAvailable"):
            return context.get("riskUnavailableReason") or "Your health risk could not be calculated right now."
        pct = context.get("riskPercentage")
        level = context.get("riskLevel")
        return f"Your estimated AERIS health risk is {pct}% ({level})."

    # -- one handler per intent --

    def _handle_environment_overview(self, context):
        sentences = [f"Here is the current environment for {_location_phrase(context)}."]
        sentences.append(self._aqi_sentence(context))
        sentences.append(self._weather_sentence(context))
        sentences.append(self._risk_sentence(context))
        if context.get("riskAvailable") and context.get("alertMessage"):
            sentences.append(context["alertMessage"])
        return " ".join(s for s in sentences if s)

    def _handle_aqi_query(self, context):
        return self._aqi_sentence(context)

    def _handle_weather_query(self, context):
        return self._weather_sentence(context)

    def _handle_risk_query(self, context):
        sentence = self._risk_sentence(context)
        if context.get("riskAvailable") and context.get("affectedOrgans") and context["affectedOrgans"] != "None":
            sentence += f" This may affect: {context['affectedOrgans']}."
        return sentence

    def _handle_risk_reason(self, context):
        if not context.get("riskAvailable"):
            return self._risk_sentence(context)
        pieces = [self._risk_sentence(context)]
        dominant = _dominant_pollutant(context)
        if dominant:
            label, value, _ratio = dominant
            pieces.append(
                f"The main contributor appears to be {label}, currently at {value}, "
                f"which is above its safe reference level."
            )
        elif context.get("aqi") is not None:
            pieces.append(f"This is mainly driven by the overall AQI of {context.get('aqi')}.")
        if context.get("personalFactorsNote"):
            pieces.append(context["personalFactorsNote"])
        return " ".join(p for p in pieces if p)

    def _handle_safety_query(self, context):
        if not context.get("riskAvailable"):
            if context.get("aqiAvailable"):
                category = (context.get("aqiCategory") or "").lower()
                return (
                    f"Based on the current AQI of {context.get('aqi')} ({category}), general guidance "
                    f"applies, but log in so AERIS can give you a personalised answer."
                )
            return "Live AQI data is currently unavailable, so AERIS can't say whether it's safe to go outside right now."
        advice = {
            "LOW": "Yes - conditions look fine for normal outdoor activity, including exercise.",
            "MODERATE": "Generally okay, but if you're sensitive, ease off on intense outdoor exercise.",
            "HIGH": "It's best to avoid strenuous outdoor activity right now and keep outdoor time short.",
            "CRITICAL": "No - avoid going outside if you can. Conditions are currently hazardous.",
        }.get(context.get("riskLevel"), "AERIS can't determine this without a current risk calculation.")
        return advice

    def _handle_health_impacts(self, context):
        if not context.get("riskAvailable"):
            return "Health impacts need both live AQI data and your saved health profile, and one of those is currently unavailable."
        impacts = context.get("healthImpacts") or []
        if not impacts:
            return "No significant health impacts are indicated at current levels."
        return "Possible health impacts right now: " + ", ".join(impacts) + "."

    def _handle_recommendations(self, context):
        if not context.get("riskAvailable"):
            return "Recommendations need both live AQI data and your saved health profile, and one of those is currently unavailable."
        recs = context.get("recommendations") or []
        if not recs:
            return "No specific recommendations are available right now."
        return "Here's what AERIS suggests right now: " + " ".join(recs[:4])

    def _handle_pollutant_specific(self, context):
        if not context.get("aqiAvailable"):
            return "Live pollutant data is currently unavailable for your location."
        dominant = _dominant_pollutant(context)
        sentence = (
            f"{dominant[0]} is currently the highest relative to its safe limit, at {dominant[1]}."
            if dominant else "Pollutant readings are unavailable for your location right now."
        )
        o3 = context.get("o3Level")
        if o3 is not None:
            sentence += f" Ozone (O3) is currently at {o3}."
        return sentence

    def _handle_change_since_last(self, context):
        previous = context.get("previousReport")
        if not previous:
            return "AERIS doesn't have a previous saved check for you to compare against yet."
        if not context.get("aqiAvailable") or not context.get("riskAvailable"):
            return "Live data is currently unavailable, so AERIS can't compare it to your last check."
        prev_aqi, prev_risk = previous.get("aqi"), previous.get("riskPercentage")
        curr_aqi, curr_risk = context.get("aqi"), context.get("riskPercentage")
        parts = []
        if prev_aqi is not None and curr_aqi is not None:
            delta = curr_aqi - prev_aqi
            direction = "higher" if delta > 0 else "lower" if delta < 0 else "about the same"
            parts.append(f"AQI is now {direction} than your last check ({prev_aqi} \u2192 {curr_aqi})")
        if prev_risk is not None and curr_risk is not None:
            delta = curr_risk - prev_risk
            direction = "higher" if delta > 0 else "lower" if delta < 0 else "about the same"
            parts.append(f"your risk is {direction} ({prev_risk}% \u2192 {curr_risk}%)")
        if not parts:
            return "AERIS doesn't have enough data to compare to your last check."
        return "Since your last check, " + " and ".join(parts) + "."

    def _handle_greeting_help(self, context):
        return (
            "Hi, I'm the AERIS Assistant. You can ask me things like: "
            "\"What's my environment right now?\", \"Is it safe to go outside?\", "
            "\"Why is my risk high?\", or \"What should I do right now?\" "
            "I only ever use your live, currently-fetched environment data - I never make numbers up."
        )


# ── Optional LLM explainer ────────────────────────────────────────────────

class LLMExplainer:
    """
    Rephrases the SAME context dict using a configured AI provider. Never
    asked to calculate anything - the system prompt explicitly forbids
    inventing numbers, and _guard_against_invented_risk() double-checks the
    reply against the actual computed risk percentage as a second layer of
    defense (not a substitute for the prompt instruction).
    """

    SYSTEM_PROMPT = (
        "You are the AERIS Assistant, an environmental-health guidance feature. "
        "You will be given a JSON object with already-computed environmental and "
        "health-risk data. Rules you must follow strictly:\n"
        "1. Only use the numeric values given in the JSON. Never invent, estimate, "
        "guess, or adjust any number.\n"
        "2. If a field is null, say plainly that it is unavailable - do not make up a value.\n"
        "3. Never calculate or restate a different risk percentage than the one given; "
        "if riskAvailable is false, say a personalised risk could not be calculated.\n"
        "4. Do not diagnose any medical condition. Use cautious language such as "
        "'may increase the risk' rather than definitive claims.\n"
        "5. Keep the answer concise (2-4 sentences) and in plain, friendly language.\n"
        "6. Answer only the user's question, using the relevant fields from the data."
    )

    def __init__(self, provider):
        self.provider = provider

    def explain(self, intent, context, question):
        user_prompt = (
            f"User question: {question}\n"
            f"Detected intent: {intent}\n"
            f"Environment and risk data (JSON):\n{json.dumps(context, default=str)}"
        )
        reply = self.provider.generate(self.SYSTEM_PROMPT, user_prompt)
        self._guard_against_invented_risk(reply, context)
        return reply

    def _guard_against_invented_risk(self, reply, context):
        if not context.get("riskAvailable"):
            return
        actual = context.get("riskPercentage")
        if actual is None:
            return
        for value in re.findall(r"(\d+(?:\.\d+)?)\s*%", reply):
            if abs(float(value) - actual) > 0.5:
                raise ValueError(
                    "AI response mentioned a risk percentage that does not match the calculated value"
                )


# ── Entry point used by routes_assistant.py ───────────────────────────────

def answer_question(question, context):
    """
    Detects the intent, then tries the configured AI provider (if any) and
    falls back to the deterministic explainer if no provider is configured
    or if the AI response fails/looks untrustworthy. Returns
    {"intent": ..., "reply": ...}.
    """
    intent = detect_intent(question)

    provider = ai_provider.get_configured_provider()
    if provider:
        try:
            reply = LLMExplainer(provider).explain(intent, context, question)
            return {"intent": intent, "reply": reply}
        except Exception:
            pass  # fall through to the deterministic explainer below

    reply = DeterministicExplainer().explain(intent, context, question)
    return {"intent": intent, "reply": reply}