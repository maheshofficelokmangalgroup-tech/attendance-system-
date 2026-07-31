"""
IST (India Standard Time, UTC+5:30) helpers.

The DB's DATETIME/TIME columns are naive (no tz info), so rather than
threading timezone-aware datetimes through SQLAlchemy, these helpers return
naive datetimes already shifted to IST wall-clock time. The host container
clock (Render, etc.) defaults to UTC — plain `datetime.now()` would silently
record check-in/check-out times ~5.5 hours off from actual local time.
"""
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    """Current wall-clock time in IST, as a naive datetime (no tzinfo)."""
    return datetime.now(timezone.utc).astimezone(IST).replace(tzinfo=None)


def today_ist() -> date:
    """Current calendar date in IST (avoids UTC's midnight rolling over early)."""
    return now_ist().date()
