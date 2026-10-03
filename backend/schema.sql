-- AERIS Health database schema (MySQL)
-- Run this once to create the database and tables.
-- (The backend also creates missing tables automatically on startup,
--  so this file is optional - useful if you want to see the schema
--  or set up the database by hand.)

CREATE DATABASE IF NOT EXISTS pollution_db;
USE pollution_db;

CREATE TABLE recommendations (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	risk_level VARCHAR(20) NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	recommendation_text TEXT NOT NULL, 
	priority_order INTEGER NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(100) NOT NULL, 
	email VARCHAR(100) NOT NULL, 
	password VARCHAR(255) NOT NULL, 
	age INTEGER NOT NULL, 
	gender VARCHAR(10) NOT NULL, 
	health_condition VARCHAR(100) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE pollution_records (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	location VARCHAR(150) NOT NULL, 
	aqi FLOAT NOT NULL, 
	pm25 FLOAT NOT NULL, 
	pm10 FLOAT NOT NULL, 
	co_level FLOAT NOT NULL, 
	no2_level FLOAT NOT NULL, 
	so2_level FLOAT NOT NULL, 
	recorded_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE risk_reports (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER NOT NULL, 
	record_id INTEGER NOT NULL, 
	risk_percentage FLOAT NOT NULL, 
	risk_level VARCHAR(20) NOT NULL, 
	affected_organs VARCHAR(500) NOT NULL, 
	alert_message TEXT NOT NULL, 
	calculated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	UNIQUE (record_id), 
	FOREIGN KEY(record_id) REFERENCES pollution_records (id)
);

-- Extra indexes
ALTER TABLE users ADD UNIQUE INDEX ix_users_email (email);
ALTER TABLE pollution_records ADD INDEX ix_pollution_user_id (user_id);
ALTER TABLE risk_reports ADD INDEX ix_risk_user_id (user_id);
ALTER TABLE risk_reports ADD INDEX ix_risk_level (risk_level);
ALTER TABLE recommendations ADD INDEX ix_rec_risk_level (risk_level);