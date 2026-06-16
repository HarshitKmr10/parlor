"""
Configuration management for the Meeting Joiner Service
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Service Configuration
    SERVICE_NAME: str = "meeting-joiner"
    HOST: str = "0.0.0.0"
    PORT: int = 3001
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Database Configuration
    DATABASE_URL: str
    DIRECT_URL: Optional[str] = None

    # Azure Bot Framework Configuration
    MICROSOFT_APP_ID: str = ""
    MICROSOFT_APP_PASSWORD: str = ""
    MICROSOFT_APP_TENANT_ID: str = ""

    # Azure Storage Configuration
    AZURE_STORAGE_CONNECTION_STRING: str = ""
    AZURE_STORAGE_CONTAINER_NAME: str = "meeting-recordings"

    # Core API Configuration
    CORE_API_URL: str = "http://localhost:3001"
    CORE_API_KEY: Optional[str] = None

    # Meeting Bot Configuration
    BOT_NAME: str = "AIOps Meeting Bot"
    MAX_MEETING_DURATION_HOURS: int = 8
    TRANSCRIPT_UPDATE_INTERVAL_MS: int = 5000
    MSTEAMS_TRANSCRIPT_SOURCE: Optional[str] = None

    # Google Meet Configuration
    GOOGLE_MEET_ENABLED: bool = True
    GOOGLE_MEET_ADMISSION_TIMEOUT_MS: int = 180000  # 2 minutes
    GOOGLE_MEET_ALONE_TIMEOUT_SECONDS: int = 180  # 3 minutes
    GOOGLE_MEET_EVERYONE_LEFT_TIMEOUT_SECONDS: int = 180  # 180 seconds

    # Queue Configuration (pgqueuer)
    QUEUE_CONCURRENCY: int = 5
    QUEUE_BATCH_SIZE: int = 10
    QUEUE_RETRY_ATTEMPTS: int = 3
    QUEUE_RETRY_DELAY: int = 60  # seconds

    # Security Configuration
    ALLOWED_ORIGINS: List[str] = ["*"]
    ALLOWED_HOSTS: List[str] = ["*"]

    # Worker Configuration
    WORKER_SCRIPT_PATH: str = "./worker/meeting_worker.py"
    JS_BOT_SCRIPT_PATH: str = "./bot_scripts"

    # File Storage
    TEMP_STORAGE_PATH: str = "/tmp/meeting-recordings"
    MAX_FILE_SIZE_MB: int = 500

    @validator("ALLOWED_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    @validator("ALLOWED_HOSTS", pre=True)
    def parse_allowed_hosts(cls, v):
        if isinstance(v, str):
            return [host.strip() for host in v.split(",")]
        return v

    @validator("DEBUG", pre=True)
    def parse_debug(cls, v):
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes", "on")
        return v

    @validator("DATABASE_URL")
    def validate_database_url(cls, v):
        if not v.startswith(("postgresql://", "postgres://")):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection string")
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"  # Allow extra environment variables


class DatabaseConfig:
    """Database configuration helper"""

    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def url(self) -> str:
        return self.settings.DATABASE_URL

    @property
    def direct_url(self) -> str:
        return self.settings.DIRECT_URL or self.settings.DATABASE_URL

    @property
    def pool_size(self) -> int:
        return 20  # Default pool size

    @property
    def max_overflow(self) -> int:
        return 30


class AzureConfig:
    """Azure services configuration helper"""

    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def bot_config(self) -> dict:
        return {
            "app_id": self.settings.MICROSOFT_APP_ID,
            "app_password": self.settings.MICROSOFT_APP_PASSWORD,
            "tenant_id": self.settings.MICROSOFT_APP_TENANT_ID,
        }

    @property
    def storage_config(self) -> dict:
        return {
            "connection_string": self.settings.AZURE_STORAGE_CONNECTION_STRING,
            "container_name": self.settings.AZURE_STORAGE_CONTAINER_NAME,
        }


class WorkerConfig:
    """Worker configuration helper"""

    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def concurrency(self) -> int:
        return self.settings.QUEUE_CONCURRENCY

    @property
    def batch_size(self) -> int:
        return self.settings.QUEUE_BATCH_SIZE

    @property
    def retry_config(self) -> dict:
        return {
            "max_attempts": self.settings.QUEUE_RETRY_ATTEMPTS,
            "delay": self.settings.QUEUE_RETRY_DELAY,
        }

    @property
    def script_paths(self) -> dict:
        return {
            "worker": self.settings.WORKER_SCRIPT_PATH,
            "js_bot": self.settings.JS_BOT_SCRIPT_PATH,
        }


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()

# Configuration helpers
database_config = DatabaseConfig(settings)
azure_config = AzureConfig(settings)
worker_config = WorkerConfig(settings)
