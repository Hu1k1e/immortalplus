"""
In-memory + disk cache for API responses.
Reduces API calls and improves response times.
"""

import json
import hashlib
import time
from pathlib import Path
from typing import Any, Optional
from cachetools import TTLCache

from config import DATA_DIR, CACHE_TTL_META, CACHE_TTL_MATCH, CACHE_TTL_PLAYER

# In-memory caches (fast, lost on restart)
_memory_caches: dict[str, TTLCache] = {
    "meta": TTLCache(maxsize=500, ttl=CACHE_TTL_META),
    "match": TTLCache(maxsize=1000, ttl=CACHE_TTL_MATCH),
    "player": TTLCache(maxsize=50, ttl=CACHE_TTL_PLAYER),
    "matchups": TTLCache(maxsize=200, ttl=CACHE_TTL_META),
    "general": TTLCache(maxsize=500, ttl=3600),
}

# Disk cache directory
DISK_CACHE_DIR = DATA_DIR / "cache"
DISK_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_key(prefix: str, *args) -> str:
    """Generate a deterministic cache key."""
    raw = f"{prefix}:" + ":".join(str(a) for a in args)
    return hashlib.md5(raw.encode()).hexdigest()


def get_cached(category: str, *key_parts) -> Optional[Any]:
    """
    Get a cached value. Checks memory first, then disk.
    Returns None if not found or expired.
    """
    key = _cache_key(category, *key_parts)

    # Check memory
    cache = _memory_caches.get(category, _memory_caches["general"])
    if key in cache:
        return cache[key]

    # Check disk
    disk_path = DISK_CACHE_DIR / f"{key}.json"
    if disk_path.exists():
        try:
            data = json.loads(disk_path.read_text(encoding="utf-8"))
            expires_at = data.get("_expires_at", 0)
            if time.time() < expires_at:
                value = data["value"]
                # Promote to memory cache
                cache[key] = value
                return value
            else:
                # Expired, clean up
                disk_path.unlink(missing_ok=True)
        except (json.JSONDecodeError, KeyError):
            disk_path.unlink(missing_ok=True)

    return None


def set_cached(category: str, *key_parts, value: Any, ttl: Optional[int] = None):
    """
    Cache a value in both memory and disk.
    TTL defaults based on category if not specified.
    """
    key = _cache_key(category, *key_parts)

    if ttl is None:
        ttl_map = {
            "meta": CACHE_TTL_META,
            "match": CACHE_TTL_MATCH,
            "player": CACHE_TTL_PLAYER,
            "matchups": CACHE_TTL_META,
        }
        ttl = ttl_map.get(category, 3600)

    # Memory cache
    cache = _memory_caches.get(category, _memory_caches["general"])
    cache[key] = value

    # Disk cache
    disk_path = DISK_CACHE_DIR / f"{key}.json"
    try:
        disk_data = {
            "value": value,
            "_expires_at": time.time() + ttl,
            "_category": category,
            "_key_parts": list(key_parts),
        }
        disk_path.write_text(json.dumps(disk_data, default=str), encoding="utf-8")
    except (TypeError, OSError) as e:
        # Non-serializable data or disk error — memory cache still works
        print(f"[cache] Disk cache write failed for {category}: {e}")


def invalidate(category: str, *key_parts):
    """Remove a specific cached value."""
    key = _cache_key(category, *key_parts)
    cache = _memory_caches.get(category, _memory_caches["general"])
    cache.pop(key, None)
    disk_path = DISK_CACHE_DIR / f"{key}.json"
    disk_path.unlink(missing_ok=True)


def clear_category(category: str):
    """Clear all cached values in a category."""
    cache = _memory_caches.get(category, _memory_caches["general"])
    cache.clear()


def clear_all():
    """Clear all caches."""
    for cache in _memory_caches.values():
        cache.clear()
    for f in DISK_CACHE_DIR.glob("*.json"):
        f.unlink(missing_ok=True)
