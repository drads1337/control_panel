# Multi-stage Dockerfile for Panel Backend
# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

# Set build arguments
ARG BUILDPLATFORM
ARG TARGETPLATFORM

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install Python dependencies
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime image
FROM python:3.11-slim

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser -u 1000 appuser

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    gzip \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy application code
COPY backend/ /app/backend/
COPY --chown=appuser:appuser backend/ /app/backend/

# Download GeoIP database if not present (for production builds)
RUN if [ ! -f /app/backend/GeoLite2-City.mmdb ]; then \
    echo "Downloading GeoLite2-City database..." && \
    curl -L -o /tmp/GeoLite2-City.mmdb.gz https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz && \
    gunzip /tmp/GeoLite2-City.mmdb.gz && \
    mv /tmp/GeoLite2-City.mmdb /app/backend/GeoLite2-City.mmdb && \
    chown appuser:appuser /app/backend/GeoLite2-City.mmdb && \
    echo "GeoIP database downloaded successfully"; \
    fi

# Create necessary directories with proper permissions
RUN mkdir -p /app/uploads /app/backend/uploads && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5001

# Health check
# Use lightweight liveness probe that exists in the app
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5001/api/health/live || exit 1

# Default command (can be overridden in docker-compose)
CMD ["gunicorn", "-c", "backend/scripts/gunicorn.conf.py", "backend.scripts.wsgi:application"]