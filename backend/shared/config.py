"""
Configuration management for the Meeting Joiner Service
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import validator
from pydantic_settings import BaseSettings, NoDecode
from typing_extensions import Annotated


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

    # Security Configuration.
    # NoDecode: pydantic-settings would otherwise JSON-parse these List[str]
    # fields from env, rejecting plain comma-separated strings like
    # "http://a,http://b". With NoDecode the raw string reaches the
    # parse_* validators below, which split on commas.
    ALLOWED_ORIGINS: Annotated[List[str], NoDecode] = ["*"]
    ALLOWED_HOSTS: Annotated[List[str], NoDecode] = ["*"]

    # ─── Product API layer (/api/v1) ──────────────────────────────────────
    # Runtime mode: "standalone" disables K8s warm-pool / sidecar machinery so
    # the app boots against a plain Postgres without a cluster. "compose" is an
    # accepted alias. Anything else assumes a K8s deployment.
    RUNTIME_MODE: str = "standalone"

    # JWT signing secret for product access/refresh tokens. MUST be overridden
    # in any non-local environment (read from env; never hardcode).
    JWT_SECRET: str = "dev-insecure-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_TTL_MINUTES: int = 30
    REFRESH_TOKEN_TTL_DAYS: int = 30

    # ai-service base URL for /summarize and /chat proxying.
    AI_SERVICE_URL: str = "http://localhost:8100"

    # ─── Standalone local bot dispatch (Round 2) ──────────────────────────
    # In RUNTIME_MODE=standalone there is no K8s warm pool, so a bot is run as
    # a local subprocess (mirroring the sidecar's bot_supervisor). Escape
    # hatch: "subprocess" spawns the bot locally; "disabled" skips spawning and
    # immediately marks the meeting failed with a clear exit_reason (useful for
    # CI / dev boxes with no browser).
    MEETING_BOT_MODE: str = "subprocess"

    # ─── Calendar integration (Round 2) ───────────────────────────────────
    # Fernet key (url-safe base64, 32 bytes) used to encrypt calendar OAuth
    # tokens at rest. If unset, the app generates an ephemeral key at boot and
    # logs a warning — fine for dev, MUST be set in production so tokens survive
    # restarts. Never hardcode a real key here.
    CALENDAR_TOKEN_KEY: Optional[str] = None

    # OAuth client credentials. Unset => the connect route returns 501
    # "calendar provider not configured" so dev still boots without creds.
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    MS_CLIENT_ID: Optional[str] = None
    MS_CLIENT_SECRET: Optional[str] = None
    # Public base URL the OAuth provider redirects back to (callback origin).
    CALENDAR_OAUTH_REDIRECT_BASE: str = "http://localhost:8000"

    # Calendar poller: auto-join meetings starting within this many minutes.
    CALENDAR_POLL_INTERVAL_S: int = 60
    CALENDAR_JOIN_LEAD_MINUTES: int = 5

    # ─── Outbound integration delivery (Round 2) ──────────────────────────
    # SMTP for the email recap provider. If host is unset, the email provider
    # logs the recap instead of sending (dev-friendly).
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "meetings@example.com"
    SMTP_USE_TLS: bool = True

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
