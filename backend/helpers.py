# helpers.py
# Small helper function used by all routes to send back the same JSON shape:
# { success, message, data, timestamp }
# The frontend JavaScript reads response.data, so every route uses this.

from datetime import datetime
from pydantic import BaseModel


def _to_plain_data(data):
    """
    Converts Pydantic models (or lists of them) into plain dictionaries,
    using their camelCase field names (aliases) so the JSON matches what
    the frontend JavaScript expects.
    """
    if isinstance(data, BaseModel):
        return data.model_dump(by_alias=True)
    if isinstance(data, list):
        return [_to_plain_data(item) for item in data]
    return data


def success_response(data=None, message="Success"):
    return {
        "success": True,
        "message": message,
        "data": _to_plain_data(data),
        "timestamp": str(datetime.now()),
    }
