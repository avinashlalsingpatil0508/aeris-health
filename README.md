# AERIS Health
### AI-Based Pollution and Emission Health Risk & Protection System

A web app that checks live air quality for a location, works out a personal
health risk score based on your age/health condition/exposure, and gives
protection advice.

## 1. Technologies Used

- Frontend: HTML5, CSS3, Vanilla JavaScript, Chart.js, Font Awesome
- Backend: Python, FastAPI, Uvicorn, SQLAlchemy, PyMySQL
- Database: MySQL
- Live pollution data: WAQI (World Air Quality Index) API

## 2. Project Structure

```
backend/
    main.py              -> starts the FastAPI app
    config.py             -> reads settings from .env
    database.py             -> connects to MySQL
    models.py                 -> database tables (User, PollutionRecord, RiskReport, Recommendation)
    schemas.py                  -> request/response data shapes
    security.py                  -> password hashing
    risk_calculator.py            -> health risk calculation logic
    pollution_api.py                -> live AQI data (WAQI)
    helpers.py                        -> small response helper
    exceptions.py                      -> error handling
    routes_users.py / routes_pollution.py / routes_risk.py / routes_recommendations.py
    schema.sql, requirements.txt, .env.example

frontend/
    index.html            -> main website (landing page + app pages)
    css/app.css             -> all styling
    js/api.js, app.js, pages.js  -> all frontend logic
    admin/                          -> separate admin portal
    assets/images/                   -> put aeris-background.jpg here
```

## 3. Database Setup

1. Install MySQL and make sure it is running.
2. Create the database:
   ```sql
   CREATE DATABASE pollution_db;
   ```
3. The backend will create the tables automatically the first time it runs.
   (Or run `backend/schema.sql` yourself if you prefer.)

## 4. Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in your values:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=pollution_db
DB_USER=root
DB_PASSWORD=your_mysql_password

POLLUTION_API_KEY=your_waqi_token
```

Get a free WAQI token here: https://aqicn.org/data-platform/token/
(the app still works without it, just the "Fetch Live Data" button won't.)

## 5. Backend Installation & Run

```bash
cd backend
python -m venv venv
venv\Scripts\activate        (Windows)
source venv/bin/activate     (Mac/Linux)

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at: http://127.0.0.1:8000
Swagger API docs: http://127.0.0.1:8000/docs

## 6. Frontend Run

```bash
cd frontend
python -m http.server 5500
```

Open: http://127.0.0.1:5500/index.html
Admin portal: http://127.0.0.1:5500/admin/admin.html

## 7. Basic Project Flow

Landing Page -> Get Started -> Register -> Login -> Dashboard ->
Submit Pollution Data (or Fetch Live Data) -> Risk Analysis Result ->
Protection Advice -> History -> City Monitor -> Logout

## 8. Notes

- Passwords are hashed (bcrypt), never stored as plain text.
- The background image path `frontend/assets/images/aeris-background.jpg`
  is wired up in the CSS, but the actual image file is not included -
  add your own photo there (the page still looks fine without it).
- The Admin Portal (`frontend/admin/`) was kept as-is and was not
  restyled in this pass - it still works, just with its own look.
