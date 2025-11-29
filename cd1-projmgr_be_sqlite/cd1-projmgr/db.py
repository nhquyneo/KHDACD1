import sqlite3
from datetime import datetime, timedelta

DB_PATH = "cd1_projmgr.db"


def get_connection():
    """
    Kết nối SQLite, trả về conn + row_factory dict-like.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def fetch_all_projects():
    """
    Lấy danh sách toàn bộ project + phases.
    updatedAt = giá trị updated_at từ bảng projects (trigger đã cập nhật).
    """
    conn = get_connection()
    cur = conn.cursor()

    # Lấy thông tin project
    cur.execute("""
        SELECT id, name, code_sale, owner, level, current_status, updated_at
        FROM projects
        ORDER BY id
    """)
    project_rows = cur.fetchall()

    # Lấy phases
    cur.execute("""
        SELECT id, project_id, phase_name, status, due_date, actual_date, progress
        FROM project_phases
        ORDER BY project_id, id
    """)
    phase_rows = cur.fetchall()

    conn.close()

    # Gom phases theo project_id
    phases_by_project = {}
    for ph in phase_rows:
        pid = ph["project_id"]
        phases_by_project.setdefault(pid, []).append(
            {
                "id": ph["id"],
                "name": ph["phase_name"],
                "status": ph["status"],
                "dueDate": ph["due_date"],
                "actualDate": ph["actual_date"],
                "progress": ph["progress"],
            }
        )

    # Build danh sách projects
    projects = []
    for p in project_rows:
        updated_raw = p["updated_at"]  # dạng "YYYY-MM-DD HH:MM:SS"

        # Chuyển sang ISO để FE parse tốt với new Date()
        if updated_raw:
            try:
                dt = datetime.strptime(updated_raw, "%Y-%m-%d %H:%M:%S") + timedelta(hours=7)
                updated_iso = dt.isoformat()
            except:
                updated_iso = updated_raw
        else:
            updated_iso = None

        projects.append(
            {
                "id": p["id"],
                "name": p["name"],
                "codeSale": p["code_sale"],
                "owner": p["owner"],
                "level": p["level"],
                "currentStatus": p["current_status"],
                "updatedAt": updated_iso,
                "phases": phases_by_project.get(p["id"], []),
            }
        )

    return projects
