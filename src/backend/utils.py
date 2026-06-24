"""
Utility functions for BotTelegramRosa
Includes timezone handling, formatting, and common helpers
"""

from datetime import datetime
import pytz
from typing import Optional

# Madrid timezone
MADRID_TZ = pytz.timezone('Europe/Madrid')
UTC_TZ = pytz.UTC


def convert_to_madrid_time(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Convert a datetime object to Madrid timezone.
    
    Args:
        dt: datetime object (assumed UTC if naive)
    
    Returns:
        datetime object in Madrid timezone or None
    """
    if not dt:
        return None
    
    # If datetime is naive, assume it's UTC
    if dt.tzinfo is None:
        dt = UTC_TZ.localize(dt)
    else:
        # If it has timezone info, convert to UTC first then to Madrid
        dt = dt.astimezone(UTC_TZ)
    
    # Convert to Madrid timezone
    return dt.astimezone(MADRID_TZ)


def format_datetime_madrid(dt: Optional[datetime], format_str: str = "%d/%m/%y %H:%M") -> str:
    """
    Format a datetime in Madrid timezone.
    
    Args:
        dt: datetime object
        format_str: format string (default: "DD/MM/YY HH:MM")
    
    Returns:
        Formatted datetime string
    """
    if not dt:
        return "—"
    
    madrid_dt = convert_to_madrid_time(dt)
    if not madrid_dt:
        return "—"
    
    return madrid_dt.strftime(format_str)


def get_madrid_now() -> datetime:
    """
    Get current time in Madrid timezone.
    
    Returns:
        Current datetime in Madrid timezone (aware)
    """
    return datetime.now(MADRID_TZ)


def datetime_to_iso_madrid(dt: Optional[datetime]) -> Optional[str]:
    """
    Convert datetime to ISO format in Madrid timezone.
    
    Args:
        dt: datetime object
    
    Returns:
        ISO format string with Madrid timezone
    """
    if not dt:
        return None
    
    madrid_dt = convert_to_madrid_time(dt)
    if not madrid_dt:
        return None
    
    return madrid_dt.isoformat()
