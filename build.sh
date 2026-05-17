#!/usr/bin/env bash
# Render build script for the single-service deployment.
# Steps:
#   1. Install Python deps.
#   2. Install Node + build the React frontend into frontend/dist/.
#   3. Collect Django static files (whitenoise serves them in prod).
#   4. Run Django migrations.

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

echo "==> Build complete"
