#!/usr/bin/env python3
"""
Development utility script for Meeting Joiner Service
Run common development tasks with: python scripts/dev.py [command]
"""

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Optional


def run_command(cmd: str, description: Optional[str] = None):
    """Run a shell command"""
    if description:
        print(f"🔧 {description}")
    print(f"Running: {cmd}")
    result = subprocess.run(cmd.split(), cwd=Path(__file__).parent.parent)
    if result.returncode != 0:
        print(f"❌ Command failed with exit code {result.returncode}")
        sys.exit(1)
    print("✅ Command completed successfully\n")


def install():
    """Install all dependencies"""
    run_command("poetry install", "Installing all dependencies")


def format_code():
    """Format code with black and isort"""
    run_command("poetry run black .", "Formatting code with black")
    run_command("poetry run isort .", "Sorting imports with isort")


def lint():
    """Run linting checks"""
    run_command("poetry run flake8 .", "Running flake8 linting")


def test():
    """Run tests"""
    run_command("poetry run pytest tests/", "Running tests")


def test_coverage():
    """Run tests with coverage"""
    run_command("poetry run pytest tests/ --cov=.", "Running tests with coverage")


def dev_server():
    """Start development server"""
    run_command(
        "poetry run python -m uvicorn main:app --reload --port 3001",
        "Starting development server",
    )


def worker():
    """Start worker process"""
    run_command("poetry run python worker/meeting_worker.py", "Starting worker")


def check():
    """Run all checks (format, lint, test)"""
    format_code()
    lint()
    test()


def clean():
    """Clean up generated files"""
    import shutil

    paths_to_clean = [
        "__pycache__",
        ".pytest_cache",
        "dist",
        "build",
        "*.egg-info",
    ]

    for pattern in paths_to_clean:
        for path in Path(".").rglob(pattern):
            if path.is_dir():
                print(f"Removing directory: {path}")
                shutil.rmtree(path)
            elif path.is_file():
                print(f"Removing file: {path}")
                path.unlink()


def main():
    parser = argparse.ArgumentParser(
        description="Development utility for Meeting Joiner Service"
    )
    parser.add_argument(
        "command",
        choices=[
            "install",
            "format",
            "lint",
            "test",
            "test-coverage",
            "dev",
            "worker",
            "check",
            "clean",
        ],
        help="Command to run",
    )

    args = parser.parse_args()

    commands = {
        "install": install,
        "format": format_code,
        "lint": lint,
        "test": test,
        "test-coverage": test_coverage,
        "dev": dev_server,
        "worker": worker,
        "check": check,
        "clean": clean,
    }

    commands[args.command]()


if __name__ == "__main__":
    main()
