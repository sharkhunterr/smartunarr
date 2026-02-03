"""WebSocket endpoint for real-time updates."""

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import get_websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/jobs")
async def websocket_jobs_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for job progress updates.

    Clients connect to this endpoint to receive real-time updates about
    running jobs (programming generation, scoring analysis, etc.).

    Message types sent to clients:
    - jobs_state: Initial state with all current jobs
    - job_created: A new job was created
    - job_started: A job started running
    - job_progress: Job progress update (progress %, current step, score)
    - job_completed: Job completed successfully
    - job_failed: Job failed with error
    - job_cancelled: Job was cancelled

    Message types received from clients:
    - cancel_job: Request to cancel a job (payload: {jobId: string})
    - ping: Keep-alive ping (responds with pong)
    """
    manager = get_websocket_manager()

    await manager.connect(websocket)

    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif message_type == "cancel_job":
                job_id = data.get("jobId")
                if job_id:
                    success = await manager.cancel_job(job_id)
                    await websocket.send_json({
                        "type": "cancel_response",
                        "jobId": job_id,
                        "success": success,
                    })

            elif message_type == "get_jobs":
                # Client requesting current jobs state
                jobs = await manager.get_recent_jobs(20)
                await websocket.send_json({
                    "type": "jobs_state",
                    "jobs": [job.to_dict() for job in jobs],
                })

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await manager.disconnect(websocket)
