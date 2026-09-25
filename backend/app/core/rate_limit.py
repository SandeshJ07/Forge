import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status


class RateLimiter:
    """
    Per-client-IP sliding-window limiter, held in process memory. Good enough
    for a single uvicorn process; if this ever runs as several workers or
    instances, each keeps its own counts, so move this to Redis (or put a
    limit at the reverse proxy) at that point. Behind a proxy, make sure
    uvicorn runs with --proxy-headers so request.client is the real caller.
    """

    def __init__(self, name: str, max_requests: int, window_seconds: int):
        self.name = name
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def __call__(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            hits = self._hits[client_ip]
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.max_requests:
                retry_after = int(hits[0] + self.window_seconds - now) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait a bit and try again.",
                    headers={"Retry-After": str(retry_after)},
                )
            hits.append(now)
