# Training System API

This README documents the key endpoints for the training module, including auth, training modules, exams, questions, choices, and exam sessions. All endpoints are prefixed under `http://127.0.0.1:8000/api/`.

## Authentication
- POST auth/login/
  - Body: `{ "username": "admin1", "password": "adminpass" }` or `{ "employee_number": "E001", "password": "empPass" }`
  - Returns: `{ access, refresh, role, employee_number, position, branch|manager_branches }`
  - Use `Authorization: Bearer <access>` for subsequent requests

## Training Modules
- GET training/modules/ — List modules (admin/manager)
- POST training/modules/ — Create module (admin/manager)
- GET training/my-modules/ — Employee’s visible modules

Example POST training/modules/ (admin/manager):
```json
{
  "title": "Safety Basics",
  "description": "Intro to safety",
  "content": "Text content",
  "external_link": "https://example.com",
  "positions": ["waiter", "chef"],
  "branch": "Main"
}
```

## Exams
- GET training/exams/ — List exams (admin/manager)
- POST training/exams/ — Create exam (admin/manager)

Example POST training/exams/:
```json
{
  "title": "Waiter Basics",
  "description": "Intro",
  "position": "waiter",
  "time_limit_seconds": 600,
  "is_active": true
}
```

## Questions
- POST training/questions/ — Create question for an exam (admin/manager)
- GET training/exams/<int:exam_id>/questions/ — List questions (with choices) for an exam (authenticated)

Example POST training/questions/:
```json
{
  "exam": 2,
  "text": "Carry plates?",
  "type": "MCQ_SINGLE",
  "order": 1
}
```

## Choices
- POST training/choices/ — Create a choice for a question (admin/manager)

Example POST training/choices/:
```json
{
  "question": 1,
  "text": "Yes",
  "is_correct": true
}
```

## Exam Sessions
- POST training/exam-sessions/start/ — Start an exam session (employee/manager)
  - Body: `{ "exam": 2 }`
  - Returns: `{ id, exam, status, started_at }`

- POST training/exam-sessions/submit/ — Submit an exam session (employee)
  - Body:
```json
{
  "session_id": 10,
  "answers": [
    { "question": 1, "selected_choices": [1] },
    { "question": 2, "text_answer": "My answer" }
  ]
}
```
  - Returns: `{ message, session_status, score_so_far }`

## Permissions Summary
- Modules: Admin/Manager can list/create; Employees use `my-modules`.
- Exams: Admin/Manager can list/create.
- Questions/Choices: Admin/Manager can create; managers restricted to their exams.
- Exam Sessions: Employees (and managers) can start; only the session owner can submit.

## Quick PowerShell Smoke Test
```powershell
# Login as employee
$body = @{ employee_number = "E001"; password = "empPass" } | ConvertTo-Json
$resp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/auth/login/" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$token = ($resp.Content | ConvertFrom-Json).access

# List questions for known exam id
$examId = 2
Invoke-WebRequest -Uri ("http://127.0.0.1:8000/api/training/exams/{0}/questions/" -f $examId) -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing

# Start session
$startBody = @{ exam = $examId } | ConvertTo-Json
$startResp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/training/exam-sessions/start/" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body $startBody -ContentType "application/json" -UseBasicParsing
$sessionId = ($startResp.Content | ConvertFrom-Json).id

# Submit answers
$answers = @(
  @{ question = 1; selected_choices = @(1) }
) | ConvertTo-Json
$submitBody = "{\"session_id\": $sessionId, \"answers\": $answers}"
Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/training/exam-sessions/submit/" -Method POST -Headers @{ Authorization = "Bearer $token" } -Body $submitBody -ContentType "application/json" -UseBasicParsing
```

## Notes
- Ensure `DEBUG=True` during development.
- Images require Pillow (installed).
- Branch names in payloads should exist; consider making branch names unique.

## Frontend (React)

A modern React frontend is scaffolded under `frontend/` using Vite. It provides:
- Login (admin via username, managers/employees via employee number)
- Role-aware Dashboard using `api/training/dashboard/summary/`

### Dev Setup

```powershell
cd frontend
npm install
npm run dev
```

Backend dev server:
```powershell
C:\Users\yassi\OneDrive\Desktop\training_system\venv\Scripts\python.exe manage.py runserver
```

Vite is configured to proxy `/api` and `/media` to `http://127.0.0.1:8000`, so API calls work out-of-the-box.

### Build for Production

```powershell
cd frontend
npm run build
```

This produces `frontend/dist/`. You can serve it via any static host. Optionally, add a Django view/static config to serve the built SPA and route unknown paths to `index.html`.
