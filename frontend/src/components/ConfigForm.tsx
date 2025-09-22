import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { MapPin, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { getCountries, getSubdivisions } from '../api/client';
import type { FilePreview } from '../lib/fileUtils';
import type { ColumnDetection } from '../lib/detectColumns';
import type { ConfigFormData, Country, Subdivision } from '../types';

const INDUSTRIES = [
  { value: 'retail', label: 'Retail' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'cpg', label: 'CPG' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'grocery', label: 'Grocery' },
  { value: 'pharma', label: 'Pharma' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'other', label: 'Other' },
];

const FREQUENCIES = [
  //{ value: 'D' as const, label: 'Daily', description: 'Best for short-term planning and high-volume businesses' },
  { value: 'W' as const, label: 'Weekly', description: 'Recommended for most business forecasting needs' },
  { value: 'M' as const, label: 'Monthly', description: 'Good for long-term strategic planning' },
];

interface ConfigFormProps {
  preview: FilePreview;
  detectedColumns: {
    date: ColumnDetection | null;
    target: ColumnDetection | null;
  };
  onSubmit: (data: ConfigFormData) => void;
  isLoading?: boolean;
}

export function ConfigForm({ preview, detectedColumns, onSubmit, isLoading = false }: ConfigFormProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [subdivisions, setSubdivisions] = useState<Subdivision[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingSubdivisions, setLoadingSubdivisions] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ConfigFormData>({
    defaultValues: {
      industry: '',
      country: '',
      state: '',
      city: '',
      freq: 'W',
      horizon: 8,
      date_col: detectedColumns.date?.name || '',
      target_col: detectedColumns.target?.name || '',
      apply_holidays: true,
      apply_ai_adjustment: true,
    },
  });

  const selectedFreq = watch('freq');
  const selectedCountry = watch('country');

  // Load countries on component mount
  useEffect(() => {
    const loadCountries = async () => {
      setLoadingCountries(true);
      try {
        const response = await getCountries();
        setCountries(response.countries || []);
      } catch (error) {
        console.error('Failed to load countries:', error);
      } finally {
        setLoadingCountries(false);
      }
    };
    loadCountries();
  }, []);

  // Load subdivisions when country changes
  useEffect(() => {
    if (selectedCountry) {
      const loadSubdivisions = async () => {
        setLoadingSubdivisions(true);
        try {
          const response = await getSubdivisions(selectedCountry);
          setSubdivisions(response.subdivisions || []);
        } catch (error) {
          console.error('Failed to load subdivisions:', error);
          setSubdivisions([]);
        } finally {
          setLoadingSubdivisions(false);
        }
      };
      loadSubdivisions();
      // Reset state when country changes
      setValue('state', '');
    } else {
      setSubdivisions([]);
      setValue('state', '');
    }
  }, [selectedCountry, setValue]);

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <form onSubmit={handleSubmit(onSubmit)}>
        
        {/* Business Context */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <MapPin style={{ height: '1.25rem', width: '1.25rem', color: '#0284c7' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '500', color: '#111827', margin: '0' }}>Business Context</h3>
          </div>
          
          <div className="form-grid">
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                Industry *
              </label>
              <select
                {...register('industry', { required: 'Industry is required' })}
                className="input-field"
                style={{ width: '100%' }}
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((industry) => (
                  <option key={industry.value} value={industry.value}>
                    {industry.label}
                  </option>
                ))}
              </select>
              {errors.industry && (
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>
                  {errors.industry.message}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                Country *
              </label>
              <div className="dropdown-container">
                <select
                  {...register('country', { required: 'Country is required' })}
                  className="input-field"
                  style={{ width: '100%' }}
                  disabled={loadingCountries}
                >
                <option value="">
                  {loadingCountries ? 'Loading countries...' : 'Select country...'}
                </option>
                {countries.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
                </select>
              </div>
              {errors.country && (
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>
                  {errors.country.message}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                State/Province
              </label>
              <div className="dropdown-container">
                <select
                  {...register('state')}
                  className="input-field"
                  style={{ width: '100%' }}
                  disabled={!selectedCountry || loadingSubdivisions}
                >
                <option value="">
                  {!selectedCountry
                    ? 'Select country first'
                    : loadingSubdivisions
                    ? 'Loading states...'
                    : subdivisions.length > 0
                    ? 'Select state/province...'
                    : 'No states available'}
                </option>
                {subdivisions.map((subdivision) => (
                  <option key={subdivision.value} value={subdivision.value}>
                    {subdivision.label}
                  </option>
                ))}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                City
              </label>
              <input
                type="text"
                {...register('city')}
                className="input-field"
                placeholder="e.g., San Francisco, Mumbai"
              />
            </div>
          </div>
        </div>

        {/* Forecast Configuration */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Calendar style={{ height: '1.25rem', width: '1.25rem', color: '#0284c7' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '500', color: '#111827', margin: '0' }}>Forecast Settings</h3>
          </div>
          
          <div className="form-grid">
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                Forecast Frequency *
              </label>
              <select
                {...register('freq', { required: 'Frequency is required' })}
                className="input-field"
                style={{ width: '100%' }}
              >
                {FREQUENCIES.map((freq) => (
                  <option key={freq.value} value={freq.value}>
                    {freq.label}
                  </option>
                ))}
              </select>
              {selectedFreq && (
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  {FREQUENCIES.find(f => f.value === selectedFreq)?.description}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                Forecast Horizon *
              </label>
              <input
                type="number"
                {...register('horizon', { 
                  required: 'Horizon is required',
                  min: { value: 1, message: 'Must be at least 1' },
                  max: { value: 365, message: 'Must be less than 365' }
                })}
                className="input-field"
                style={{ width: '100%' }}
                min="1"
                max="365"
              />
              {errors.horizon && (
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>
                  {errors.horizon.message}
                </p>
              )}
              <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
                Number of {selectedFreq === 'D' ? 'days' : selectedFreq === 'W' ? 'weeks' : 'months'} to forecast
              </p>
            </div>
          </div>
        </div>

        {/* Column Selection */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <TrendingUp style={{ height: '1.25rem', width: '1.25rem', color: '#0284c7' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '500', color: '#111827', margin: '0' }}>Data Columns</h3>
          </div>
          
          <div className="form-grid">
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                Date Column *
              </label>
              <select
                {...register('date_col', { required: 'Date column is required' })}
                className="input-field"
                style={{ width: '100%' }}
              >
                <option value="">Select date column...</option>
                {preview.columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                    {detectedColumns.date?.name === col && ' (auto-detected)'}
                  </option>
                ))}
              </select>
              {errors.date_col && (
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>
                  {errors.date_col.message}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                Sales/Target Column *
              </label>
              <select
                {...register('target_col', { required: 'Target column is required' })}
                className="input-field"
                style={{ width: '100%' }}
              >
                <option value="">Select target column...</option>
                {preview.columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                    {detectedColumns.target?.name === col && ' (auto-detected)'}
                  </option>
                ))}
              </select>
              {errors.target_col && (
                <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#dc2626' }}>
                  {errors.target_col.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Advanced Options */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '500', color: '#111827', marginBottom: '1rem' }}>Advanced Options</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                {...register('apply_holidays')}
                type="checkbox"
                style={{ marginTop: '0.25rem' }}
              />
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827', display: 'block' }}>
                  Include country/state holidays
                </label>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                  Automatically adjust forecast for major holidays in your region
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                {...register('apply_ai_adjustment')}
                type="checkbox"
                style={{ marginTop: '0.25rem' }}
              />
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#111827', display: 'block' }}>
                  Apply AI macro economics adjustment
                </label>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                  Get AI-powered adjustments based on current economic conditions (±20% max)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Notice */}
        <div style={{ 
          backgroundColor: '#eff6ff', 
          border: '1px solid #bfdbfe', 
          borderRadius: '0.375rem', 
          padding: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <AlertCircle style={{ height: '1.25rem', width: '1.25rem', color: '#2563eb', flexShrink: 0, marginTop: '0.125rem' }} />
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1e40af', margin: '0 0 0.25rem 0' }}>Privacy Notice</h4>
              <p style={{ fontSize: '0.75rem', color: '#1d4ed8', margin: '0' }}>
                Your sales data is processed only on our server for modeling and never sent to external AI models. 
                Only anonymous context (industry/location/horizon) is sent to AI models for macro adjustment.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              opacity: isLoading ? 0.5 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? (
              <>
                <div style={{
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span>Generating Forecast...</span>
              </>
            ) : (
              <span>Generate Forecast</span>
            )}
          </button>
        </div>
      </form>
      
      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}