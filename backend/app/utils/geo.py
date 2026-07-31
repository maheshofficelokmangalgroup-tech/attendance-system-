"""Geo utilities: GPS accuracy validation, geofencing, map URL builder, reverse geocoding."""
import math
import httpx
from typing import Optional

EARTH_RADIUS_METERS = 6_371_000.0

# Free, no-API-key reverse geocoding (OpenStreetMap Nominatim). Usage policy caps
# this at ~1 request/second and requires a descriptive User-Agent — fine for this
# app's check-in/check-out volume. See https://operations.osmfoundation.org/policies/nominatim/
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_HEADERS = {"User-Agent": "AttendHR-AttendanceApp/1.0"}


def validate_gps_accuracy(accuracy_meters: float, max_allowed_meters: float = 50.0) -> bool:
    """Returns True if GPS accuracy is within acceptable threshold (e.g. <= 50m)."""
    return accuracy_meters <= max_allowed_meters


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points, in meters."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_METERS * c


def validate_geofence(
    employee_lat: float,
    employee_lon: float,
    office_lat: Optional[float],
    office_lon: Optional[float],
    radius_meters: Optional[float],
) -> tuple[bool, Optional[float]]:
    """
    Validates that the employee's reported location is within `radius_meters`
    of the configured office location. If the office location isn't configured
    (radius/lat/lon is None), the geofence check is skipped (returns True, None) —
    only the raw device accuracy check applies in that case.
    """
    if office_lat is None or office_lon is None or radius_meters is None:
        return True, None

    distance = haversine_distance_meters(employee_lat, employee_lon, office_lat, office_lon)
    return distance <= radius_meters, distance


def build_google_maps_url(latitude: float, longitude: float) -> str:
    """
    Generates a plain Google Maps web URL for coordinates — this is just a
    link/embed URL (`google.com/maps?q=...`), not the paid Maps/Geocoding API,
    so it needs no API key and costs nothing to use.
    """
    return f"https://www.google.com/maps?q={latitude},{longitude}"


async def reverse_geocode_async(latitude: float, longitude: float) -> str:
    """Reverse geocodes coordinates to a human-readable address via Nominatim (free, no key)."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                NOMINATIM_URL,
                params={"lat": latitude, "lon": longitude, "format": "json"},
                headers=NOMINATIM_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                address = data.get("display_name")
                if address:
                    return address
    except Exception:
        pass  # Fallback on network/API error

    return f"Lat: {latitude:.6f}, Long: {longitude:.6f}"


def reverse_geocode_sync(latitude: float, longitude: float) -> str:
    """Synchronous reverse geocoding via Nominatim (free, no key)."""
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(
                NOMINATIM_URL,
                params={"lat": latitude, "lon": longitude, "format": "json"},
                headers=NOMINATIM_HEADERS,
            )
            if resp.status_code == 200:
                data = resp.json()
                address = data.get("display_name")
                if address:
                    return address
    except Exception:
        pass

    return f"Lat: {latitude:.6f}, Long: {longitude:.6f}"
