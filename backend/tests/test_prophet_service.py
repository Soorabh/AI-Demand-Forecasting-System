import asyncio

import numpy as np
import pandas as pd
import pytest

from models.schemas import ForecastRequest
from services.prophet_service import ProphetService, display_names, horizon_to_days


def make_request(**overrides):
    params = dict(
        industry="retail",
        country="US",
        freq="M",
        horizon=3,
        date_col="date",
        target_col="sales",
        apply_holidays=False,
        apply_ai_adjustment=False,
    )
    params.update(overrides)
    return ForecastRequest(**params)


def monthly_csv(months=36):
    dates = pd.date_range("2021-01-01", periods=months, freq="MS")
    sales = 1000 + np.arange(months) * 10 + 100 * np.sin(np.arange(months) / 12 * 2 * np.pi)
    return pd.DataFrame({"date": dates, "sales": sales}).to_csv(index=False).encode()


def test_horizon_to_days_depends_on_frequency():
    assert horizon_to_days("D", 10) == 10
    assert horizon_to_days("W", 4) == 28
    assert horizon_to_days("M", 2) == 62


def test_display_names_resolves_iso_codes():
    country, state = display_names("IN", "IN-MH")
    assert country == "India"
    assert state == "Mahārāshtra"  # pycountry's ISO 3166-2 spelling
    # Unknown values are passed through unchanged.
    assert display_names("Atlantis", None) == ("Atlantis", None)


def test_validation_rejects_too_little_data():
    svc = ProphetService()
    df = svc.read_file(monthly_csv(months=6), "sales.csv")
    with pytest.raises(ValueError, match="Insufficient data"):
        svc.validate_and_process_data(df, make_request())


def test_validation_drops_bad_rows_and_aggregates():
    svc = ProphetService()
    df = svc.read_file(monthly_csv(months=24), "sales.csv")
    df.loc[0, "date"] = "not a date"
    df.loc[1, "sales"] = "n/a"
    clean, meta = svc.validate_and_process_data(df, make_request())
    assert meta.null_dates == 1
    assert meta.null_targets == 1
    assert len(clean) == 22


def test_yoy_uses_four_period_average():
    svc = ProphetService()
    # 12 months at 100, then 4 months at 150 => last 4 vs same 4 a year earlier = +50%
    y = [100.0] * 12 + [150.0] * 4
    df = pd.DataFrame({"ds": pd.date_range("2022-01-01", periods=16, freq="MS"), "y": y})
    summary = svc._get_recent_summary(df, "M")
    assert summary.yoy_last_period_pct == pytest.approx(50.0)


def test_end_to_end_forecast_without_ai():
    svc = ProphetService()
    result = asyncio.run(svc.generate_forecast(monthly_csv(), "sales.csv", make_request()))
    assert len(result.forecast_base) == 3
    assert len(result.forecast_final) == 3
    # Without AI adjustment, final == base, and base rows don't carry yhat_final.
    for base, final in zip(result.forecast_base, result.forecast_final):
        assert final.yhat_final == base.yhat
        assert base.yhat_final is None
