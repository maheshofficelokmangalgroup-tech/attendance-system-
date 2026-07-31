-- MySQL init script — runs only on first container start
-- Ensures proper charset/collation from day one

CREATE DATABASE IF NOT EXISTS attendance_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
