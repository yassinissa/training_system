#!/usr/bin/env bash
# Render build script for the single-service deployment.
# Steps:
#   1. Install Python deps.
#   2. Install Node + build the React frontend into frontend/dist/.
#   3. Collect Django static files (whitenoise serves them in prod).
#   4. Run Django migrations.
#   5. (Optional) Bootstrap an admin user when ADMIN_USERNAME / ADMIN_PASSWORD
#      env vars are set. Idempotent: safe to run on every deploy.

set -o errexit
set -o nounset
set -o pipefail

echo "==> Installing Python dependencies"
pip install --upgrade pip
pip install -r requirements.txt

echo "==> Building React frontend"
cd frontend
npm ci --no-audit --no-fund
npm run build
cd ..

echo "==> Collecting Django static files"
python manage.py collectstatic --no-input

echo "==> Running migrations"
python manage.py migrate --no-input

# Bootstrap / reset the admin account. Skipped automatically if the
# ADMIN_USERNAME or ADMIN_PASSWORD env vars are not set. Set both in the
# Render dashboard (Environment tab) to enable.
if [ "${ADMIN_USERNAME:-}" != "" ] && [ "${ADMIN_PASSWORD:-}" != "" ]; then
  echo "==> Ensuring admin account '$ADMIN_USERNAME' exists with role=ADMIN"
  python manage.py shell -c "
from accounts.models import User
import os
username = os.environ['ADMIN_USERNAME']
password = os.environ['ADMIN_PASSWORD']
email    = os.environ.get('ADMIN_EMAIL', f'{username}@example.com')
user, created = User.objects.get_or_create(username=username, defaults={'email': email})
user.email = email
user.role = 'ADMIN'
user.is_staff = True
user.is_superuser = True
user.is_active = True
user.set_password(password)
user.save()
print('   - created' if created else '   - updated', '->', user.username, '(role=ADMIN)')
"
else
  echo "==> Admin bootstrap skipped (set ADMIN_USERNAME + ADMIN_PASSWORD env vars to enable)"
fi

echo "==> Build complete"
