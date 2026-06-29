import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CivicIssue } from '../types';

interface MapSectionProps {
  issues: CivicIssue[];
  onSelectIssue: (issue: CivicIssue) => void;
  heatmapEnabled: boolean;
  mapCenter: [number, number];
  onReportClick: () => void;
}

// Generate beautiful custom Leaflet DivIcons based on category and severity
const createCustomMarkerIcon = (category: string, severity: string) => {
  const colorMap = {
    low: '#10b981',       // Emerald
    medium: '#f59e0b',    // Amber
    high: '#f97316',      // Orange
    critical: '#ef4444'   // Rose
  };
  const color = colorMap[severity as keyof typeof colorMap] || '#3b82f6';
  
  const emojiMap = {
    pothole: '🕳️',
    'water leak': '💧',
    'broken streetlight': '💡',
    garbage: '🗑️',
    'damaged road': '🛣️',
    'open drain': '🚯',
    other: '🔧'
  };
  const emoji = emojiMap[category as keyof typeof emojiMap] || '🔧';
  
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-10 h-10 cursor-pointer">
        <!-- Floating core emoji inside colored ring -->
        <div class="absolute w-8 h-8 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-xl text-base transition-transform hover:scale-110" style="background-color: ${color}">
          ${emoji}
        </div>
        <!-- Urgency pulsing ring for high/critical issues -->
        ${severity === 'critical' || severity === 'high' ? `
          <div class="absolute w-8 h-8 rounded-full animate-ping opacity-40" style="background-color: ${color}"></div>
        ` : ''}
        <!-- Tiny anchor leg -->
        <div class="absolute bottom-0 w-1.5 h-1.5 rounded-full border border-slate-900" style="background-color: ${color}; transform: translateY(12px)"></div>
      </div>
    `,
    className: 'custom-civicmind-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 36],
    popupAnchor: [0, -32]
  });
};

// Custom styled cluster bubble marker icon
const createClusterIcon = (count: number, highestSeverity: string) => {
  const colorMap = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    critical: '#ef4444'
  };
  const color = colorMap[highestSeverity as keyof typeof colorMap] || '#3b82f6';

  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-12 h-12 cursor-pointer">
        <!-- Main Bubble circle -->
        <div class="absolute w-10 h-10 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-2xl font-bold text-xs text-white" style="background-color: ${color}">
          +${count}
        </div>
        <!-- Double ring pulse -->
        <div class="absolute w-12 h-12 rounded-full animate-ping opacity-25" style="background-color: ${color}"></div>
      </div>
    `,
    className: 'custom-civicmind-cluster',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
};

