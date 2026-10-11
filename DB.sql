CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(255) UNIQUE NOT NULL,
  password varchar(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  completed boolean NOT NULL DEFAULT false,
  start_date date,
  due_date date,
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),
  recurrence varchar(16) NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  repeat_until date
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 2;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence varchar(16) NOT NULL DEFAULT 'none';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS repeat_until date;