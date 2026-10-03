# exceptions.py
# Simple custom errors used across the project, and handlers that turn
# them into a clean JSON error response like:
# { "status": 404, "error": "Not Found", "message": "..." }

from datetime import datetime
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class NotFoundError(Exception):
    def __init__(self, message):
        self.message = message


class DuplicateError(Exception):
    def __init__(self, message):
        self.message = message


class BadRequestError(Exception):
    def __init__(self, message):
        self.message = message


class PollutionApiError(Exception):
    def __init__(self, message):
        self.message = message


class WeatherApiError(Exception):
    def __init__(self, message):
        self.message = message


def error_body(status_code, error, message):
    return {
        "timestamp": str(datetime.now()),
        "status": status_code,
        "error": error,
        "message": message,
    }


def register_exception_handlers(app: FastAPI):

    @app.exception_handler(NotFoundError)
    async def handle_not_found(request: Request, exc: NotFoundError):
        return JSONResponse(status_code=404, content=error_body(404, "Not Found", exc.message))

    @app.exception_handler(DuplicateError)
    async def handle_duplicate(request: Request, exc: DuplicateError):
        return JSONResponse(status_code=409, content=error_body(409, "Conflict", exc.message))

    @app.exception_handler(BadRequestError)
    async def handle_bad_request(request: Request, exc: BadRequestError):
        return JSONResponse(status_code=400, content=error_body(400, "Bad Request", exc.message))

    @app.exception_handler(PollutionApiError)
    async def handle_pollution_api_error(request: Request, exc: PollutionApiError):
        return JSONResponse(status_code=503, content=error_body(503, "Service Unavailable", exc.message))

    @app.exception_handler(WeatherApiError)
    async def handle_weather_api_error(request: Request, exc: WeatherApiError):
        return JSONResponse(status_code=503, content=error_body(503, "Service Unavailable", exc.message))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        first_error = exc.errors()[0]["msg"] if exc.errors() else "Invalid request data"
        return JSONResponse(status_code=400, content=error_body(400, "Validation Failed", first_error))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content=error_body(500, "Internal Server Error", f"Something went wrong: {exc}"),
        )