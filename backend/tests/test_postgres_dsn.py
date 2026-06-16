import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from db.python.dsn import normalize_postgres_dsn


def test_normalize_postgres_dsn_removes_prisma_and_pooler_params():
    dsn = (
        "postgresql+asyncpg://user:pass@db.example.com:5432/app"
        "?schema=public&connection_limit=1&pgbouncer=true&pool_timeout=10"
        "&sslmode=require"
    )

    assert (
        normalize_postgres_dsn(dsn)
        == "postgresql://user:pass@db.example.com:5432/app?sslmode=require"
    )


def test_normalize_postgres_dsn_preserves_blank_supported_params():
    dsn = "postgresql://user:pass@db.example.com/app?application_name="

    assert (
        normalize_postgres_dsn(dsn)
        == "postgresql://user:pass@db.example.com/app?application_name="
    )