export default function MapSection({
  issues,
  onSelectIssue,
  heatmapEnabled,
  mapCenter,
  onReportClick
}: MapSectionProps) {
  
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const heatLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstance.current) {
      // Create Map
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(mapCenter, 14);

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Force .dark-map filter styling class to Leaflet container
      L.DomUtil.addClass(mapContainerRef.current, 'dark-map');

      // Put zoom control in top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Set references
      mapInstance.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
      heatLayerGroupRef.current = L.layerGroup().addTo(map);

      // Trigger standard Leaflet size recalculation to prevent gray tiles on canvas mount
      setTimeout(() => {
        map.invalidateSize();
      }, 300);
    }

    return () => {
      if (mapInstance.current) {
        try {
          mapInstance.current.eachLayer((layer: any) => {
            if (layer.closeTooltip) {
              layer.closeTooltip();
            }
          });
        } catch (e) {}
        mapInstance.current.remove();
        mapInstance.current = null;
        markersGroupRef.current = null;
        heatLayerGroupRef.current = null;
      }
    };
  }, []);

  // Sync zoom/re-center when mapCenter changes
  useEffect(() => {
    if (mapInstance.current) {
      mapInstance.current.setView(mapCenter, 14);
    }
  }, [mapCenter]);

  // Handle markers and custom grid clustering depending on zoom levels
  useEffect(() => {
    const map = mapInstance.current;
    const markersGroup = markersGroupRef.current;
    const heatGroup = heatLayerGroupRef.current;
    
    if (!map || !markersGroup || !heatGroup) return;

    const renderMarkersAndHeat = () => {
      // Safely close and unbind any active tooltips to prevent leaflet position errors (_leaflet_pos) during clear
      if (markersGroup) {
        try {
          markersGroup.eachLayer((layer: any) => {
            if (layer.closeTooltip) {
              layer.closeTooltip();
            }
            if (layer.unbindTooltip) {
              layer.unbindTooltip();
            }
          });
        } catch (e) {}
      }

      // Clear previous layers
      markersGroup.clearLayers();
      heatGroup.clearLayers();

      const zoom = map.getZoom();

      // 1. DENSITY HEATMAP LAYER
      if (heatmapEnabled) {
        issues.forEach((issue) => {
          // Map severity to heat density weights
          const heatWeights = { low: 150, medium: 250, high: 350, critical: 450 };
          const radius = heatWeights[issue.severity] || 250;
          const colorMap = { low: '#10b981', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
          const color = colorMap[issue.severity] || '#3b82f6';

          // Translucent overlapping glowing hot zones
          L.circle([issue.lat, issue.lng], {
            radius: radius,
            color: color,
            weight: 0.5,
            fillColor: color,
            fillOpacity: 0.16,
            interactive: false
          }).addTo(heatGroup);
        });
      }

      // 2. LIGHTWEIGHT CUSTOM GRID CLUSTERING
      // Grid clustering rounding threshold based on zoom level.
      // Zoom out more -> larger cluster grid cells.
      if (zoom < 14) {
        // Simple 2D coordinate rounding clusterer
        const gridSize = zoom <= 10 ? 0.03 : zoom <= 12 ? 0.012 : 0.005; // degree cells
        const cells: Record<string, CivicIssue[]> = {};

        issues.forEach((issue) => {
          const cellLat = Math.round(issue.lat / gridSize) * gridSize;
          const cellLng = Math.round(issue.lng / gridSize) * gridSize;
          const key = `${cellLat}_${cellLng}`;

          if (!cells[key]) {
            cells[key] = [];
          }
          cells[key].push(issue);
        });

        // Add cluster or individual pins
        Object.entries(cells).forEach(([key, cellIssues]) => {
          const [cellLat, cellLng] = key.split('_').map(Number);

          if (cellIssues.length === 1) {
            // Render single issue marker
            const issue = cellIssues[0];
            const marker = L.marker([issue.lat, issue.lng], {
              icon: createCustomMarkerIcon(issue.category, issue.severity)
            });

            // Bind click
            marker.on('click', () => onSelectIssue(issue));
            
            // Marker tooltip on hover
            marker.bindTooltip(`
              <div class="p-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 flex items-center gap-2">
                <span class="text-sm shrink-0">${issue.imageUrl ? `<img src="${issue.imageUrl}" class="w-8 h-8 rounded object-cover"/>` : '🔧'}</span>
                <div>
                  <p class="font-bold text-xs uppercase text-slate-300 leading-none">${issue.category}</p>
                  <p class="text-[9px] text-slate-500 font-semibold mt-1 leading-none">Severity: ${issue.severity}</p>
                </div>
              </div>
            `, { 
              direction: 'top', 
              opacity: 0.95,
              className: 'custom-tooltip-leaflet border-none bg-transparent shadow-none'
            });

            marker.addTo(markersGroup);
          } else {
            // Render cluster circle marker
            // Determine highest severity in cluster to color code bubble
            let highestSeverity: CivicIssue['severity'] = 'low';
            const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
            
            cellIssues.forEach((ci) => {
              if (severityOrder[ci.severity] > severityOrder[highestSeverity]) {
                highestSeverity = ci.severity;
              }
            });

            const marker = L.marker([cellLat, cellLng], {
              icon: createClusterIcon(cellIssues.length, highestSeverity)
            });

            // Click zooms into map center
            marker.on('click', () => {
              map.setView([cellLat, cellLng], zoom + 2);
            });

            marker.addTo(markersGroup);
          }
        });
      } else {
        // Individual markers if zoomed in
        issues.forEach((issue) => {
          const marker = L.marker([issue.lat, issue.lng], {
            icon: createCustomMarkerIcon(issue.category, issue.severity)
          });

          marker.on('click', () => onSelectIssue(issue));

          // Hover popups
          marker.bindTooltip(`
            <div class="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 flex items-center gap-2 font-sans">
              ${issue.imageUrl ? `<img src="${issue.imageUrl}" class="w-10 h-10 rounded object-cover border border-slate-800 shrink-0"/>` : ''}
              <div class="leading-snug">
                <p class="font-bold text-[11px] uppercase tracking-wide text-slate-200 leading-none">${issue.category}</p>
                <p class="text-[9px] text-slate-400 mt-1 line-clamp-1">"${issue.description}"</p>
                <p class="text-[8px] text-slate-500 font-semibold mt-0.5">${issue.address.split(',')[0]}</p>
              </div>
            </div>
          `, { 
            direction: 'top', 
            opacity: 0.98,
            className: 'custom-tooltip-leaflet border-none bg-transparent shadow-none'
          });

          marker.addTo(markersGroup);
        });
      }
    };

    // Render immediately
    renderMarkersAndHeat();

    // Re-render when map zoom changes to handle cluster transitions
    map.on('zoomend', renderMarkersAndHeat);

    return () => {
      map.off('zoomend', renderMarkersAndHeat);
    };
  }, [issues, heatmapEnabled]);

  // Recalculate container size to prevent grey boxes during side drawers opening
  useEffect(() => {
    const handleResize = () => {
      if (mapInstance.current) {
        mapInstance.current.invalidateSize();
      }
    };

    // Listen to window size changes
    window.addEventListener('resize', handleResize);
    
    // Also run a small interval for transitions of the layout panels
    const interval = setInterval(handleResize, 100);
    const timeout = setTimeout(() => clearInterval(interval), 1000);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [issues]);

  return (
    <div className="flex-1 w-full h-full relative z-0">
      
      {/* Actual Map Canvas Div */}
      <div 
        ref={mapContainerRef} 
        id="civicmind-leaflet-map" 
        className="w-full h-full min-h-0 bg-slate-950 outline-none"
      ></div>

      {/* Floating Watermark logo in corner (Humble, professional, no tech-larping logs) */}
      <div className="absolute bottom-6 left-6 z-10 p-2.5 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800 flex items-center gap-2 pointer-events-none shadow-xl">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="text-[10px] font-bold text-slate-300 font-mono tracking-wider uppercase">
          Live Wards Sync Connected
        </span>
      </div>

    </div>
  );
}
