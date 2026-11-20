// File: frontend/client/src/services/forecastService.js
import axios from 'axios';
import { API_BASE_URL } from '../lib/api';

const getAuthToken = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  return user ? user.token : null;
};

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function getCountries() {
  try {
    const response = await axios.get(`${API_BASE_URL}/geo/countries`);
    return response.data.countries;
  } catch (error) {
    console.error("Error fetching countries:", error);
    return [];
  }
}

export async function getSubdivisions(country) {
  if (!country) return [];
  try {
    const response = await axios.get(`${API_BASE_URL}/geo/subdivisions/${encodeURIComponent(country)}`);
    return response.data.subdivisions;
  } catch (error) {
    console.error(`Error fetching subdivisions for ${country}:`, error);
    return [];
  }
}

export async function generateForecast(params) {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Authentication token not found.');
    }

    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('industry', params.industry);
    formData.append('country', params.country);
    formData.append('freq', params.freq);
    formData.append('horizon', params.horizon);
    formData.append('date_col', params.date_col);
    formData.append('target_col', params.target_col);
    if (params.state) {
        formData.append('state', params.state);
    }
    if (params.city) {
        formData.append('city', params.city);
    }
    formData.append('apply_holidays', params.apply_holidays);
    formData.append('apply_ai_adjustment', params.apply_ai_adjustment);

    try {
        // Goes through the Node backend, which checks the JWT and then
        // forwards the request to the Python forecasting service.
        const response = await axios.post(`${API_BASE_URL}/forecast`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                ...authHeaders(),
            },
        });
        return response.data;
    } catch (error) {
        const data = error.response && error.response.data;
        if (data) {
            // Node errors use `message`; FastAPI errors use `detail`.
            const detail = typeof data.detail === 'string' ? data.detail : null;
            throw new Error(data.message || detail || 'An error occurred during forecast generation.');
        }
        throw new Error('An error occurred during forecast generation.');
    }
}
