import os
import json
from datetime import datetime
from io import BytesIO
from flask import Flask, request, send_file, send_from_directory, jsonify
from flask_cors import CORS
from site_split_export import build_site_split_xlsx, SITE_SPLIT_MAP

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(ROOT, 'assets')
TEMPLATE_PATH = os.path.join(ASSETS_DIR, 'Site_Split.xlsx')

app = Flask(__name__, static_url_path='', static_folder=ROOT)

# Deployment note:
# Allow GitHub Pages origin (set GHPAGES_ORIGIN env for precise domain) plus local dev origins.
GHPAGES_ORIGIN = os.environ.get("GHPAGES_ORIGIN", "https://katpally123.github.io")
ALLOWED_ORIGINS = [
    GHPAGES_ORIGIN,
    "https://katpally123.github.io/attendance-dashboard-YHM2-PXT-Phoenix",
    "http://127.0.0.1:5500",
    "http://localhost:5500"
]
CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}}, supports_credentials=True)

@app.route('/')
def index():
    return send_from_directory(ROOT, 'index.html')

@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({"status": "ok", "template_exists": os.path.exists(TEMPLATE_PATH)})

@app.route('/api/download-template', methods=['POST'])
def download_template():
    data = request.get_json(silent=True) or {}
    if not os.path.exists(TEMPLATE_PATH):
        return {"error": f"Template not found at {TEMPLATE_PATH}"}, 404
    rows = data.get('rows', {})
    # Debug logging: print exact payload received
    try:
        print("PAYLOAD:", json.dumps(rows, indent=2, sort_keys=True))
    except Exception:
        # Fallback if payload contains non-serializable types
        print("PAYLOAD:", rows)

    # Simple diagnostics: verify provided keys against fixed map
    try:
        expected_keys = set(SITE_SPLIT_MAP.keys())
        provided_keys = set(rows.keys())
        unexpected = sorted(provided_keys - expected_keys)
        missing = sorted(k for k in expected_keys - provided_keys)
        if unexpected or missing:
            print("KEY CHECK:", {
                "unexpected_in_payload": unexpected,
                "missing_from_payload": missing
            })
        # Check department/role structure for provided rows
        for lbl in provided_keys & expected_keys:
            row_payload = rows.get(lbl) or {}
            dept_map = SITE_SPLIT_MAP[lbl]
            for dept, roles in dept_map.items():
                dp = row_payload.get(dept, {}) or {}
                for role in roles.keys():
                    if role not in dp:
                        print(f"STRUCT WARN: label='{lbl}' dept='{dept}' missing role '{role}'")
    except Exception as e:
        print("KEY CHECK ERROR:", e)
    shift = data.get('shift') or 'Day'
    date_str = data.get('date') or datetime.now().strftime('%Y-%m-%d')
    content = build_site_split_xlsx(TEMPLATE_PATH, rows, shift, date_str)
    return send_file(BytesIO(content),
                     as_attachment=True,
                     download_name=f"Attendance_report_{date_str}_{shift}.xlsx",
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

if __name__ == '__main__':
    # For Render/Fly/Railway etc use PORT env and 0.0.0.0 binding
    port = int(os.environ.get('PORT', 5000))
    host = '0.0.0.0'
    print(f"[server] Starting backend on http://{host}:{port} (CORS origins: {ALLOWED_ORIGINS})")
    app.run(host=host, port=port, debug=bool(os.environ.get('FLASK_DEBUG', '1') == '1'))
