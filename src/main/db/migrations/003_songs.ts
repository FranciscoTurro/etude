import type { Migration } from './index'

const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`

// Songs are exercises with kind = 'song'. They have no allocated time, which needs
// three columns to become nullable, and SQLite can only do that by rebuilding tables:
// - Exercise.allocated_seconds: NULL for songs (and only songs)
// - DayExercise.exercise_id: NULL marks a "Song" slot, filled with every song when the day loads
// - ExerciseLog.seconds_allocated: for songs, the seconds actually played (NULL if unknown)
// Runs with foreign keys off: dropping Exercise would otherwise cascade into DayExercise.
export const songs: Migration = {
  version: 3,
  name: 'songs',
  foreignKeysOff: true,
  up: (db) => {
    // Rebuilding drops Exercise's AUTOINCREMENT counter; keep it so deleted ids are never reused.
    const seq = db
      .prepare("SELECT seq FROM sqlite_sequence WHERE name = 'Exercise'")
      .pluck()
      .get() as number | undefined

    db.exec(`
      CREATE TABLE Exercise_new (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        kind              TEXT    NOT NULL DEFAULT 'exercise' CHECK (kind IN ('exercise', 'song')),
        name              TEXT    NOT NULL CHECK (length(trim(name)) > 0),
        description       TEXT    NOT NULL DEFAULT '',
        bpm               INTEGER CHECK (bpm IS NULL OR bpm > 0),
        allocated_seconds INTEGER CHECK (allocated_seconds IS NULL OR allocated_seconds > 0),
        created_at        TEXT    NOT NULL DEFAULT ${NOW},
        updated_at        TEXT    NOT NULL DEFAULT ${NOW},
        CHECK ((kind = 'song') = (allocated_seconds IS NULL))  -- songs are untimed, exercises aren't
      );
      INSERT INTO Exercise_new (id, name, description, bpm, allocated_seconds, created_at, updated_at)
        SELECT id, name, description, bpm, allocated_seconds, created_at, updated_at FROM Exercise;
      DROP TABLE Exercise;
      ALTER TABLE Exercise_new RENAME TO Exercise;

      CREATE TRIGGER Exercise_touch_updated_at
      AFTER UPDATE ON Exercise
      FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
      BEGIN
        UPDATE Exercise SET updated_at = ${NOW} WHERE id = NEW.id;
      END;

      CREATE TABLE DayExercise_new (
        id          INTEGER PRIMARY KEY,
        day_id      INTEGER NOT NULL REFERENCES Day(id)      ON DELETE CASCADE,
        exercise_id INTEGER          REFERENCES Exercise(id) ON DELETE CASCADE,  -- NULL = Song slot
        position    INTEGER NOT NULL CHECK (position >= 0),
        UNIQUE (day_id, position, exercise_id)
      );
      INSERT INTO DayExercise_new (id, day_id, exercise_id, position)
        SELECT id, day_id, exercise_id, position FROM DayExercise;
      DROP TABLE DayExercise;
      ALTER TABLE DayExercise_new RENAME TO DayExercise;
      CREATE INDEX DayExercise_exercise_id ON DayExercise(exercise_id);

      CREATE TABLE ExerciseLog_new (
        id                INTEGER PRIMARY KEY,
        session_id        INTEGER NOT NULL REFERENCES PracticeSession(id) ON DELETE CASCADE,
        exercise_id       INTEGER NOT NULL,  -- intentionally NOT a foreign key; survives exercise deletion
        exercise_name     TEXT    NOT NULL,
        status            TEXT    NOT NULL CHECK (status IN ('completed', 'skipped')),
        bpm               INTEGER CHECK (bpm IS NULL OR bpm > 0),
        seconds_allocated INTEGER CHECK (seconds_allocated IS NULL OR seconds_allocated > 0),
        logged_at         TEXT    NOT NULL DEFAULT ${NOW}
      );
      INSERT INTO ExerciseLog_new
        SELECT id, session_id, exercise_id, exercise_name, status, bpm, seconds_allocated, logged_at
        FROM ExerciseLog;
      DROP TABLE ExerciseLog;
      ALTER TABLE ExerciseLog_new RENAME TO ExerciseLog;
      CREATE INDEX ExerciseLog_session_id ON ExerciseLog(session_id);
      CREATE INDEX ExerciseLog_exercise_status_logged ON ExerciseLog(exercise_id, status, logged_at);
    `)

    if (seq !== undefined) {
      db.prepare("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'Exercise'").run(seq)
      db.prepare(
        "INSERT INTO sqlite_sequence (name, seq) SELECT 'Exercise', ? WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = 'Exercise')"
      ).run(seq)
    }
  }
}
