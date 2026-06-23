# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install the package + dependencies (declared in pyproject.toml).
COPY pyproject.toml ./
COPY app ./app
COPY config ./config
RUN pip install --no-cache-dir .

# SQLite + logs live here; mounted as a named volume in compose.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
