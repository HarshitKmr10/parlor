FROM python:3.11-slim

WORKDIR /app

# Copy application code
COPY meeting-joiner/pyproject.toml meeting-joiner/poetry.lock* /app/
COPY meeting-joiner/src /app/src
COPY meeting-joiner/shared /app/shared
COPY meeting-joiner/workers /app/workers
COPY meeting-joiner/.env /app/.env

# Copy core module for Prisma
COPY core /core

# Install dependencies
# Pin Poetry to 1.x because the project still uses --no-root semantics and
# unpinned `pip install pgqueuer` in the fallback below resolves to 1.0.0
# which removed RetryWithBackoffEntrypointExecutor (renamed DatabaseRetryEntrypointExecutor).
RUN pip install --no-cache-dir "poetry>=1.8,<2.0" && \
    poetry config virtualenvs.create false && \
    poetry install --without=dev --no-interaction --no-ansi --no-root || \
    pip install --no-cache-dir \
        fastapi \
        uvicorn[standard] \
        asyncpg \
        pgqueuer==0.25.1 \
        pydantic \
        pydantic-settings \
        python-dotenv \
        httpx \
        azure-storage-blob \
        azure-identity \
        structlog \
        prisma \
        pyjwt

# Generate Prisma client from core module
RUN cd /core/core/db && prisma generate

# Set Python path
ENV PYTHONPATH=/app:$PYTHONPATH

# Expose port
EXPOSE 8000

# Run API
CMD ["python3", "-m", "src.main"]