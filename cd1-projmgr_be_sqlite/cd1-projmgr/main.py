from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import json

from db import get_connection, fetch_all_projects

app = Flask(__name__)
CORS(app)


# ======================= GET ALL PROJECTS =======================
@app.route("/api/projects", methods=["GET"])
def api_get_projects():
    try:
        projects = fetch_all_projects()
        return jsonify(projects)
    except Exception as e:
        print("DB error:", e)
        return jsonify({"error": "DB error"}), 500


# ======================= CREATE PROJECT =======================
@app.route("/api/projects", methods=["POST"])
def api_create_project():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    current_status = data.get("currentStatus") or ""

    conn = get_connection()
    try:
        cur = conn.cursor()

        # Insert project
        cur.execute("""
            INSERT INTO projects (name, code_sale, owner, level, current_status)
            VALUES (?, ?, ?, ?, ?)
        """, (
            data.get("name"),
            data.get("codeSale"),
            data.get("owner"),
            data.get("level"),
            current_status,
        ))

        project_id = cur.lastrowid

        # Insert phases
        for ph in data.get("phases", []):
            cur.execute("""
                INSERT INTO project_phases
                (project_id, phase_name, status, due_date, actual_date, progress)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                project_id,
                ph.get("name"),
                ph.get("status", "O"),
                ph.get("dueDate"),
                ph.get("actualDate"),
                ph.get("progress", 0),
            ))

        conn.commit()
        return jsonify({"message": "created", "id": project_id}), 201

    except Exception as e:
        conn.rollback()
        print("Create project error:", e)
        return jsonify({"error": "create failed", "detail": str(e)}), 500

    finally:
        conn.close()


# ======================= UPDATE PROJECT =======================
@app.route("/api/projects/<int:project_id>", methods=["PUT"])
def api_update_project(project_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    current_status = data.get("currentStatus") or ""

    conn = get_connection()
    try:
        cur = conn.cursor()

        # Kiểm tra tồn tại
        cur.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
        if not cur.fetchone():
            return jsonify({"error": "project not found"}), 404

        # Update project
        cur.execute("""
            UPDATE projects
            SET name = ?, code_sale = ?, owner = ?, level = ?, current_status = ?, updated_at = datetime('now')
            WHERE id = ?
        """, (
            data.get("name"),
            data.get("codeSale"),
            data.get("owner"),
            data.get("level"),
            current_status,
            project_id,
        ))

        # Xoá phases cũ
        cur.execute("DELETE FROM project_phases WHERE project_id = ?", (project_id,))

        # Insert phases mới
        for ph in data.get("phases", []):
            cur.execute("""
                INSERT INTO project_phases
                (project_id, phase_name, status, due_date, actual_date, progress)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                project_id,
                ph.get("name"),
                ph.get("status", "O"),
                ph.get("dueDate"),
                ph.get("actualDate"),
                ph.get("progress", 0),
            ))

        conn.commit()
        return jsonify({"message": "updated"})

    except Exception as e:
        conn.rollback()
        print("Update project error:", e)
        return jsonify({"error": "update failed", "detail": str(e)}), 500

    finally:
        conn.close()


# ======================= DELETE PROJECT =======================
@app.route("/api/projects/<int:project_id>", methods=["DELETE"])
def api_delete_project(project_id):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        affected = cur.rowcount
        conn.commit()

        if affected == 0:
            return jsonify({"error": "project not found"}), 404

        return jsonify({"message": "deleted"})

    except Exception as e:
        conn.rollback()
        print("Delete project error:", e)
        return jsonify({"error": "delete failed", "detail": str(e)}), 500

    finally:
        conn.close()


# ======================= EXPORT PROJECTS =======================
@app.route("/api/projects/export", methods=["GET"])
def api_export_projects():
    try:
        projects = fetch_all_projects()
        json_str = json.dumps({"projects": projects}, ensure_ascii=False, indent=2)

        return Response(
            json_str,
            mimetype="application/json",
            headers={
                "Content-Disposition": "attachment; filename=projects_export.json"
            },
        )
    except Exception as e:
        print("Export error:", e)
        return jsonify({"error": "export failed", "detail": str(e)}), 500


# ======================= RUN SERVER =======================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5005, debug=True)
