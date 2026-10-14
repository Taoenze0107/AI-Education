FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENABLE_LLM=false \
    DATABASE_PATH=/app/data/adaptive_tutor.db

WORKDIR /app

COPY pyproject.toml requirements.txt README.md ./
COPY app ./app
RUN pip install --no-cache-dir . \
    && useradd --create-home --uid 10001 tutor \
    && mkdir -p /app/data \
    && chown tutor:tutor /app/data

USER tutor
VOLUME ["/app/data"]
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
