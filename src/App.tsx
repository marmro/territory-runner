import { useState, useEffect, FormEvent } from 'react';
import { Search, MapPin, User, Calendar, Truck, Loader2, Map as MapIcon, Trash2, AlertCircle, Navigation } from 'lucide-react';
import { cn } from './lib/utils';
import { GoogleGenAI, Type } from '@google/genai';
import { ComposableMap, Geographies, Geography, Marker, Line } from "react-simple-maps";
import { GoogleMap, useJsApiLoader, Marker as GoogleMarker, DirectionsService, DirectionsRenderer } from '@react-google-maps/api';

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AURORA_COORDS: [number, number] = [-104.7745, 39.7717];
const AURORA_COORDS_OBJ = { lng: -104.7745, lat: 39.7717 };

const GOOGLE_MAPS_STYLING = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
];

const BLACK_DOT_ICON_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMCIgY3k9IjEwIiByPSI2IiBmaWxsPSJibGFjayIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9zdmc+';

const CITY_COORDINATES: Record<string, [number, number]> = {
  'Idaho Springs, CO': [-105.5136, 39.7425],
  'Grand Junction, CO': [-108.5506, 39.0639],
  'Cheyenne, WY': [-104.8202, 41.1400],
  'Casper, WY': [-106.3252, 42.8666],
  'Fort Collins, CO': [-105.0844, 40.5853],
  'Pueblo, CO': [-104.6091, 38.2544],
  'Laramie, WY': [-105.5911, 41.3114],
  'Denver, CO': [-104.9903, 39.7392],
  'Boulder, CO': [-105.2705, 40.0150],
  'Colorado Springs, CO': [-104.8214, 38.8339],
  'Buena Vista, CO': [-106.1311, 38.8422],
  'Canon City, CO': [-105.2425, 38.4410],
  'Arkansas Valley, CO': [-103.5438, 38.0517],
  'Woodland Park, CO': [-105.0569, 38.9939],
  'Greeley, CO': [-104.6950, 40.4233],
  'Longmont, CO': [-105.1019, 40.1672],
  'DIA, CO': [-104.6737, 39.8561],
  'Ft. Morgan / Sterling, CO': [-103.8000, 40.2503],
  'Aurora, CO': [-104.8319, 39.7294],
  'Lakewood/Golden/Arvada, CO': [-105.1200, 39.7500],
  'Highlands Ranch, CO': [-104.9680, 39.5500],
  'Lone Tree / Castle Rock, CO': [-104.8758, 39.4500],
  'Downtown, CO': [-104.9903, 39.7392],
  'Steamboat Springs, CO': [-106.8317, 40.4850],
};

function getCoordinates(city: string): [number, number] | null {
  if (CITY_COORDINATES[city]) return CITY_COORDINATES[city];
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (city.toLowerCase().includes(key.split(',')[0].toLowerCase())) {
      return coords;
    }
  }
  return null;
}

function getNextDeliveryDay(scheduleStr: string): string | null {
  const schedule = scheduleStr.toLowerCase();
  const now = new Date();
  const today = now.getDay();

  if (schedule.includes('daily') || schedule.includes('every day')) {
    if (today === 6) return 'Monday';
    return 'Tomorrow';
  }

  const JS_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysInSchedule: number[] = [];

  JS_DAYS.forEach((day, index) => {
    if (schedule.includes(day.toLowerCase())) {
      daysInSchedule.push(index);
    }
  });

  if (daysInSchedule.length === 0) return null;

  const nextDayIndex = daysInSchedule.find(day => day > today);

  if (nextDayIndex !== undefined) {
    if (nextDayIndex === today + 1) return 'Tomorrow';
    return JS_DAYS[nextDayIndex];
  }

  return JS_DAYS[daysInSchedule[0]];
}

