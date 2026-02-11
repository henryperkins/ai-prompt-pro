"""ASGI compatibility entrypoint.

Some deployment platforms default to `main:app` as the startup target.
This module re-exports the FastAPI app from `agent_service.main` so both
`main:app` and `agent_service.main:app` work.
"""

from agent_service.main import app

__all__ = ["app"]
