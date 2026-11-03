import type { Migration } from './index'

// Conventions:
// - datetimes are ISO 8601 UTC strings ('2026-11-03T14:05:00.000Z')
// - PracticeSession.date is the *local* date as 'YYYY-MM-DD'
// - booleans/enums are TEXT with CHECK constraints
const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

export const initial: Migration = {
  version: 1,
  name: 'initial',
  up: `
    -- AUTOINCREMENT so ids are never reused: ExerciseLog keeps pointing at deleted ids
    CREATE TABLE Exercise (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT    NOT NULL CHECK (length(trim(name)) > 0),
      description       TEXT    NOT NULL DEFAULT '',
      bpm               INTEGER CHECK (bpm IS NULL OR bpm > 0),  -- default bpm; mid-session changes do NOT touch this
      allocated_seconds INTEGER NOT NULL CHECK (allocated_seconds > 0),
      created_at        TEXT    NOT NULL DEFAULT ${NOW},
      updated_at        TEXT    NOT NULL DEFAULT ${NOW}
    );

    CREATE TRIGGER Exercise_touch_updated_at
    AFTER UPDATE ON Exercise
    FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE Exercise SET updated_at = ${NOW} WHERE id = NEW.id;
    END;

    CREATE TABLE Day (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
      created_at TEXT NOT NULL DEFAULT ${NOW}
    );

    -- Rows sharing (day_id, position) are alternatives within one slot
    CREATE TABLE DayExercise (
      id          INTEGER PRIMARY KEY,
      day_id      INTEGER NOT NULL REFERENCES Day(id)      ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES Exercise(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL CHECK (position >= 0),
      UNIQUE (day_id, position, exercise_id)  -- same exercise can't be twice in one slot
    );
    CREATE INDEX DayExercise_exercise_id ON DayExercise(exercise_id);

    -- One row per weekday, seeded below. day_id NULL = rest day
    CREATE TABLE WeekSchedule (
      weekday TEXT PRIMARY KEY CHECK (weekday IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
      day_id  INTEGER REFERENCES Day(id) ON DELETE SET NULL
    ) WITHOUT ROWID;
    INSERT INTO WeekSchedule (weekday) VALUES ('mon'), ('tue'), ('wed'), ('thu'), ('fri'), ('sat'), ('sun');

    CREATE TABLE PracticeSession (
      id          INTEGER PRIMARY KEY,
      date        TEXT    NOT NULL,  -- local date when the session started
      day_id      INTEGER REFERENCES Day(id) ON DELETE SET NULL,
      day_name    TEXT    NOT NULL,  -- copied at start
      started_at  TEXT    NOT NULL DEFAULT ${NOW},
      finished_at TEXT
    );
    CREATE INDEX PracticeSession_date ON PracticeSession(date);

    CREATE TABLE ExerciseLog (
      id                INTEGER PRIMARY KEY,
      session_id        INTEGER NOT NULL REFERENCES PracticeSession(id) ON DELETE CASCADE,
      exercise_id       INTEGER NOT NULL,  -- intentionally NOT a foreign key; survives exercise deletion
      exercise_name     TEXT    NOT NULL,  -- copied at log time
      status            TEXT    NOT NULL CHECK (status IN ('completed', 'skipped')),
      bpm               INTEGER CHECK (bpm IS NULL OR bpm > 0),  -- what was actually played
      seconds_allocated INTEGER NOT NULL CHECK (seconds_allocated > 0),
      logged_at         TEXT    NOT NULL DEFAULT ${NOW}
    );
    CREATE INDEX ExerciseLog_session_id ON ExerciseLog(session_id);
    -- alternative rotation (least recently completed) + per-exercise graph
    CREATE INDEX ExerciseLog_exercise_status_logged ON ExerciseLog(exercise_id, status, logged_at);

    CREATE TABLE Setting (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
  `
}
