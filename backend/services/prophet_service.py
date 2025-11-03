import io
import logging
import math
import tempfile
import asyncio
import sys
import os
from datetime import datetime, timedelta
from typing import Tuple, Optional, List, Any, Dict

import numpy as np
import pandas as pd
from prophet import Prophet
from services.prophet_utils import suppress_stdout_stderr, prepare_prophet_data, get_prophet_config

# Optional encoding detector
try:
    import chardet  # type: ignore
except Exception:
    chardet = None  # fallback - will try common encodings

from services.holidays_service import HolidaysService  # keep interface expected
from services.perplexity_client import PerplexityClient  # keep interface expected
from models.schemas import (
    ForecastRequest, ForecastResponse, ForecastMeta, DataPoint,
    AIAdjustmentRequest, RecentSummary
)

logger = logging.getLogger(__name__)

# --- Constants & limits ---
MAX_UPLOAD_BYTES = 10 * 1024 * 1024        # 10 MB
CSV_CHUNK_SIZE = 100_000                   # rows per chunk when streaming
MIN_PERIODS_REQUIRED = 12
SAFE_ADJUSTMENT_PCT_MIN = -20.0            # do not allow less than -20%
SAFE_ADJUSTMENT_PCT_MAX = 20.0            # cap at +20%
HORIZON_LIMITS = {'D': 365, 'W': 156, 'M': 60}  # safe caps
ALLOWED_FREQS = {'D', 'W', 'M'}

# --- Custom Exceptions ---
class ForecastServiceError(Exception):
    """Base exception for forecast service (internal)."""

class UserInputError(ForecastServiceError):
    """Raised for user-caused problems (bad file, bad request)."""

class SystemError(ForecastServiceError):
    """Raised for internal issues (model training failure, IO failure)."""

# --- Helper utilities ---
def _safe_log_exception(msg: str, exc: Exception) -> None:
    # Avoid logging user file contents or long byte strings - keep messages short
    logger.exception(f"{msg}: {type(exc).__name__} - {str(exc)[:200]}")

def _clamp(v: float, mn: float, mx: float) -> float:
    return max(mn, min(mx, v))

def _get_date_offset(freq: str, periods: int) -> pd.DateOffset:
    if freq == 'D':
        return pd.DateOffset(days=periods)
    if freq == 'W':
        return pd.DateOffset(weeks=periods)
    if freq == 'M':
        return pd.DateOffset(months=periods)
    # fallback - days
    return pd.DateOffset(days=periods)

def _sanitize_numeric_str(x: Any) -> Optional[float]:
    """
    Robust sanitizer for numeric values:
    - Handles thousands separators (commas), currency symbols, parentheses for negatives.
    - Removes letters and stray characters, keeps first decimal point.
    - Returns np.nan if unparsable.
    """
    try:
        if x is None:
            return np.nan
        if isinstance(x, (float, int, np.floating, np.integer)):
            val = float(x)
            return val if math.isfinite(val) else np.nan

        s = str(x).strip()
        if s == "":
            return np.nan

        # Parentheses denote negative in some exports: (1,234) -> -1234
        if s.startswith("(") and s.endswith(")"):
            s = "-" + s[1:-1]

        # Remove currency symbols, letters, spaces; keep digits, dots and minus
        import re
        s = re.sub(r"[^\d\.\-]", "", s)

        # If multiple dots exist, keep the first as decimal separator
        if s.count(".") > 1:
            parts = s.split(".")
            s = parts[0] + "." + "".join(parts[1:])

        # lone '-' or '' are invalid
        if s in ("", "-"):
            return np.nan

        val = float(s)
        if math.isfinite(val):
            return val
        return np.nan
    except Exception:
        return np.nan

