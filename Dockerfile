# FoodSave — single-image deployment (Render, Hugging Face Spaces, Cloud Run, Fly.io)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

WORKDIR /app

COPY hybrid_app/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY hybrid_app/ ./

EXPOSE 7860

# Seed on first boot only; safe to re-run because inserts are idempotent.
CMD ["sh", "-c", "python scripts/seed_db.py || true; gunicorn app:app --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 120"]
