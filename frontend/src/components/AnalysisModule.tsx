import React, { useMemo } from 'react';
import {
 BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
 Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Calendar, TrendingUp, BarChart3 } from 'lucide-react';

interface DataPoint {
 ds: string;
 y: number;
}

interface AnalysisModuleProps {
 data: DataPoint[];
 title?: string;
}

interface ProcessedData {
 isMultiYear: boolean;
 yearlyData: { year: string; sales: number }[];
 monthlyData: { month: string; sales: number; year?: string }[];
 weeklyData: { week: string; sales: number; year?: string }[];
 trendData: { period: string; sales: number }[];
 selectedYear?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const AnalysisModule: React.FC<AnalysisModuleProps> = ({
 data,
 title = "Sales Analysis"
}) => {
 const [selectedYear, setSelectedYear] = React.useState<string>('');

 const processedData: ProcessedData = useMemo(() => {
  if (!data || data.length === 0) {
   return {
    isMultiYear: false,
    yearlyData: [],
    monthlyData: [],
    weeklyData: [],
    trendData: []
   };
  }

  // Parse dates and determine if multi-year
  const parsedData = data.map(point => ({
   ...point,
   date: new Date(point.ds),
   year: new Date(point.ds).getFullYear(),
   month: new Date(point.ds).getMonth(),
   week: Math.ceil(new Date(point.ds).getDate() / 7)
  }));

  const uniqueYears = [...new Set(parsedData.map(d => d.year))].sort();
  const isMultiYear = uniqueYears.length > 1;

  if (isMultiYear) {
   // Multi-year analysis
   const yearlyAgg = parsedData.reduce((acc, point) => {
    const year = point.year.toString();
    acc[year] = (acc[year] || 0) + point.y;
    return acc;
   }, {} as Record<string, number>);

   const yearlyData = Object.entries(yearlyAgg).map(([year, sales]) => ({
    year,
    sales: Math.round(sales)
   }));

   // Monthly data by year
   const monthlyAgg = parsedData.reduce((acc, point) => {
    const key = `${point.year}-${point.month}`;
    acc[key] = (acc[key] || 0) + point.y;
    return acc;
   }, {} as Record<string, number>);

   const monthlyData = Object.entries(monthlyAgg).map(([key, sales]) => {
    const [year, monthIdx] = key.split('-');
    return {
     month: MONTHS[parseInt(monthIdx)],
     year,
     sales: Math.round(sales)
    };
   });

   // Weekly data by year
   const weeklyAgg = parsedData.reduce((acc, point) => {
    const key = `${point.year}-${point.week}`;
    acc[key] = (acc[key] || 0) + point.y;
    return acc;
   }, {} as Record<string, number>);

   const weeklyData = Object.entries(weeklyAgg).map(([key, sales]) => {
    const [year, week] = key.split('-');
    return {
     week: `Week ${week}`,
     year,
     sales: Math.round(sales)
    };
   });

   // Trend data (yearly trend)
   const trendData = yearlyData.map(item => ({
    period: item.year,
    sales: item.sales
   }));

   return {
    isMultiYear,
    yearlyData,
    monthlyData,
    weeklyData,
    trendData,
    selectedYear: selectedYear || uniqueYears[0]?.toString()
   };
  } else {
   // Single year analysis

   // Monthly aggregation
   const monthlyAgg = parsedData.reduce((acc, point) => {
    const month = point.month;
    acc[month] = (acc[month] || 0) + point.y;
    return acc;
   }, {} as Record<number, number>);

   const monthlyData = MONTHS.map((month, idx) => ({
    month,
    sales: Math.round(monthlyAgg[idx] || 0)
   }));

   // Weekly aggregation
   const weeklyAgg = parsedData.reduce((acc, point) => {
    const week = point.week;
    acc[week] = (acc[week] || 0) + point.y;
    return acc;
   }, {} as Record<number, number>);

   const weeklyData = Array.from({ length: 52 }, (_, i) => ({
    week: `Week ${i + 1}`,
    sales: Math.round(weeklyAgg[i + 1] || 0)
   })).filter(item => item.sales > 0);

   // Monthly trend
   const trendData = monthlyData.map(item => ({
    period: item.month,
    sales: item.sales
   }));

   return {
    isMultiYear: false,
    yearlyData: [],
    monthlyData,
    weeklyData,
    trendData
   };
  }
 }, [data, selectedYear]);

 const multiLineChartData = useMemo(() => {
  if (!processedData.isMultiYear) return [];

  const pivotedData = processedData.monthlyData.reduce((acc, { month, year, sales }) => {
   if (!acc[month]) {
    acc[month] = { month };
   }
   acc[month][year!] = sales;
   return acc;
  }, {} as Record<string, { month: string;[year: string]: number | string }>);

  return MONTHS.map(month => pivotedData[month] || { month });
 }, [processedData.isMultiYear, processedData.monthlyData]);

 const uniqueYearsForChart = useMemo(() => {
  if (!processedData.isMultiYear) return [];
  return [...new Set(processedData.monthlyData.map(item => item.year!))].sort();
 }, [processedData.isMultiYear, processedData.monthlyData]);

 const lineColors = ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F", "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC"];

 const filteredMonthlyData = processedData.isMultiYear && processedData.selectedYear ?
  processedData.monthlyData.filter(item => item.year === processedData.selectedYear) :
  processedData.monthlyData;

 const filteredWeeklyData = processedData.isMultiYear && processedData.selectedYear ?
  processedData.weeklyData.filter(item => item.year === processedData.selectedYear) :
  processedData.weeklyData;

 if (!data || data.length === 0) {
  return (
   <div style={{
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    padding: '2rem',
    textAlign: 'center',
    color: '#6b7280'
   }}>
    <BarChart3 style={{ height: '3rem', width: '3rem', margin: '0 auto', marginBottom: '1rem' }} />
    <p>No data available for analysis</p>
   </div>
  );
 }

 return (
  <div style={{
   backgroundColor: 'white',
   borderRadius: '0.5rem',
   padding: '2rem',
   boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
   border: '1px solid #e5e7eb'
  }}>
   {/* Header */}
   <div style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
     <BarChart3 style={{ height: '1.5rem', width: '1.5rem', color: '#0284c7' }} />
     <h3 style={{ color: '#111827', fontSize: '1.5rem', margin: '0' }}>
      {title}
     </h3>
    </div>
    <p style={{ color: '#6b7280', margin: '0' }}>
     {processedData.isMultiYear ?
      `Multi-year analysis (${Math.min(...data.map(d => new Date(d.ds).getFullYear()))} - ${Math.max(...data.map(d => new Date(d.ds).getFullYear()))})` :
      `Single year analysis (${new Date(data[0].ds).getFullYear()})`
     }
    </p>
   </div>

   {/* Charts Grid */}
   <div style={{ display: 'grid', gap: '2rem' }}>
    {processedData.isMultiYear ? (
     <>
      {/* Multi-year Charts */}
      <div>
       <h4 style={{ color: '#111827', fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Calendar style={{ height: '1rem', width: '1rem' }} />
        Sales by Year
       </h4>
       <ResponsiveContainer width="100%" height={300}>
        <BarChart data={processedData.yearlyData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
         <CartesianGrid strokeDasharray="3 3" />
         <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
         <YAxis dataKey="year" type="category" />
         <Tooltip
          formatter={(value) => [value.toLocaleString(), 'Sales']}
          labelStyle={{ color: '#111827' }}
         />
         <Bar dataKey="sales" fill="#0284c7" radius={[0, 4, 4, 0]} />
        </BarChart>
       </ResponsiveContainer>
      </div>
      
      {/* Multi-year filters */}
      <div>
        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem', display: 'block' }}>
        Filter by Year:
        </label>
        <select
        value={selectedYear}
        onChange={(e) => setSelectedYear(e.target.value)}
        style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.875rem'
        }}
        >
        <option value="">All Years</option>
        {[...new Set(data.map(d => new Date(d.ds).getFullYear()))].sort().map(year => (
            <option key={year} value={year.toString()}>{year}</option>
        ))}
        </select>
      </div>

      <div>
       <h4 style={{ color: '#111827', fontSize: '1.125rem', marginBottom: '1rem' }}>
        Monthly Sales ({processedData.selectedYear})
       </h4>
       <ResponsiveContainer width="100%" height={300}>
        <BarChart data={filteredMonthlyData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
         <CartesianGrid strokeDasharray="3 3" />
         <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
         <YAxis dataKey="month" type="category" interval={0} />
         <Tooltip
          formatter={(value) => [value.toLocaleString(), 'Sales']}
          labelStyle={{ color: '#111827' }}
         />
         <Bar dataKey="sales" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
        </BarChart>
       </ResponsiveContainer>
      </div>

      <div>
       <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
       <h4 style={{ color: '#111827', fontSize: '1.125rem', marginBottom: '1rem' }}>
        Y-O-Y Growth Trends
       </h4>
       </div>
       <ResponsiveContainer width="100%" height={300}>
        <LineChart data={multiLineChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
         <CartesianGrid stroke="#e5e7eb" vertical={false} />
         <XAxis dataKey="month" interval={0} />
         <YAxis tickFormatter={(value) => `${Number(value) / 1000}K`} />
         <Tooltip
          formatter={(value: number, name: string) => [value.toLocaleString(), name]}
          contentStyle={{ borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
         />
         <Legend />
         {uniqueYearsForChart.map((year, index) => (
          <Line
           key={year}
           type="linear"
           dataKey={year}
           stroke={lineColors[index % lineColors.length]}
           strokeWidth={2}
           dot={false}
           activeDot={{ r: 6 }}
          />
         ))}
        </LineChart>
       </ResponsiveContainer>
      </div>
     </>
    ) : (
     <>
      {/* Single-year Charts */}
      <div>
       <h4 style={{ color: '#111827', fontSize: '1.125rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Calendar style={{ height: '1rem', width: '1rem' }} />
         Monthly Sales Breakdown ({new Date(data[0].ds).getFullYear()})
       </h4>
       <ResponsiveContainer width="100%" height={300}>
        <BarChart data={processedData.monthlyData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
         <CartesianGrid strokeDasharray="3 3" />
         <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
         <YAxis dataKey="month" type="category" interval={0} />
         <Tooltip
          formatter={(value) => [value.toLocaleString(), 'Sales']}
          labelStyle={{ color: '#111827' }}
         />
         <Bar dataKey="sales" fill="#0284c7" radius={[0, 4, 4, 0]} />
        </BarChart>
       </ResponsiveContainer>
      </div>

      {/* <div>
       <h4 style={{ color: '#111827', fontSize: '1.125rem', marginBottom: '1rem' }}>
        Weekly Sales Distribution
       </h4>
       <ResponsiveContainer width="100%" height={600}>
        <BarChart data={processedData.weeklyData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
         <CartesianGrid strokeDasharray="3 3" />
         <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
         <YAxis dataKey="week" type="category" width={80} tick={{ fontSize: 12 }} />
         <Tooltip
          formatter={(value) => [value.toLocaleString(), 'Sales']}
          labelStyle={{ color: '#111827' }}
         />
         <Bar dataKey="sales" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
        </BarChart>
       </ResponsiveContainer>
      </div> */}

      <div>
       <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <h4 style={{ color: '#111827', fontSize: '1.125rem', marginBottom: '1rem' }}>
         Growth Trend
        </h4>
       </div>
       <ResponsiveContainer width="100%" height={300}>
        <LineChart data={processedData.trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
         <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
         <XAxis dataKey="period" interval={0} />
         <YAxis tickFormatter={(value) => `${Number(value) / 1000}K`} />
         <Tooltip
          formatter={(value: number) => [value.toLocaleString(), "Sales"]}
          contentStyle={{ borderRadius: '0.375rem', border: '1px solid #e5e7eb' }}
         />
         <Line
          type="linear"
          dataKey="sales"
          stroke="#1e3a8a"
          strokeWidth={2}
          dot={{ fill: '#1e3a8a', strokeWidth: 2, r: 5 }}
          activeDot={{ r: 8 }}
         />
        </LineChart>
       </ResponsiveContainer>
      </div>
     </>
    )}
   </div>
  </div>
 );
};