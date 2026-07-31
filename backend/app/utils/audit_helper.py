"""Audit trail data extraction helper."""
from typing import Any, Dict


def extract_diff(before: Dict[str, Any], after: Dict[str, Any]) -> Dict[str, Any]:
    """Compare before and after dictionaries to produce a minimal delta dict."""
    diff = {}
    for key, value in after.items():
        if key in before and before[key] != value:
            diff[key] = {"before": before[key], "after": value}
        elif key not in before:
            diff[key] = {"before": None, "after": value}
    return diff
