import os
import sys
import pandas as pd
import numpy as np
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

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

def prepare_prophet_data(df: pd.DataFrame) -> pd.DataFrame:
    """Prepare data specifically for Prophet training."""
    prophet_df = df.copy()
    
    # Remove duplicates
    prophet_df = prophet_df.drop_duplicates(subset=['ds'])
    
    # Sort by date
    prophet_df = prophet_df.sort_values('ds')
    
    # Handle outliers
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

def get_prophet_config(df: pd.DataFrame, freq: str) -> Dict[str, Any]:
    """Get optimal Prophet configuration based on data characteristics."""
    n_points = len(df)
    date_range = (df['ds'].max() - df['ds'].min()).days
    
    config = {
        'daily_seasonality': freq == 'D',
        'weekly_seasonality': freq in ('D', 'W'),
        'yearly_seasonality': date_range >= 365,
        'growth': 'linear',
        'seasonality_mode': 'multiplicative' if df['y'].std() / df['y'].mean() > 0.5 else 'additive',
        'seasonality_prior_scale': 10.0,
        'changepoint_prior_scale': 0.05,
        'holidays_prior_scale': 10.0
    }
    
    if n_points > 50:
        config['n_changepoints'] = min(25, n_points // 10)
    
    return config