interface Territory {
  id: number;
  name: string;
  city: string;
  schedule: string;
  matchReason?: string;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Territory[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'search' | 'list' | 'map'>('search');
  const [editingTerritory, setEditingTerritory] = useState<Territory | null>(null);
  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);
  const [newTerritory, setNewTerritory] = useState({ name: '', city: '', schedule: '' });
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeError, setPasscodeError] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [selectedRouteForMap, setSelectedRouteForMap] = useState<Territory | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey || ''
  });

  const handlePasscodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passcode })
      });
      const data = await res.json();
      if (data.success && data.token) {
        setAdminToken(data.token);
        setIsAuthenticated(true);
        setShowPasscodeModal(false);
        setPasscodeError(false);
      } else {
        setPasscodeError(true);
        setPasscode('');
      }
    } catch (err) {
      console.error('Login error:', err);
      setPasscodeError(true);
      setPasscode('');
    }
  };

  const toggleDay = (day: string) => {
    const updated = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day];
    setSelectedDays(updated);
    const sorted = [...updated].sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b));
    const scheduleStr = sorted.length === 6 ? 'Every Day' : sorted.join(', ');
    setNewTerritory(prev => ({ ...prev, schedule: scheduleStr }));
  };

  const fetchAllTerritories = async () => {
    try {
      const res = await fetch('/api/territories/all');
      if (res.ok) setAllTerritories(await res.json());
    } catch (err) {
      console.error('Error fetching all territories:', err);
    }
  };

  useEffect(() => {
    if (viewMode === 'list' || viewMode === 'map') {
      fetchAllTerritories();
    }
  }, [viewMode]);

  const handleAddTerritory = async (e: FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    try {
      const url = editingTerritory ? `/api/territories/${editingTerritory.id}` : '/api/territories';
      const method = editingTerritory ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken || ''
        },
        body: JSON.stringify(newTerritory),
      });
      if (response.ok) {
        setNewTerritory({ name: '', city: '', schedule: '' });
        setEditingTerritory(null);
        setIsAdminOpen(false);
        if (viewMode === 'list') fetchAllTerritories();
        if (query) {
          const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          if (searchRes.ok) setResults(await searchRes.json());
        }
      }
    } catch (error) {
      console.error('Error saving territory:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteTerritory = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await fetch(`/api/territories/${deleteConfirmId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': adminToken || '' }
      });
      if (res.ok) {
        fetchAllTerritories();
        if (query) setResults(results.filter(t => t.id !== deleteConfirmId));
        setDeleteConfirmId(null);
      }
    } catch (error) {
      console.error('Error deleting territory:', error);
    }
  };

  const openEditModal = (territory: Territory) => {
    setEditingTerritory(territory);
    const safeSchedule = territory.schedule || '';
    let scheduleDays = safeSchedule.split(',').map(d => d.trim()).filter(d => DAYS_OF_WEEK.includes(d));
    if (safeSchedule.toLowerCase().includes('every day') || safeSchedule.toLowerCase().includes('daily')) {
      scheduleDays = [...DAYS_OF_WEEK];
    }
    setSelectedDays(scheduleDays);
    setNewTerritory({
      name: territory.name || '',
      city: territory.city || '',
      schedule: scheduleDays.length === 6 ? 'Every Day' : safeSchedule
    });
    setIsAdminOpen(true);
  };

  const openAddModal = () => {
    setEditingTerritory(null);
    setSelectedDays([]);
    setNewTerritory({ name: '', city: '', schedule: '' });
    setIsAdminOpen(true);
  };

  useEffect(() => {
    const searchTerritories = async () => {
      if (!query.trim()) {
        setResults([]);
        setSearchMessage(null);
        setHasSearched(false);
        return;
      }
      setIsSearching(true);
      setSearchMessage(null);
      setHasSearched(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          let data = await response.json();
          if (data.length === 0) {
            try {
              const allRes = await fetch('/api/territories/all');
              if (allRes.ok) {
                const allTerritories: Territory[] = await allRes.json();
                const prompt = `
                  A user is searching for a delivery territory with the query: "${query}".
                  IMPORTANT CONSTRAINTS:
                  1. The starting point (terminal) for all routes is 18100 E 40th Ave #20, Aurora, CO 80011.
                  2. STRICT STATE LIMIT: Only consider locations within Colorado (CO) and Wyoming (WY).
                  3. Use "on the way" logic.
                  4. SPECIFIC ROUTING RULE: Any stop between Idaho Springs and Estes Park must be matched to "Clear Creek" (Idaho Springs), NOT "Flatirons" (Boulder).
                  5. CHAIN RESTAURANTS: If only ONE location in CO/WY, match it. If MULTIPLE, return matchId: 0 and ask to specify city.
                  Here is our list of available territories (ID, Name, City, Schedule):
                  ${allTerritories.map(t => `- ID ${t.id}: ${t.name}: ${t.city}: ${t.schedule}`).join('\n')}
                  Return a JSON object with matchId, reason, and message fields.
                `;
                const engine = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
                const engineRes = await engine.models.generateContent({
                  model: 'gemini-2.0-flash',
                  contents: prompt,
                  config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                        matchId: { type: Type.INTEGER },
                        reason: { type: Type.STRING },
                        message: { type: Type.STRING }
                      }
                    }
                  }
                });
                const matchData = JSON.parse(engineRes.text || '{}');
                if (matchData.matchId > 0) {
                  const match = allTerritories.find(t => t.id === matchData.matchId);
                  if (match) data = [{ ...match, matchReason: matchData.reason }];
                } else if (matchData.message) {
                  setSearchMessage(matchData.message);
                }
              }
            } catch (smartErr) {
              console.error('Smart search error:', smartErr);
            }
          }
          setResults(data);
        }
      } catch (error) {
        console.error('Error searching territories:', error);
      } finally {
        setIsSearching(false);
      }
    };
    const debounceTimer = setTimeout(searchTerritories, 800);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  return (
    
    </div>

      {/* Admin Controls / Login */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-3">
        <div className="flex bg-white/80 backdrop-blur-md rounded-xl border border-black/5 shadow-sm overflow-hidden">
          <button onClick={() => setViewMode('search')} className={cn("px-4 py-2 text-[10px] font-bold tracking-[0.05em] transition-all", viewMode === 'search' ? "bg-black text-white" : "text-black/40 hover:bg-black/5")}>Search</button>
          <button onClick={() => setViewMode('list')} className={cn("px-4 py-2 text-[10px] font-bold tracking-[0.05em] transition-all border-l border-black/5", viewMode === 'list' ? "bg-black text-white" : "text-black/40 hover:bg-black/5")}>List</button>
          <button onClick={() => setViewMode('map')} className={cn("px-4 py-2 text-[10px] font-bold tracking-[0.05em] transition-all border-l border-black/5", viewMode === 'map' ? "bg-black text-white" : "text-black/40 hover:bg-black/5")}>Map</button>
        </div>
        {isAuthenticated ? (
          <>
            <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
              <Truck size={12} />
              Add Route
            </button>
            <button onClick={() => setIsAuthenticated(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 text-black/20 transition-all border border-black/5 bg-white">✕</button>
          </>
        ) : (
          <button onClick={() => setShowPasscodeModal(true)} className="text-[10px] font-bold text-black/40 hover:text-black transition-all tracking-[0.05em] px-4 py-2 rounded-xl border border-black/5 hover:bg-white">Admin</button>
        )}
      </div>

      {/* Header */}
      <header className={cn("shrink-0 transition-all duration-700 ease-in-out", (hasSearched && viewMode === 'search') || viewMode !== 'search' ? "pt-12 pb-6" : "pt-24 pb-12")}>
        <div className="max-w-5xl mx-auto px-4 flex flex-col items-center animate-in">
          <img
            src="https://lh3.googleusercontent.com/d/1VHuYwtFmDDPzVJZdmDa56K2E_MkGuSIO"
            alt="Logo"
            className={cn("w-auto transition-all duration-700 grayscale contrast-125 opacity-80", (hasSearched && viewMode === 'search') || viewMode !== 'search' ? "h-10 mb-2" : "h-20 mb-6")}
            referrerPolicy="no-referrer"
          />
          <div className="text-center">
            <h1 className={cn("font-bold text-black tracking-tight transition-all duration-700", (hasSearched && viewMode === 'search') || viewMode !== 'search' ? "text-lg" : "text-3xl")}>Find Your Delivery Route</h1>
            <p className={cn("text-black/40 font-medium transition-all duration-700 mt-2", (hasSearched && viewMode === 'search') || viewMode !== 'search' ? "text-xs opacity-0 h-0 overflow-hidden" : "text-sm opacity-100")}>Enter your city, zip code, or customer name to find your delivery schedule.</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12">
        <div className="h-full max-w-2xl mx-auto flex flex-col">
          {viewMode === 'search' ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-8 animate-in">
              <div className="relative shrink-0">
                <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-black/20 pointer-events-none z-10" />
                <input
                  type="text"
                  className={cn("input-field !pl-16 py-6 text-lg shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 bg-white", isSearching && "border-black/20 ring-4 ring-black/5")}
                  placeholder="Enter city, region, or customer name..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {isSearching && <div className="absolute inset-y-0 right-0 pr-6 flex items-center text-black/40"><Loader2 size={18} className="animate-spin" /></div>}
                {isSearching && <div className="absolute -bottom-4 left-0 w-full h-[2px] bg-black/5 overflow-hidden rounded-full"><div className="h-full w-1/2 bg-black animate-progress rounded-full" /></div>}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                {!hasSearched ? (
                  <div className="h-full flex flex-col items-center justify-center text-black/10">
                    <div className="w-16 h-16 rounded-full border border-black/5 flex items-center justify-center mb-4">
                      <MapPin size={28} className="opacity-20" />
                    </div>
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-4 pb-8">
                    {results.map((territory) => {
                      const nextDay = getNextDeliveryDay(territory.schedule);
                      return (
                        <div key={territory.id} className="card group bg-white flex flex-col gap-5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-[10px] font-bold text-black/30 tracking-wider">{territory.city}</span>
                              {territory.matchReason && <span className="text-[8px] font-bold text-black tracking-wider bg-black/5 px-2 py-0.5 rounded-full">Verified Match</span>}
                            </div>
                            <h3 className="text-xl font-bold text-black tracking-tight mb-1">{territory.name}</h3>
                            {territory.matchReason && <p className="text-[11px] text-black/40 font-medium italic">{territory.matchReason}</p>}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-black/5">
                            <div className="flex items-center gap-4">
                              <div className="bg-black/5 px-4 py-2.5 rounded-xl">
                                <div className="text-[8px] font-bold text-black/40 tracking-wider leading-none mb-1.5">Schedule</div>
                                <div className="text-sm font-black text-black leading-none">{territory.schedule}</div>
                              </div>
                              {nextDay && (
                                <div className="bg-black text-white px-4 py-2.5 rounded-xl shadow-lg shadow-black/10">
                                  <div className="text-[8px] font-bold text-white/40 tracking-wider leading-none mb-1.5">Next Run</div>
                                  <div className="text-sm font-black leading-none">{nextDay}</div>
                                </div>
                              )}
                            </div>
                            <button onClick={() => setSelectedRouteForMap(territory)} className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-black/40 hover:text-black transition-all group/btn">
                              <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center group-hover/btn:bg-black group-hover/btn:text-white transition-all"><Navigation size={12} /></div>
                              View Route Map
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : searchMessage ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6">
                    <div className="bg-black/5 rounded-2xl p-6 max-w-sm">
                      <p className="text-sm font-medium text-black/60 leading-relaxed">{searchMessage}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-black/20">
                    <p className="text-[10px] font-bold tracking-[0.1em]">No routes found</p>
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === 'map' ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-6 animate-in">
              <div className="bg-white rounded-3xl border border-black/5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.1)] p-6 flex-1 min-h-0 overflow-hidden relative">
                <ComposableMap projection="geoMercator" projectionConfig={{ scale: 4500, center: [-105.5, 40.5] }} className="w-full h-full">
                  <Geographies geography={geoUrl}>
                    {({ geographies }) => geographies.map(geo => {
                      const isTargetState = geo.properties.name === "Colorado" || geo.properties.name === "Wyoming";
                      return <Geography key={geo.rsmKey} geography={geo} fill={isTargetState ? "#f5f5f5" : "#ffffff"} stroke="#cccccc" strokeWidth={isTargetState ? 1.5 : 0.5} />;
                    })}
                  </Geographies>
                  {allTerritories.map(t => {
                    const coords = getCoordinates(t.city);
                    if (!coords) return null;
                    return (
                      <g key={t.id}>
                        <Line from={AURORA_COORDS} to={coords} stroke="#000000" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="4,4" opacity={0.3} />
                        <Marker coordinates={coords}>
                          <circle r={4} fill="#000" stroke="#fff" strokeWidth={2} />
                          <text textAnchor="middle" y={-12} style={{ fontFamily: "Inter", fill: "#000", fontSize: "10px", fontWeight: "700", letterSpacing: "-0.02em" }}>{t.city.split(',')[0]}</text>
                        </Marker>
                      </g>
                    );
                  })}
                  <Marker coordinates={AURORA_COORDS}>
                    <circle r={5} fill="#000" />
                    <text textAnchor="middle" y={18} style={{ fontFamily: "Inter", fill: "#000", fontSize: "10px", fontWeight: "900", letterSpacing: "0.05em" }}>Terminal</text>
                  </Marker>
                </ComposableMap>
              </div>
            </div>
          ) : viewMode === 'list' ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-6 animate-in">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-[11px] font-bold text-black/30 tracking-[0.1em]">All Routes</h2>
                <span className="text-[10px] font-bold text-black/20 tracking-wider">{allTerritories.length} Total</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                {allTerritories.map((t) => (
                  <div key={t.id} className="bg-white p-5 rounded-2xl border border-black/5 flex items-center justify-between gap-6 shadow-sm hover:shadow-md transition-all">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold text-black">{t.name}</span>
                        <span className="text-black/10">•</span>
                        <span className="text-[10px] font-bold text-black/30 tracking-wider">{t.city}</span>
                      </div>
                      <div className="text-[11px] font-normal text-black/40 font-mono">{t.schedule}</div>
                    </div>
                    {isAuthenticated && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditModal(t)} className="p-2.5 text-black/20 hover:text-black hover:bg-black/5 rounded-xl transition-all"><User size={16} /></button>
                        <button onClick={() => handleDeleteTerritory(t.id)} className="p-2.5 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete Route"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <footer className="py-6 text-center text-black/30 text-xs font-medium">Made with ❤️ by Marcin.</footer>

      {/* Passcode Modal */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-black/5">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-black">Admin Access</h2>
                  <p className="text-[10px] text-black/30 tracking-[0.05em] mt-1">Enter PIN to continue</p>
                </div>
                <button onClick={() => { setShowPasscodeModal(false); setPasscodeError(false); setPasscode(''); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 text-black/20 transition-all">✕</button>
              </div>
              <form onSubmit={handlePasscodeSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-black/30 tracking-wider ml-1">Passcode</label>
                  <input
                    autoFocus
                    required
                    type="password"
                    className={cn("input-field text-center text-2xl tracking-[1em] font-bold", passcodeError && "border-red-500 ring-4 ring-red-500/5")}
                    placeholder="••••••"
                    maxLength={6}
                    value={passcode}
                    onChange={(e) => { setPasscode(e.target.value); setPasscodeError(false); }}
                  />
                  {passcodeError && <p className="text-[10px] text-red-500 font-bold tracking-wider text-center mt-2">Incorrect Passcode</p>}
                </div>
                <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-bold text-xs tracking-[0.05em] hover:bg-black/90 transition-all shadow-xl shadow-black/10">Verify Access</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-black/5">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-black">{editingTerritory ? 'Edit Route' : 'New Route'}</h2>
                  <p className="text-[10px] text-black/30 tracking-[0.05em] mt-1">Route Configuration</p>
                </div>
                <div className="flex items-center gap-2">
                  {editingTerritory && (
                    <button onClick={() => { setIsAdminOpen(false); handleDeleteTerritory(editingTerritory.id); }} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 text-red-500 transition-all" title="Delete Route"><Trash2 size={18} /></button>
                  )}
                  <button onClick={() => setIsAdminOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 text-black/20 transition-all">✕</button>
                </div>
              </div>
              <form onSubmit={handleAddTerritory} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-black/30 tracking-wider ml-1">Route Name</label>
                  <input required type="text" className="input-field" placeholder="e.g. I-70 West Route" value={newTerritory.name} onChange={(e) => setNewTerritory({ ...newTerritory, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-black/30 tracking-wider ml-1">City / Region</label>
                  <input required type="text" className="input-field" placeholder="e.g. Denver, CO" value={newTerritory.city} onChange={(e) => setNewTerritory({ ...newTerritory, city: e.target.value })} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-black/30 tracking-wider ml-1">Delivery Days</label>
                  <div className="grid grid-cols-4 gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button key={day} type="button" onClick={() => toggleDay(day)} className={cn("px-2 py-2.5 rounded-xl text-[10px] font-bold tracking-wider transition-all border", selectedDays.includes(day) ? "bg-black border-black text-white shadow-lg shadow-black/10" : "bg-white border-black/5 text-black/30 hover:border-black/20")}>{day.slice(0, 3)}</button>
                    ))}
                  </div>
                  <input required type="hidden" value={newTerritory.schedule} />
                  {newTerritory.schedule && <p className="text-[10px] text-black font-bold tracking-wider mt-2 px-1 opacity-40">{newTerritory.schedule}</p>}
                </div>
                <button disabled={isAdding} type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-bold text-xs tracking-[0.05em] hover:bg-black/90 transition-all disabled:opacity-50 shadow-xl shadow-black/10">
                  {isAdding ? 'Processing...' : editingTerritory ? 'Update Route' : 'Create Route'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-black/5">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={32} /></div>
              <h2 className="text-xl font-bold text-black mb-2">Delete Route?</h2>
              <p className="text-sm text-black/40 mb-8">This action cannot be undone. Are you sure you want to permanently remove this route?</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="py-4 bg-black/5 text-black rounded-2xl font-bold text-xs tracking-[0.05em] hover:bg-black/10 transition-all">Cancel</button>
                <button onClick={confirmDelete} className="py-4 bg-red-500 text-white rounded-2xl font-bold text-xs tracking-[0.05em] hover:bg-red-600 transition-all shadow-xl shadow-red-500/20">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Map Route Modal */}
      {selectedRouteForMap && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl h-[85vh] overflow-hidden border border-black/5 flex flex-col">
            <div className="p-8 border-b border-black/5 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-2xl font-black text-black tracking-tight italic">{selectedRouteForMap.name}</h2>
                <p className="text-[10px] text-black/30 tracking-[0.1em] font-bold mt-1">Route from Aurora Terminal to {selectedRouteForMap.city}</p>
              </div>
              <button onClick={() => { setSelectedRouteForMap(null); setDirectionsResponse(null); setDirectionsError(null); }} className="w-12 h-12 flex items-center justify-center rounded-full bg-black/5 hover:bg-black hover:text-white transition-all">✕</button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="w-80 border-r border-black/5 p-8 flex flex-col gap-8 overflow-y-auto bg-white shrink-0">
                <div className="space-y-6">
                  <div>
                    <div className="text-[10px] font-bold text-black/30 tracking-[0.1em] mb-3">Delivery Schedule</div>
                    <div className="text-xl font-black italic leading-tight text-black">{selectedRouteForMap.schedule}</div>
                  </div>
                  <div className="bg-black text-white p-6 rounded-3xl shadow-xl shadow-black/10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Calendar size={18} /></div>
                      <div>
                        <div className="text-[9px] font-bold text-white/40 tracking-widest">Next Run</div>
                        <div className="text-sm font-bold">{getNextDeliveryDay(selectedRouteForMap.schedule) || 'Contact for info'}</div>
                      </div>
                    </div>
                    <div className="h-px bg-white/10 w-full mb-4" />
                    <p className="text-[10px] text-white/60 leading-relaxed italic">Routes are subject to weather conditions and terminal capacity.</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-[10px] font-bold text-black/30 tracking-[0.1em]">Route Details</div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs font-medium text-black/60"><div className="w-2 h-2 rounded-full bg-black" /><span>Origin: Aurora Terminal</span></div>
                    <div className="flex items-center gap-3 text-xs font-medium text-black/60"><div className="w-2 h-2 rounded-full bg-black/20" /><span>Destination: {selectedRouteForMap.city}</span></div>
                  </div>
                </div>
              </div>
              <div className="flex-1 relative bg-[#f5f5f5]">
                {!googleMapsApiKey ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center mb-6"><AlertCircle className="text-black/20" size={32} /></div>
                    <h3 className="text-lg font-bold text-black mb-2">API Key Required</h3>
                    <p className="text-sm text-black/40 max-w-xs leading-relaxed">Please add your <code className="bg-black/5 px-1 rounded text-black/60">VITE_GOOGLE_MAPS_API_KEY</code> to the Secrets panel.</p>
                  </div>
                ) : loadError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6"><AlertCircle className="text-red-500/40" size={32} /></div>
                    <h3 className="text-lg font-bold text-black mb-2">Map Configuration Error</h3>
                    <p className="text-sm text-black/40 max-w-sm leading-relaxed">Your API key is blocked. Please check your <span className="font-bold text-black/60">Google Cloud Console</span>.</p>
                  </div>
                ) : isLoaded ? (
                  <div className="w-full h-full relative">
                    {directionsError === 'REQUEST_DENIED' && (
                      <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex items-center justify-center p-8 text-center">
                        <div className="max-w-md">
                          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6 mx-auto"><AlertCircle className="text-red-500/40" size={32} /></div>
                          <h3 className="text-lg font-bold text-black mb-2">Directions API Not Enabled</h3>
                          <div className="text-sm text-black/40 space-y-4 leading-relaxed">
                            <p>Enable the <span className="font-bold text-black/60">Directions API</span> in Google Cloud Console.</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={AURORA_COORDS_OBJ}
                      zoom={7}
                      options={{ styles: GOOGLE_MAPS_STYLING, disableDefaultUI: true, zoomControl: true }}
                    >
                      {(() => {
                        const destCoords = getCoordinates(selectedRouteForMap.city);
                        if (!destCoords) return null;
                        const dest = { lng: destCoords[0], lat: destCoords[1] };
                        return (
                          <>
                            {!directionsResponse && !directionsError && (
                              <DirectionsService
                                options={{ destination: dest, origin: AURORA_COORDS_OBJ, travelMode: google.maps.TravelMode.DRIVING }}
                                callback={(result, status) => {
                                  if (result !== null && status === google.maps.DirectionsStatus.OK) {
                                    setDirectionsResponse(result);
                                    setDirectionsError(null);
                                  } else {
                                    setDirectionsError(status);
                                  }
                                }}
                              />
                            )}
                            {directionsResponse && (
                              <DirectionsRenderer
                                options={{ directions: directionsResponse, suppressMarkers: true, preserveViewport: false, polylineOptions: { strokeColor: "#000000", strokeOpacity: 0.8, strokeWeight: 4 } }}
                              />
                            )}
                            <GoogleMarker position={AURORA_COORDS_OBJ} icon={{ url: BLACK_DOT_ICON_URL, scaledSize: new window.google.maps.Size(24, 24), anchor: new window.google.maps.Point(12, 12) }} title="Aurora Terminal" />
                            <GoogleMarker position={dest} icon={{ url: BLACK_DOT_ICON_URL, scaledSize: new window.google.maps.Size(24, 24), anchor: new window.google.maps.Point(12, 12) }} title={selectedRouteForMap.city} />
                          </>
                        );
                      })()}
                    </GoogleMap>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="animate-spin text-black/20" size={32} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
