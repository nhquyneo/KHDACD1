import sqlite3

DB_PATH = "cd1_projmgr.db"

SCHEMA_SQL = """
-- Bảng projects
CREATE TABLE IF NOT EXISTS projects (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  code_sale      TEXT,
  owner          TEXT,
  level          TEXT,
  current_status TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bảng project_phases
CREATE TABLE IF NOT EXISTS project_phases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL,
  phase_name  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'O',
  due_date    TEXT,
  actual_date TEXT,
  progress    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Xoá trigger cũ nếu tồn tại
DROP TRIGGER IF EXISTS trg_phases_after_insert;
DROP TRIGGER IF EXISTS trg_phases_after_update;
DROP TRIGGER IF EXISTS trg_phases_after_delete;

-- Trigger: INSERT phase
CREATE TRIGGER trg_phases_after_insert
AFTER INSERT ON project_phases
FOR EACH ROW
BEGIN
  UPDATE projects
  SET updated_at = datetime('now')
  WHERE id = NEW.project_id;
END;

-- Trigger: UPDATE phase
CREATE TRIGGER trg_phases_after_update
AFTER UPDATE ON project_phases
FOR EACH ROW
BEGIN
  UPDATE projects
  SET updated_at = datetime('now')
  WHERE id = NEW.project_id;
END;

-- Trigger: DELETE phase
CREATE TRIGGER trg_phases_after_delete
AFTER DELETE ON project_phases
FOR EACH ROW
BEGIN
  UPDATE projects
  SET updated_at = datetime('now')
  WHERE id = OLD.project_id;
END;
"""


def init_db():
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
        print(f"✅ Đã khởi tạo database SQLite: {DB_PATH}")
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
