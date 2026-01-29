"""Channels API routes."""

from fastapi import APIRouter

router = APIRouter(prefix="/channels")


@router.get("")
async def list_channels() -> dict[str, str]:
    """List all channels from Tunarr."""
    # TODO: Implement in T041
    return {"status": "not_implemented"}


@router.get("/{channel_id}")
async def get_channel(channel_id: str) -> dict[str, str]:
    """Get a channel with current programming."""
    # TODO: Implement in T042
    return {"status": "not_implemented"}


@router.post("/{channel_id}/sync")
async def sync_channel(channel_id: str) -> dict[str, str]:
    """Sync a channel's programming."""
    # TODO: Implement in T043
    return {"status": "not_implemented"}
