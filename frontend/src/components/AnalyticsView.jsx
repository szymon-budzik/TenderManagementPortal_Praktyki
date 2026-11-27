import { useState, useEffect, useMemo } from 'react';
import AnalyticsDateHeader from './analytics/AnalyticsDateHeader';
import AnalyticsKpiGrid from './analytics/AnalyticsKpiGrid';
import BindingsBarChart from './analytics/BindingsBarChart';
import StatusDonutChart from './analytics/StatusDonutChart';
import ScoreBracketsChart from './analytics/ScoreBracketsChart';
import TimelineChart from './analytics/TimelineChart';
import {
  computeBindingsData,
  computeDateRangeForPreset,
  computeKpi,
  computeScoreBrackets,
  computeTimelineData,
  filterByDateRange,
} from './analytics/analyticsUtils';
import { getTenders } from '../services/tendersApi';
import { getKeywordCategories } from '../services/keywordsApi';
import { getSearchSources } from '../services/endpointsApi';
import { getRuns } from '../services/automationApi';
import { useAccessibleResources } from '../hooks/useAccessibleResources';

export default function AnalyticsView() {
  const [tenders, setTenders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const visibleCategories = useAccessibleResources('KEYWORDS', categories);
  const visibleEndpoints = useAccessibleResources('ENDPOINTS', endpoints);

  const [rangePreset, setRangePreset] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bindingMode, setBindingMode] = useState('CATEGORIES');

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [tendersData, keywordsData, endpointsData, runsData] = await Promise.all([
          getTenders({ page: 0, size: 2000 }),
          getKeywordCategories().catch(() => []),
          getSearchSources().catch(() => []),
          getRuns().catch(() => []),
        ]);
        setTenders(tendersData);
        setCategories(keywordsData);
        setEndpoints(endpointsData);
        setRuns(runsData);
      } catch (err) {
        console.error('Błąd ładowania danych analitycznych:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const applyPreset = (preset) => {
    setRangePreset(preset);
    const range = computeDateRangeForPreset(preset);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  };

  const filteredTenders = useMemo(
    () => filterByDateRange(tenders, 'publicationDate', dateFrom, dateTo),
    [tenders, dateFrom, dateTo]
  );

  const filteredRuns = useMemo(
    () => filterByDateRange(runs, 'createdAt', dateFrom, dateTo),
    [runs, dateFrom, dateTo]
  );

  const kpi = useMemo(
    () => computeKpi(filteredTenders, filteredRuns),
    [filteredTenders, filteredRuns]
  );

  const bindingsData = useMemo(
    () => computeBindingsData(filteredTenders, visibleCategories, visibleEndpoints, bindingMode),
    [filteredTenders, visibleCategories, visibleEndpoints, bindingMode]
  );

  const scoreBrackets = useMemo(() => computeScoreBrackets(filteredTenders), [filteredTenders]);
  const timelineData = useMemo(() => computeTimelineData(filteredTenders), [filteredTenders]);

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-xl border border-blue-200 font-bold text-black">
        Ładowanie danych analitycznych i generowanie wykresów 3D...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-black">
      <AnalyticsDateHeader
        rangePreset={rangePreset}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onApplyPreset={applyPreset}
        onDateFromChange={(val) => {
          setDateFrom(val);
          setRangePreset('CUSTOM');
        }}
        onDateToChange={(val) => {
          setDateTo(val);
          setRangePreset('CUSTOM');
        }}
      />

      <AnalyticsKpiGrid kpi={kpi} totalTendersInDb={tenders.length} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <BindingsBarChart
          bindingsData={bindingsData}
          bindingMode={bindingMode}
          onBindingModeChange={setBindingMode}
        />
        <StatusDonutChart kpi={kpi} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ScoreBracketsChart scoreBrackets={scoreBrackets} />
        <TimelineChart timelineData={timelineData} />
      </div>
    </div>
  );
}
