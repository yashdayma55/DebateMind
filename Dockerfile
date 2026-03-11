# DebateMind Backend - production Docker image
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ ./backend/
COPY agents/ ./agents/
COPY debate_engine/ ./debate_engine/
COPY models/ ./models/

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 10000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "10000"]
