from datetime import datetime

from services.holidays_service import HolidaysService


def test_country_code_accepts_iso_and_names():
    svc = HolidaysService()
    assert svc.get_country_code("US") == "US"
    assert svc.get_country_code("india") == "IN"
    assert svc.get_country_code("Narnia") is None


def test_normalize_state_strips_iso_prefix():
    assert HolidaysService._normalize_state("US", "US-CA") == "CA"
    assert HolidaysService._normalize_state("IN", "in-mh") == "mh"
    assert HolidaysService._normalize_state("IN", "Maharashtra") == "Maharashtra"
    assert HolidaysService._normalize_state("US", None) is None


def test_iso_state_code_from_frontend_returns_holidays():
    # The frontend sends pycountry subdivision codes such as "US-CA".
    svc = HolidaysService()
    df = svc.get_holidays_dataframe("US", "US-CA", datetime(2024, 1, 1), datetime(2024, 12, 31))
    assert not df.empty
    assert "Christmas Day" in set(df["holiday"])


def test_unknown_state_falls_back_to_national_holidays():
    svc = HolidaysService()
    df = svc.get_holidays_dataframe("US", "US-ZZ", datetime(2024, 1, 1), datetime(2024, 12, 31))
    assert not df.empty


def test_upcoming_holidays_window_is_in_days():
    svc = HolidaysService()
    # A 1-day window can't contain more than one day's worth of holidays.
    assert len(svc.get_upcoming_holidays("US", None, days_ahead=1)) <= 2