# --- Service Implementation ---
class ProphetService:
    """
    Production-ready Prophet forecasting service.
    - Dependencies (holidays_service, ai_client) are injected for testability.
    - Heavy operations are offloaded to thread pool to remain async-friendly.
    - Automatically clamps AI adjustments and (by default) clips negative historical values to 0
      to avoid negative forecasts for non-negative metrics like sales/counts.
    """

    def __init__(self,
                 holidays_service: Optional[HolidaysService] = None,
                 ai_client: Optional[PerplexityClient] = None,
                 max_upload_bytes: int = MAX_UPLOAD_BYTES,
                 auto_clip_negative_history: bool = True):
        self.holidays_service = holidays_service or HolidaysService()
        self.ai_client = ai_client or PerplexityClient()
        self.max_upload_bytes = max_upload_bytes
        # If True, we automatically clip negative historical `y` to 0 (safe default for counts/sales)
        self.auto_clip_negative_history = auto_clip_negative_history

    # -------------------------
    # File reading & validation
    # -------------------------
    def _detect_encoding(self, content: bytes) -> Optional[str]:
        if chardet:
            try:
                guess = chardet.detect(content[:4096])
                encoding = guess.get('encoding')
                logger.debug(f"chardet guess: {guess}")
                return encoding
            except Exception:
                return None
        return None

    def _ensure_safe_file_size(self, file_content: bytes) -> None:
        size = len(file_content)
        if size > self.max_upload_bytes:
            raise UserInputError(f"File exceeds maximum allowed size of {self.max_upload_bytes} bytes")

    async def read_file(self, file_content: bytes, filename: str) -> pd.DataFrame:
        """
        Async-friendly wrapper that delegates to a blocking function via to_thread.
        Performs file size check and safe read (chunked CSV or data_only Excel).
        """
        # synchronous heavy-lifting moved to thread
        return await asyncio.to_thread(self._read_file_sync, file_content, filename)

    def _read_file_sync(self, file_content: bytes, filename: str) -> pd.DataFrame:
        """Blocking implementation used inside a thread."""
        try:
            self._ensure_safe_file_size(file_content)

            name = filename.lower()
            if name.endswith('.csv'):
                # Try encoding detection first
                encoding = self._detect_encoding(file_content) or 'utf-8'
                # Use BytesIO and pandas read_csv with iterator to avoid large memory spikes
                stream = io.BytesIO(file_content)
                # Try to read small chunk first to validate columns
                try:
                    pd.read_csv(stream, encoding=encoding, nrows=5)
                except Exception:
                    # fallback encodings
                    found = False
                    for enc in ('utf-8', 'latin-1', 'cp1252'):
                        try:
                            stream.seek(0)
                            pd.read_csv(stream, encoding=enc, nrows=5)
                            encoding = enc
                            found = True
                            break
                        except Exception:
                            continue
                    if not found:
                        raise UserInputError("Could not parse CSV file - invalid encoding or format")

                # Full read with chunks
                stream.seek(0)
                it = pd.read_csv(stream, encoding=encoding, iterator=True, chunksize=CSV_CHUNK_SIZE)
                chunks = []
                for chunk in it:
                    chunks.append(chunk)
                df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
                logger.info(f"CSV loaded: {len(df)} rows with encoding {encoding}")
                return df

            elif name.endswith(('.xlsx', '.xls')):
                # Write bytes to temp file and use engine that does not evaluate macros
                with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=True) as tmp:
                    tmp.write(file_content)
                    tmp.flush()
                    # use openpyxl / xlrd depending on file; set data_only=True to avoid formula evaluation
                    try:
                        df = pd.read_excel(tmp.name, engine='openpyxl', dtype=object, keep_default_na=True)
                    except Exception:
                        # fallback to default engine
                        df = pd.read_excel(tmp.name, dtype=object, keep_default_na=True)
                logger.info(f"Excel loaded: {len(df)} rows")
                return df

            else:
                raise UserInputError("Unsupported file type. Allowed: .csv, .xlsx, .xls")

        except UserInputError:
            raise  # re-raise user errors
        except Exception as e:
            _safe_log_exception("Error reading uploaded file", e)
            raise SystemError("Failed to read uploaded file") from e

    # -------------------------
    # Data validation & cleanup
    # -------------------------
    def validate_and_process_data(self, df: pd.DataFrame, request: ForecastRequest) -> Tuple[pd.DataFrame, ForecastMeta, Dict[str, Any]]:
        """
        Validate input DataFrame and process to a Prophet-friendly form:
        - expects date_col and target_col to exist
        - converts date & numeric types safely
        - aggregates to requested freq
        - returns processed df with columns ['ds', 'y'], metadata, and a data_quality dict
        """
        try:
            if request.freq not in ALLOWED_FREQS:
                raise UserInputError(f"Unsupported freq '{request.freq}'. Allowed: {sorted(ALLOWED_FREQS)}")

            if request.horizon is None or request.horizon < 1:
                raise UserInputError("Horizon must be a positive integer")

            # Cap horizon by freq
            max_h = HORIZON_LIMITS.get(request.freq, HORIZON_LIMITS['D'])
            if request.horizon > max_h:
                raise UserInputError(f"Horizon too large for freq '{request.freq}'. Max allowed: {max_h}")

            original_rows = len(df)
            if not isinstance(df, pd.DataFrame):
                raise UserInputError("Uploaded content is not a valid tabular file")

            if request.date_col not in df.columns:
                raise UserInputError(f"Date column '{request.date_col}' not found")
            if request.target_col not in df.columns:
                raise UserInputError(f"Target column '{request.target_col}' not found")

            # Work on a copy of necessary columns
            work = df[[request.date_col, request.target_col]].copy()
            work.columns = ['ds', 'y']

            # Parse ds column carefully:
            # 1) Try pandas generic parser (preserves all existing accepted formats)
            parsed = pd.to_datetime(work['ds'], errors='coerce', dayfirst=False)

            # 2) For any failures, explicitly try DD-MM-YYYY and DD-MM-YY (user-requested)
            mask = parsed.isna()
            if mask.any():
                fallback1 = pd.to_datetime(work.loc[mask, 'ds'], format='%d-%m-%Y', errors='coerce')
                fallback2 = pd.to_datetime(work.loc[mask, 'ds'], format='%d-%m-%y', errors='coerce')
                parsed.loc[mask] = fallback1.fillna(fallback2)

            work['ds'] = parsed
            null_dates = int(work['ds'].isnull().sum())
            if null_dates > 0:
                logger.warning(f"Dropping {null_dates} rows with invalid dates")
            work = work[work['ds'].notna()].reset_index(drop=True)

            # normalize datetimes to midnight and remove tzinfo so Prophet receives timezone-naive Timestamps
            if pd.api.types.is_datetime64_any_dtype(work['ds']):
                work['ds'] = work['ds'].dt.normalize()
            try:
                work['ds'] = work['ds'].dt.tz_localize(None)
            except Exception:
                # ignore if already tz-naive or operation unsupported
                pass

            # Convert target to numeric safely using robust sanitizer
            work['y'] = work['y'].apply(_sanitize_numeric_str)
            null_targets = int(work['y'].isnull().sum())
            if null_targets > 0:
                logger.warning(f"Dropping {null_targets} rows with non-numeric target")
            work = work[work['y'].notnull()]

            # --- NEW: Aggregate duplicate dates by summing target values ---
            work = work.groupby('ds', as_index=False).agg({'y': 'sum'})

            if len(work) == 0:
                raise UserInputError("No valid rows after parsing dates and numeric targets")

            # Sort and aggregate to freq
            work = work.sort_values('ds').reset_index(drop=True)
            work = self._aggregate_to_frequency(work, request.freq)

            processed_rows = len(work)
            if processed_rows < MIN_PERIODS_REQUIRED:
                raise UserInputError(f"Insufficient data: need at least {MIN_PERIODS_REQUIRED} periods after aggregation, got {processed_rows}")

            # Data quality checks
            neg_count = int((work['y'] < 0).sum())
            pos_count = int((work['y'] > 0).sum())
            zero_count = int((work['y'] == 0).sum())

            # If auto clipping enabled, clip negative history to zero (for metrics that cannot be negative).
            clipped_negatives = 0
            if neg_count > 0 and self.auto_clip_negative_history:
                clipped_negatives = int((work['y'] < 0).sum())
                work.loc[work['y'] < 0, 'y'] = 0.0
                logger.warning(f"Clipped {clipped_negatives} negative historical values to 0 (auto_clip_negative_history=True)")

            # Basic outlier clipping option (simple winsorization) - keep within reasonable bounds
            try:
                y_q1, y_q3 = np.percentile(work['y'], [5, 95])
                work['y'] = work['y'].clip(lower=y_q1 - 3 * (y_q3 - y_q1), upper=y_q3 + 3 * (y_q3 - y_q1))
            except Exception:
                # if percentile fails (e.g. constant series), skip
                pass

            train_start = work['ds'].min().strftime('%Y-%m-%d')
            train_end = work['ds'].max().strftime('%Y-%m-%d')

            meta = ForecastMeta(
                freq=request.freq,
                train_start=train_start,
                train_end=train_end,
                horizon=request.horizon,
                holidays_used=[],
                original_rows=original_rows,
                processed_rows=processed_rows,
                null_dates=null_dates,
                null_targets=null_targets
            )

            data_quality = {
                "negative_values": neg_count,
                "positive_values": pos_count,
                "zero_values": zero_count,
                "clipped_negatives": clipped_negatives,
                "rows_before": original_rows,
                "rows_after": processed_rows
            }

            return work, meta, data_quality

        except UserInputError:
            raise
        except Exception as e:
            _safe_log_exception("Data validation failed", e)
            raise SystemError("Data validation failed") from e

    def _aggregate_to_frequency(self, df: pd.DataFrame, freq: str) -> pd.DataFrame:
        """
        Aggregate input data to requested frequency.
        Expects df with columns ['ds', 'y'] and ds as datetime.
        """
        try:
            df_local = df.copy()
            if freq == 'D':
                df_agg = df_local.groupby(df_local['ds'].dt.floor('D')).agg({'y': 'sum'}).reset_index()
                df_agg.rename(columns={'ds': 'ds'}, inplace=True)
            elif freq == 'W':
                # Week starting Monday
                df_local['week'] = df_local['ds'].dt.to_period('W-MON')
                df_agg = df_local.groupby('week').agg({'y': 'sum'}).reset_index()
                df_agg['ds'] = df_agg['week'].dt.start_time
                df_agg = df_agg[['ds', 'y']]
            elif freq == 'M':
                df_local['month'] = df_local['ds'].dt.to_period('M')
                df_agg = df_local.groupby('month').agg({'y': 'sum'}).reset_index()
                df_agg['ds'] = df_agg['month'].dt.start_time
                df_agg = df_agg[['ds', 'y']]
            else:
                # If unknown, return as-is
                return df_local[['ds', 'y']]

            df_agg = df_agg.sort_values('ds').reset_index(drop=True)
            return df_agg

        except Exception as e:
            _safe_log_exception("Frequency aggregation failed", e)
            # return input (best-effort) - caller will validate counts
            return df[['ds', 'y']].sort_values('ds').reset_index(drop=True)

    # -------------------------
    # Recent summary for AI
    # -------------------------
    def _get_recent_summary(self, df: pd.DataFrame, freq: str) -> RecentSummary:
        try:
            # last4 growth (compare last 4 vs previous 4) - requires 8 periods
            last4_growth_pct = 0.0
            if len(df) >= 8:
                last_4 = float(df.tail(4)['y'].mean())
                prev_4 = float(df.iloc[-8:-4]['y'].mean())
                if prev_4 > 0:
                    last4_growth_pct = ((last_4 - prev_4) / prev_4) * 100.0

            # YoY approximation
            periods_per_year = {'D': 365, 'W': 52, 'M': 12}
            periods_back = periods_per_year.get(freq, 52)
            yoy_last_period_pct = 0.0
            if len(df) > periods_back:
                current_period = float(df.iloc[-1]['y'])
                year_ago_idx = -periods_back - 1
                if abs(year_ago_idx) <= len(df):
                    year_ago_period = float(df.iloc[year_ago_idx]['y'])
                    if year_ago_period > 0:
                        yoy_last_period_pct = ((current_period - year_ago_period) / year_ago_period) * 100.0

            recent_values = df.tail(12)['y']
            volatility_index = 0.0
            if recent_values.size > 1 and recent_values.mean() > 0:
                volatility_index = float(recent_values.std() / recent_values.mean())
            volatility_index = float(_clamp(volatility_index, 0.0, 1.0))

            return RecentSummary(
                last4_growth_pct=round(last4_growth_pct, 2),
                yoy_last_period_pct=round(yoy_last_period_pct, 2),
                volatility_index=round(volatility_index, 3)
            )

        except Exception as e:
            _safe_log_exception("Error calculating recent summary", e)
            # sensible defaults
            return RecentSummary(last4_growth_pct=0.0, yoy_last_period_pct=0.0, volatility_index=0.5)

    # -------------------------
    # Train model (blocking) - executed in thread
    # -------------------------
    def _train_prophet_model_sync(self, df: pd.DataFrame, holidays_df: Optional[pd.DataFrame], freq: str) -> Prophet:
        """
        Train Prophet; if initialization or fit fails (Stan backend missing or other),
        return a Prophet-compatible fallback model via self._get_fallback_model(...)
        """
        try:
            # Prepare and validate data
            prophet_df = prepare_prophet_data(df)
            if len(prophet_df) < MIN_PERIODS_REQUIRED:
                raise UserInputError(f"Need at least {MIN_PERIODS_REQUIRED} valid data points after preparation")

            # Get config but DO NOT force stan_backend here — let Prophet choose
            config = get_prophet_config(prophet_df, freq)

            # Try to initialize Prophet normally
            try:
                model = Prophet(**config)
            except Exception as e:
                logger.warning("Prophet initialization failed: %s", str(e)[:300])
                # Quick probe: is cmdstanpy installed?
                try:
                    import cmdstanpy  # type: ignore
                    logger.info("cmdstanpy package present; ensure CmdStan binaries installed in the image")
                except Exception:
                    logger.info("cmdstanpy not present in environment")
                return self._get_fallback_model(prophet_df, freq)

            # Add holidays if provided (Prophet API)
            if holidays_df is not None and not holidays_df.empty:
                # Ensure holiday dates are proper pandas datetimes (not python.date)
                holidays_df = holidays_df.copy()
                # if 'ds' column might be plain date objects or strings, coerce robustly
                holidays_df['ds'] = pd.to_datetime(holidays_df['ds'], errors='coerce')
                # drop unparsable rows
                holidays_df = holidays_df[holidays_df['ds'].notna()].reset_index(drop=True)
                # normalize to midnight to avoid time vs date mismatches
                holidays_df['ds'] = holidays_df['ds'].dt.normalize()

                # Prophet accepts a holidays DataFrame with columns ['ds','holiday']; ensure expected names
                # if holidays_df has different column names, map them here (example: 'date' -> 'ds')
                if 'holiday' not in holidays_df.columns:
                    # best-effort: if there's a 'name' or 'label' column, rename it
                    for alt in ('name', 'label'):
                        if alt in holidays_df.columns:
                            holidays_df = holidays_df.rename(columns={alt: 'holiday'})
                            break

            # Fit model (may be slow) — suppress noisy stdout/stderr
            try:
                with suppress_stdout_stderr():
                    model.fit(prophet_df)
            except Exception as e:
                _safe_log_exception("Prophet fit failed", e)
                return self._get_fallback_model(prophet_df, freq)

            logger.info("Prophet model trained successfully with %d points", len(prophet_df))
            return model

        except UserInputError:
            raise
        except Exception as e:
            _safe_log_exception("Prophet training failed", e)
            return self._get_fallback_model(df, freq)

    def _get_fallback_model(self, df: pd.DataFrame, freq: str) -> Any:
        """Simple fallback model when Prophet fails."""
        class SimpleModel:
            def __init__(self, history_df: pd.DataFrame):
                self.mean = float(history_df['y'].mean())
                self.std = float(history_df['y'].std())

            def make_future_dataframe(self, periods: int, freq: str) -> pd.DataFrame:
                last_date = df['ds'].max()
                dates = pd.date_range(start=last_date, periods=periods + 1, freq=freq)[1:]
                return pd.DataFrame({'ds': dates})

            def predict(self, future_df: pd.DataFrame) -> pd.DataFrame:
                forecast = future_df.copy()
                forecast['yhat'] = self.mean
                forecast['yhat_lower'] = max(0, self.mean - 1.96 * self.std)
                forecast['yhat_upper'] = self.mean + 1.96 * self.std
                return forecast

        logger.warning("Using fallback forecasting model due to Prophet initialization failure")
        return SimpleModel(df)

    # -------------------------
    # Main forecasting function
    # -------------------------
    async def generate_forecast(self, file_content: bytes, filename: str, request: ForecastRequest) -> ForecastResponse:
        """
        High-level async entry point:
        - reads file (async-friendly)
        - validates and prepares data
        - optionally fetches holidays (sync in thread)
        - trains Prophet in thread
        - predicts and optionally calls AI adjustment (async)

        Returns ForecastResponse. Data quality info is included inside ai_adjustment dict
        under the key 'data_quality' (so UI can display it).
        """
        try:
            # Read file
            df = await self.read_file(file_content, filename)

            # Validate and process (returns data_quality)
            df_clean, meta, data_quality = self.validate_and_process_data(df, request)

            # Optionally fetch holidays (run in thread)
            holidays_df = None
            if getattr(request, "apply_holidays", False):
                try:
                    # Ensure holidays_service returns dataframe
                    holidays_df = await asyncio.to_thread(
                        self.holidays_service.get_holidays_dataframe,
                        getattr(request, "country", None),
                        getattr(request, "state", None),
                        df_clean['ds'].min(),
                        df_clean['ds'].max() + _get_date_offset(request.freq, request.horizon)
                    )
                    # Keep holiday names in meta for audit
                    if isinstance(holidays_df, pd.DataFrame) and not holidays_df.empty:
                        meta.holidays_used = holidays_df['holiday'].unique().tolist()
                except Exception as e:
                    _safe_log_exception("Failed to fetch holidays", e)
                    # don't fail entire request - continue without holidays
                    holidays_df = None

            # Train model (in thread)
            model = await asyncio.to_thread(self._train_prophet_model_sync, df_clean, holidays_df, request.freq)

            # Create future dataframe (safely)
            freq_alias = self._get_freq_alias(request.freq)
            # Note: Prophet make_future_dataframe takes periods and freq alias (like 'D', 'W-MON', 'MS')
            future_df = model.make_future_dataframe(periods=request.horizon, freq=freq_alias)

            # Predict (in thread)
            forecast = await asyncio.to_thread(model.predict, future_df)

            # Ensure forecast contains expected columns
            required_cols = {"ds", "yhat", "yhat_lower", "yhat_upper"}
            for c in required_cols:
                if c not in forecast.columns:
                    forecast[c] = np.nan  # fill to avoid KeyError

            # Split history vs future using date-based separation (robust)
            last_hist_date = df_clean['ds'].max()
            future_mask = forecast['ds'] > last_hist_date
            forecast_base_df = forecast.loc[future_mask, ["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
            # Convert any non-finite to 0.0 to be JSON-serializable
            forecast_base_df = forecast_base_df.replace([np.inf, -np.inf], np.nan).fillna(0.0)

            # Baseline final data (before AI adjustment)
            forecast_final_df = forecast_base_df.copy()
            forecast_final_df['yhat_final'] = forecast_final_df['yhat'].apply(lambda v: float(v) if np.isfinite(v) else 0.0)

            ai_adjustment_info: Optional[Dict[str, Any]] = None

            # Apply AI adjustment if requested (this is async - ai_client expected to be async)
            if getattr(request, "apply_ai_adjustment", False):
                try:
                    recent_summary = self._get_recent_summary(df_clean, request.freq)
                    upcoming_holidays = []
                    try:
                        # try to get upcoming holidays (safe)
                        upcoming_holidays = await asyncio.to_thread(
                            self.holidays_service.get_upcoming_holidays,
                            getattr(request, "country", None),
                            getattr(request, "state", None),
                            request.horizon
                        ) or []
                    except Exception:
                        upcoming_holidays = []

                    ai_request = AIAdjustmentRequest(
                        industry=(request.industry or "")[:200],
                        country=(request.country or "")[:100],
                        state=(request.state or "")[:100],
                        city=(request.city or "")[:100],
                        freq=request.freq,
                        horizon=request.horizon,
                        recent_summary=recent_summary,
                        holidays_window=(upcoming_holidays[:5] if isinstance(upcoming_holidays, list) else upcoming_holidays)
                    )

                    # Call AI client (allow both sync and async clients)
                    if asyncio.iscoroutinefunction(getattr(self.ai_client, "get_adjustment", None)):
                        adjustment = await self.ai_client.get_adjustment(ai_request)
                    else:
                        adjustment = await asyncio.to_thread(self.ai_client.get_adjustment, ai_request)

                    # Sanitize adjustment input
                    adj_pct = float(getattr(adjustment, "adjustment_pct", 0.0) or 0.0)
                    adj_pct = _clamp(adj_pct, SAFE_ADJUSTMENT_PCT_MIN, SAFE_ADJUSTMENT_PCT_MAX)

                    ai_adjustment_info = {
                        "applied": True,
                        "adjustment_pct": adj_pct,
                        "rationale": getattr(adjustment, "rationale", "") or "",
                        "sources": getattr(adjustment, "sources", []) or []
                    }

                    # Apply adjustment in a safe manner (non-negative constraint)
                    adjustment_factor = 1.0 + (adj_pct / 100.0)
                    if adjustment_factor <= 0:
                        # do not invert series; treat extreme negative as zero-growth
                        adjustment_factor = 0.0

                    def apply_adj(row):
                        base = _sanitize_numeric_str(row['yhat'])
                        if base is None or np.isnan(base):
                            base = 0.0
                        adjusted = base * adjustment_factor
                        return float(max(0.0, adjusted))

                    forecast_final_df['yhat_final'] = forecast_final_df.apply(apply_adj, axis=1)

                except UserInputError:
                    raise
                except Exception as e:
                    _safe_log_exception("AI adjustment failed", e)
                    ai_adjustment_info = {
                        "applied": False,
                        "adjustment_pct": 0.0,
                        "rationale": "AI adjustment failed or timed out",
                        "sources": []
                    }
                    # keep base as final

            # If AI adjustment not requested, set default ai_adjustment_info (but include data_quality)
            if ai_adjustment_info is None:
                ai_adjustment_info = {"applied": False, "adjustment_pct": 0.0, "rationale": "", "sources": []}

            # Attach data_quality for UI (this avoids modifying ForecastMeta object structure)
            ai_adjustment_info["data_quality"] = data_quality

            # Prepare history for response (trim potentially large histories)
            history = []
            try:
                hist_df = df_clean.copy()
                # Sanitize numeric values
                hist_df['y'] = hist_df['y'].apply(lambda v: float(v) if np.isfinite(v) else 0.0)
                # Convert to DataPoint list
                history = [DataPoint(ds=str(row['ds'].date()), y=round(float(row['y']), 4)) for _, row in hist_df.iterrows()]
            except Exception:
                history = []

            # Format forecast_base and forecast_final
            forecast_base = []
            for _, row in forecast_base_df.iterrows():
                ds = row['ds']
                ds_str = str(ds.date()) if hasattr(ds, 'date') else str(ds)[:10]
                forecast_base.append(DataPoint(
                    ds=ds_str,
                    yhat=round(float(row['yhat']), 4),
                    yhat_lower=round(float(row['yhat_lower']), 4),
                    yhat_upper=round(float(row['yhat_upper']), 4)
                ))

            forecast_final = []
            for _, row in forecast_final_df.iterrows():
                ds = row['ds']
                ds_str = str(ds.date()) if hasattr(ds, 'date') else str(ds)[:10]
                forecast_final.append(DataPoint(
                    ds=ds_str,
                    yhat_final=round(float(row['yhat_final']), 4)
                ))

            response = ForecastResponse(
                meta=meta,
                ai_adjustment=ai_adjustment_info,
                history=history,
                forecast_base=forecast_base,
                forecast_final=forecast_final
            )

            return response

        except UserInputError as e:
            # user-caused problems; rethrow so caller can map to 4xx
            logger.warning(f"User input error: {str(e)[:200]}")
            raise
        except SystemError as e:
            _safe_log_exception("System error in forecast generation", e)
            raise
        except Exception as e:
            _safe_log_exception("Unexpected error in forecast generation", e)
            # avoid leaking details
            raise SystemError("Unexpected server error during forecast generation") from e

    # -------------------------
    # Helpers
    # -------------------------
    def _get_freq_alias(self, freq: str) -> str:
        """
        Map to Prophet-friendly freq alias.
        Weekly use 'W-MON' for Monday-start weeks; monthly use 'MS' (month start).
        """
        freq_map = {'D': 'D', 'W': 'W-MON', 'M': 'MS'}
        return freq_map.get(freq, 'D')

    def _get_prophet_config(self, df: pd.DataFrame, freq: str) -> Dict[str, Any]:
        """Get optimal Prophet configuration based on data characteristics."""
        
        # Calculate data characteristics
        n_points = len(df)
        date_range = (df['ds'].max() - df['ds'].min()).days
        
        config = {
            'daily_seasonality': freq == 'D',
            'weekly_seasonality': freq in ('D', 'W'),
            'yearly_seasonality': date_range >= 365,
            'growth': 'linear',
            'seasonality_mode': 'multiplicative' if df['y'].std() / df['y'].mean() > 0.5 else 'additive',
            'seasonality_prior_scale': 10.0,  # Flexibility of the seasonality
            'changepoint_prior_scale': 0.05,  # Flexibility of the trend
            'holidays_prior_scale': 10.0,     # Flexibility of the holiday effects
        }
        
        # Add changepoints if enough data
        if n_points > 50:
            config['n_changepoints'] = min(25, n_points // 10)
        
        return config

    # -------------------------
    # Add before training Prophet model
    # -------------------------
    def _prepare_prophet_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepare data specifically for Prophet training."""
        prophet_df = df.copy()
        
        # Remove duplicates
        prophet_df = prophet_df.drop_duplicates(subset=['ds'])
        
        # Sort by date
        prophet_df = prophet_df.sort_values('ds')
        
        # Handle outliers (optional)
        Q1 = prophet_df['y'].quantile(0.25)
        Q3 = prophet_df['y'].quantile(0.75)
        IQR = Q3 - Q1
        prophet_df = prophet_df[
            (prophet_df['y'] >= Q1 - 1.5 * IQR) & 
            (prophet_df['y'] <= Q3 + 1.5 * IQR)
        ]
        
        # Ensure no negative values
        prophet_df['y'] = prophet_df['y'].clip(lower=0)
        
        # Reset index
        prophet_df = prophet_df.reset_index(drop=True)
        
        return prophet_df

class suppress_stdout_stderr:
    """Context manager to suppress Prophet's stdout/stderr prints."""
    def __enter__(self):
        self.stdout = sys.stdout
        self.stderr = sys.stderr
        sys.stdout = open(os.devnull, 'w')
        sys.stderr = open(os.devnull, 'w')

    def __exit__(self, *args):
        sys.stdout.close()
        sys.stderr.close()
        sys.stdout = self.stdout
        sys.stderr = self.stderr

