#!/usr/bin/env python3
"""
Clean up PGQueuer schema manually
"""

import asyncio
import asyncpg
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from shared.config import database_config
from db.python.dsn import normalize_postgres_dsn
from db.python.schema import pgqueuer_schema, quote_identifier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def cleanup_pgqueuer_schema():
    """Manually drop all pgqueuer related objects"""
    schema = pgqueuer_schema()
    logger.info("Cleaning up PGQueuer schema: %s", schema)

    try:
        connection = await asyncpg.connect(
            normalize_postgres_dsn(database_config.direct_url),
            statement_cache_size=0,
        )

        logger.info("Connected to database successfully")

        schema_sql = quote_identifier(schema)
        if schema == "public":
            cleanup_sql = f"""
            DROP TABLE IF EXISTS {schema_sql}.pgqueuer CASCADE;
            DROP TABLE IF EXISTS {schema_sql}.pgqueuer_log CASCADE;
            DROP TABLE IF EXISTS {schema_sql}.pgqueuer_statistics CASCADE;
            DROP TABLE IF EXISTS {schema_sql}.pgqueuer_schedules CASCADE;
            DROP TYPE IF EXISTS {schema_sql}.pgqueuer_status CASCADE;
            DROP TYPE IF EXISTS {schema_sql}.pgqueuer_statistics_status CASCADE;
            DROP FUNCTION IF EXISTS {schema_sql}.fn_pgqueuer_changed() CASCADE;
            """
        else:
            cleanup_sql = f"DROP SCHEMA IF EXISTS {schema_sql} CASCADE;"

        await connection.execute(cleanup_sql)
        logger.info("✅ PGQueuer schema cleaned up successfully")

        return True

    except Exception as e:
        logger.error(f"Failed to clean up pgqueuer schema: {e}")
        return False
    finally:
        if connection:
            await connection.close()
            logger.info("Database connection closed")


async def main():
    """Main function"""
    print("=== PGQueuer Schema Cleanup ===")
    print("This will remove all pgqueuer related objects from the database")
    print()

    success = await cleanup_pgqueuer_schema()

    if success:
        print("\n🎉 PGQueuer schema cleanup completed successfully!")
        print("You can now install the schema using the official pgqueuer CLI")
    else:
        print("\n❌ PGQueuer schema cleanup failed!")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️  Cleanup cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.exception("Critical failure during cleanup: %s", e)
        sys.exit(1)
