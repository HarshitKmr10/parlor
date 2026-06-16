# Transcriber-worker — Phase 2 of the resilient streaming pipeline.
#
# Stateless gRPC service that owns the streaming-diarization session
# lifecycle. meeting-worker pods fan audio frames in; transcript events
# come back. See ../proto/transcriber/v1/transcriber.proto.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for grpcio + audio libraries used by adapter ports.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        build-essential \
        libsndfile1 \
        ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Generate gRPC stubs. The proto file is shared across services so we
# copy it from the repo's monorepo proto/ tree at build time.
COPY proto /app/proto
RUN mkdir -p /app/transcriber/v1 \
 && python -m grpc_tools.protoc \
        -I /app/proto \
        --python_out=/app \
        --grpc_python_out=/app \
        /app/proto/transcriber/v1/transcriber.proto \
 && touch /app/transcriber/__init__.py /app/transcriber/v1/__init__.py

COPY services/transcriber-worker /app/

EXPOSE 50051
CMD ["python", "-u", "main.py"]
