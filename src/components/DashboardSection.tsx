import React, { useState, useEffect, useRef } from 'react';
import { BarChart2, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Layers, Award, Map, MapPin } from 'lucide-react';
import { CivicIssue } from '../types';
import Chart from 'chart.js/auto';

interface DashboardSectionProps {
  issues: CivicIssue[];
  heatmapEnabled: boolean;
  onToggleHeatmap: () => void;
  onSelectIssue: (issue: CivicIssue) => void;
}

export default function DashboardSection({
  issues,
  heatmapEnabled,
  onToggleHeatmap,
  onSelectIssue
}: DashboardSectionProps) {
  
  // Count animation states
  const [totalCount, setTotalCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [resolutionRate, setResolutionRate] = useState(0);

  // References
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<any | null>(null);

  // Compute stats
  const total = issues.length;
  const resolved = issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;
  const active = total - resolved;
  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Most common issue type
  const categoryCounts: Record<string, number> = {};
  issues.forEach(i => {
    categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
  });
  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories[0]?.[0] || 'None';

  // Most active neighborhood (district)
  const neighborhoodCounts: Record<string, number> = {};
  issues.forEach(i => {
    const mainArea = i.address.split(',')[0] || 'Unknown';
    neighborhoodCounts[mainArea] = (neighborhoodCounts[mainArea] || 0) + 1;
  });
  const sortedNeighborhoods = Object.entries(neighborhoodCounts).sort((a, b) => b[1] - a[1]);
  const topNeighborhood = sortedNeighborhoods[0]?.[0] || 'None';

  // Animate counts on tab open
  useEffect(() => {
    const duration = 800; // ms
    const steps = 40;
    const stepTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setTotalCount(Math.round((total / steps) * step));
      setResolvedCount(Math.round((resolved / steps) * step));
      setActiveCount(Math.round((active / steps) * step));
      setResolutionRate(Math.round((rate / steps) * step));

      if (step >= steps) {
        setTotalCount(total);
        setResolvedCount(resolved);
        setActiveCount(active);
        setResolutionRate(rate);
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [issues, total, resolved, active, rate]);

  // Render Chart.js
  useEffect(() => {
    if (chartRef.current) {
      // Destroy previous chart if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      // Prepare labels and counts
      const labels = ['Pothole 🕳️', 'Water Leak 💧', 'Streetlight 💡', 'Garbage 🗑️', 'Damaged Road 🛣️', 'Open Drain 🚯', 'Other 🔧'];
      const dataKeys = ['pothole', 'water leak', 'broken streetlight', 'garbage', 'damaged road', 'open drain', 'other'];
      const counts = dataKeys.map(k => issues.filter(i => i.category === k).length);

      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Report Count',
              data: counts,
              backgroundColor: [
                'rgba(59, 130, 246, 0.75)',  // Blue
                'rgba(6, 182, 212, 0.75)',   // Cyan
                'rgba(245, 158, 11, 0.75)',  // Amber
                'rgba(239, 68, 68, 0.75)',   // Coral
                'rgba(168, 85, 247, 0.75)',  // Purple
                'rgba(236, 72, 153, 0.75)',  // Pink
                'rgba(148, 163, 184, 0.75)'  // Slate
              ],
              borderColor: [
                '#3b82f6',
                '#06b6d4',
                '#f59e0b',
                '#ef4444',
                '#a855f7',
                '#ec4899',
                '#94a6b8'
              ],
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#f1f5f9',
                bodyColor: '#cbd5e1',
                borderColor: '#1e293b',
                borderWidth: 1,
                padding: 10
              }
            },
            scales: {
              y: {
                grid: {
                  color: 'rgba(51, 65, 85, 0.25)'
                },
                ticks: {
                  color: '#94a3b8',
                  font: {
                    family: 'Inter',
                    size: 11
                  },
                  stepSize: 1
                }
              },
              x: {
                grid: {
                  display: false
                },
                ticks: {
                  color: '#94a3b8',
                  font: {
                    family: 'Inter',
                    size: 10
                  }
                }
              }
            }
          }
        });
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [issues]);

  // Get trending issues (highest verifications)
  const trendingIssues = issues
    .slice()
    .sort((a, b) => b.verificationCount - a.verificationCount)
    .slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
      
      {/* Page Title & Heatmap Toggle banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-blue-500" />
            Impact & Analytics Dashboard
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Empirical tracking of civic issue density and resolving rates in real-time.
          </p>
        </div>

        {/* Heatmap controller button */}
        <button
          onClick={onToggleHeatmap}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition border shadow-md shrink-0 ${
            heatmapEnabled 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/5' 
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <Layers className={`w-4 h-4 ${heatmapEnabled ? 'animate-pulse' : ''}`} />
          {heatmapEnabled ? 'Disable Density Heatmap' : 'Enable Density Heatmap'}
        </button>
      </div>

      {/* STATS GRID (Adaptive responsiveness) */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total issues card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 hover:border-slate-700 transition">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Reports</p>
            <h3 className="text-2xl font-extrabold text-slate-100 font-sans tracking-tight mt-0.5">{totalCount}</h3>
          </div>
        </div>

        {/* Active issues card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 hover:border-slate-700 transition">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 shrink-0">
            <RefreshCw className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Damage</p>
            <h3 className="text-2xl font-extrabold text-slate-100 font-sans tracking-tight mt-0.5">{activeCount}</h3>
          </div>
        </div>

        {/* Resolved issues card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 hover:border-slate-700 transition">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Resolved</p>
            <h3 className="text-2xl font-extrabold text-slate-100 font-sans tracking-tight mt-0.5">{resolvedCount}</h3>
          </div>
        </div>

        {/* Resolution rate card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-4 hover:border-slate-700 transition">
          <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Resolution Rate</p>
            <h3 className="text-2xl font-extrabold text-slate-100 font-sans tracking-tight mt-0.5">{resolutionRate}%</h3>
          </div>
        </div>

      </div>

      {/* CHARTS & ANALYTICS BREAKDOWN ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart.js bar chart (Takes 2/3 space on Desktop) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col h-[320px]">
          <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-1.5 shrink-0">
            <BarChart2 className="w-4 h-4 text-blue-500" />
            Issue Category Frequency
          </h4>
          <div className="flex-1 relative w-full h-full min-h-0">
            <canvas ref={chartRef} className="w-full h-full" />
          </div>
        </div>

        {/* Side Panel: Demographics & Neighborhoods */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Hotspots & Trends
            </h4>

            {/* Top defect category */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Most Common Issue</span>
              <p className="text-slate-200 font-bold text-sm flex items-center gap-1">
                {topCategory.charAt(0).toUpperCase() + topCategory.slice(1)}
              </p>
            </div>

            {/* Top neighborhood */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Most Active District</span>
              <p className="text-slate-200 font-bold text-sm">
                {topNeighborhood}
              </p>
            </div>
          </div>

          <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-300 font-semibold block mb-0.5">ℹ️ Hotspot Density Info</strong>
            Density tracking works by mapping clustered report markers. Enabling the density filter overlay lets citizens identify zone safety.
          </div>
        </div>

      </div>

      {/* TRENDING ISSUES LIST (What is blowin' up) */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-200 flex items-center gap-1.5">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          Trending Community Grievances
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trendingIssues.length === 0 ? (
            <div className="col-span-3 py-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
              No trending reports active right now.
            </div>
          ) : (
            trendingIssues.map((issue) => (
              <div 
                key={issue.id}
                onClick={() => onSelectIssue(issue)}
                className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 cursor-pointer flex flex-col justify-between transition group h-40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold text-blue-400 capitalize">
                      {issue.category}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      🔥 {issue.verificationCount} verifications
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-2.5 line-clamp-3 group-hover:text-blue-300 transition leading-relaxed font-sans">
                    "{issue.description}"
                  </p>
                </div>
                
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-semibold pt-2 border-t border-slate-850 mt-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{issue.address.split(',')[0]}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
