# Cloud Run Job image for the ephemeral-demo reset task. Not built or
# deployed anywhere yet — see ../README.md.
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY reset_demo.py .

ENTRYPOINT ["python", "reset_demo.py"]
