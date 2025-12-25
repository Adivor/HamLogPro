import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Settings, 
  History, 
  MapPin, 
  Radio, 
  Search, 
  X,
  Database,
  Mountain,
  Sun,
  Moon,
  Zap,
  RefreshCw,
  Cloud,
  CheckCircle2,
  Filter,
  Mic,
  Square,
  Globe,
  Save,
  Clock,
  User,
  Navigation,
  Type,
  AlertTriangle,
  Compass,
  Trophy,
  CloudLightning
} from 'lucide-react';
import { QSO, UserSettings, DXSpot } from './types';
import { getMaidenhead, calculateDistance, locatorToCoords } from './services/geoService';
import { lookupCallsign, syncWithQRZLogbook } from './services/qrzService';
import { getLiveDxSpots } from './services/clusterService';

const MOCK_POTA = [
  { id: 'I-0123', name: 'Parco Nazionale dello Stelvio', lat: 46.50, lon: 10.50 },
  { id: 'I-0456', name: 'Parco Regionale dei Colli Euganei', lat: 45.31, lon: 11.71 }
];

const MOCK_SOTA = [
  { id: 'I/LO-123', name: 'Monte Generoso', lat: 45.92, lon: 9.01 },
  { id: 'I/VE-045', name: 'Monte Grappa', lat: 45.87, lon: 11.80 }
];

const DEFAULT_COORDS = { lat: 41.8719, lon: 12.5674 }; // Centro Italia

const BANDS = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "2m", "70cm", "23cm"];

const inferBand = (freq: string): string => {
  const f = parseFloat(freq);
  if (isNaN(f)) return "40m";
  if (f < 2.0) return "160m";
  if (f < 4.0) return "80m";
  if (f < 6.0) return "60m";
  if (f < 8.0) return "40m";
  if (f < 11.0) return "30m";
  if (f < 15.0) return "20m";
  if (f < 19.0) return "17m";
  if (f < 22.0) return "15m";
  if (f < 25.0) return "12m";
  if (f < 30.0) return "10m";
  if (f < 60.0) return "6m";
  if (f < 150.0) return "2m";
  if (f < 450.0) return "70cm";
  return "40m";
};

const App: React.FC = () => {
  const [qsos, setQsos] = useState<QSO[]>([]);
  const [dxSpots, setDxSpots] = useState<DXSpot[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'map'>('log');
  const [dxFilter, setDxFilter] = useState('');
  const [syncStatus, setSyncStatus] = useState('Pronto');
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingCluster, setLoadingCluster] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    myCall: '',
    qrzApiKey: '',
    logbookUuid: '',
    myLocator: '',
    potaEnabled: true,
    sotaEnabled: true,
    refreshInterval: 60,
    enableAudioRecording: true,
    fontSize: 'normal'
  });
  
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedQso, setSelectedQso] = useState<QSO | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingSave, setPendingSave] = useState<{audioUrl?: string} | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const mapRef = useRef<any>(null);
  const dashboardMapRef = useRef<any>(null);
  const detailMapRef = useRef<any>(null);

  const [form, setForm] = useState<Partial<QSO>>({
    callsign: '',
    rstSent: '59',
    rstRcvd: '59',
    band: '40m',
    mode: 'SSB',
    power: '100W',
    potaRef: '',
    sotaRef: '',
    distance: 0,
    profileImage: ''
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayQsos = qsos.filter(q => new Date(q.timestamp) >= todayStart);

  const performCloudSync = async (currentLogs: QSO[], currentSettings: UserSettings) => {
    if (!currentSettings.qrzApiKey || !currentSettings.logbookUuid) {
        setSyncStatus('Configura API Key nelle impostazioni');
        return;
    }
    
    setIsSyncing(true);
    setShowSyncModal(true);
    setSyncStatus('Contattando QRZ.com...');
    
    try {
      const updatedLogs = await syncWithQRZLogbook(currentLogs, {
        apiKey: currentSettings.qrzApiKey,
        uuid: currentSettings.logbookUuid
      });
      setQsos(updatedLogs);
      localStorage.setItem('hamlog_qsos', JSON.stringify(updatedLogs));
      setSyncStatus('Sincronizzazione completata!');
    } catch (err) {
      setSyncStatus('Errore di connessione');
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setShowSyncModal(false);
      }, 1500);
    }
  };

  const fetchClusterData = async () => {
    setLoadingCluster(true);
    const spots = await getLiveDxSpots();
    if (spots.length > 0) {
      setDxSpots(spots);
    }
    setLoadingCluster(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem('hamlog_qsos');
    const loadedLogs = saved ? JSON.parse(saved) : [];
    setQsos(loadedLogs);
    
    const savedSettings = localStorage.getItem('hamlog_settings');
    const loadedSettings = savedSettings ? JSON.parse(savedSettings) : settings;
    if (savedSettings) setSettings(loadedSettings);

    const savedTheme = localStorage.getItem('hamlog_theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme || 'light');

    performCloudSync(loadedLogs, loadedSettings);
    updateLocation();
    fetchClusterData();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const size = settings.fontSize === 'large' ? '18.4px' : '16px';
    root.style.fontSize = size;
  }, [settings.fontSize]);

  const initMap = (containerId: string, ref: React.MutableRefObject<any>, markers: QSO[], showPath: boolean = false, targetLocator?: string) => {
    const activeLocation = location || DEFAULT_COORDS;
    
    if (ref.current) {
      ref.current.remove();
      ref.current = null;
    }

    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      const L = (window as any).L;
      if (!L) return;

      try {
        ref.current = L.map(containerId, { 
          zoomControl: false,
          attributionControl: false 
        }).setView([activeLocation.lat, activeLocation.lon], 6);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(ref.current);
        
        if (location) {
          const myIcon = L.divIcon({
            className: 'bg-emerald-600 w-4 h-4 rounded-full border-2 border-white shadow-lg',
            iconSize: [16, 16]
          });
          L.marker([location.lat, location.lon], { icon: myIcon }).addTo(ref.current)
            .bindPopup('Tu sei qui');
        }
          
        markers.forEach(qso => {
          const coords = locatorToCoords(qso.locator);
          if (coords) {
            const marker = L.circleMarker([coords.lat, coords.lon], {
              radius: 8,
              fillColor: "#059669",
              color: "#fff",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9,
              className: 'cursor-pointer'
            }).addTo(ref.current);

            if (!showPath) {
                marker.on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e);
                    setSelectedQso(qso);
                });
                marker.bindTooltip(`${qso.callsign}`, { direction: 'top', offset: [0, -10] });
            }

            if (showPath && qso.locator === targetLocator) {
              const pathPoints = [
                [activeLocation.lat, activeLocation.lon],
                [coords.lat, coords.lon]
              ];
              L.polyline(pathPoints, { 
                color: '#059669', 
                weight: 4, 
                dashArray: '12, 12', 
                opacity: 0.7 
              }).addTo(ref.current);
              ref.current.fitBounds(L.latLngBounds(pathPoints), { padding: [60, 60] });
            }
          }
        });

        ref.current.invalidateSize();
      } catch (err) {
        console.warn("Map init error:", err);
      }
    }, 100);
  };

  useEffect(() => {
    if (activeTab === 'map') {
      initMap('map-container', mapRef, qsos);
    }
  }, [activeTab, location, qsos]);

  useEffect(() => {
    if (activeTab === 'log' && window.innerWidth >= 1024) {
      initMap('dashboard-map-container', dashboardMapRef, todayQsos);
    }
  }, [activeTab, location, qsos]);

  useEffect(() => {
    if (selectedQso) {
      initMap('detail-map-container', detailMapRef, [selectedQso], true, selectedQso.locator);
    }
  }, [selectedQso]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchClusterData();
    }, settings.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [settings.refreshInterval]);

  const updateLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude });
        const locator = getMaidenhead(latitude, longitude);
        setSettings(prev => ({ ...prev, myLocator: locator }));
      }, (err) => {
        console.warn("Geolocation denied or error:", err);
      });
    }
  };

  const handleLookup = async (call: string) => {
    if (call.length < 3) return;
    setLoadingLookup(true);
    const data = await lookupCallsign(call, settings.qrzApiKey);
    if (data) {
      let dist = 0;
      const activeLocation = location || DEFAULT_COORDS;
      if (data.locator) {
        const theirCoords = locatorToCoords(data.locator);
        if (theirCoords) {
          dist = calculateDistance(activeLocation.lat, activeLocation.lon, theirCoords.lat, theirCoords.lon);
        }
      }
      setForm(prev => ({
        ...prev,
        callsign: call.toUpperCase(),
        name: data.name,
        qth: data.qth,
        locator: data.locator,
        distance: dist,
        profileImage: data.image
      }));
    }
    setLoadingLookup(false);
  };

  const handleSpotClick = async (spot: DXSpot) => {
    const call = spot.dxCall.toUpperCase();
    const band = inferBand(spot.freq);
    setForm(prev => ({
      ...prev,
      callsign: call,
      band: band,
      mode: spot.mode || 'SSB'
    }));
    await handleLookup(call);
    setActiveTab('log');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        prepareSaveQSO(url);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Accesso microfono negato!");
    }
  };

  const stopRecordingAndSave = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const prepareSaveQSO = (audioUrl?: string) => {
    if (!form.callsign) return;
    const upperCall = form.callsign.toUpperCase();
    const isDuplicate = qsos.some(q => q.callsign === upperCall);
    
    if (isDuplicate) {
      setPendingSave({ audioUrl });
      setShowDuplicateModal(true);
    } else {
      executeSaveQSO(audioUrl);
    }
  };

  const executeSaveQSO = (audioUrl?: string) => {
    if (!form.callsign) return;
    const newQSO: QSO = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      callsign: form.callsign.toUpperCase(),
      rstSent: form.rstSent || '59',
      rstRcvd: form.rstRcvd || '59',
      band: form.band || '40m',
      mode: form.mode || 'SSB',
      power: form.power || '100W',
      name: form.name || '',
      qth: form.qth || '',
      locator: form.locator || '',
      potaRef: form.potaRef,
      sotaRef: form.sotaRef,
      synced: false,
      distance: form.distance,
      audioUrl,
      profileImage: form.profileImage
    };
    const newList = [newQSO, ...qsos];
    setQsos(newList);
    localStorage.setItem('hamlog_qsos', JSON.stringify(newList));
    setForm({
      callsign: '', rstSent: '59', rstRcvd: '59', band: '40m', mode: 'SSB', power: '100W', potaRef: '', sotaRef: '', distance: 0, profileImage: ''
    });
    setShowDuplicateModal(false);
    setPendingSave(null);
  };

  const detectReference = (type: 'POTA' | 'SOTA') => {
    const activeLocation = location || DEFAULT_COORDS;
    const db = type === 'POTA' ? MOCK_POTA : MOCK_SOTA;
    const found = db.find(ref => {
      const dist = Math.sqrt(Math.pow(ref.lat - activeLocation.lat, 2) + Math.pow(ref.lon - activeLocation.lon, 2));
      return dist < 0.2; 
    });

    if (found) {
      if (type === 'POTA') setForm(prev => ({ ...prev, potaRef: found.id }));
      else setForm(prev => ({ ...prev, sotaRef: found.id }));
    } else {
      alert(`Referenza ${type} non trovata nelle vicinanze.`);
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-300 pb-28 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-emerald-50 text-slate-900'}`}>
      <header className={`bg-white/95 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 border-b ${theme === 'light' ? 'border-emerald-200' : 'border-slate-800'} p-4 flex justify-between items-center shadow-sm lg:px-12`}>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-700 dark:bg-emerald-600 p-2.5 rounded-2xl shadow-lg">
            <Radio className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">HamLog <span className="text-emerald-700 dark:text-emerald-400">Pro</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => performCloudSync(qsos, settings)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 ${theme === 'light' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-800 text-slate-300'}`}
          >
            <Cloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">Sincronizza</span>
          </button>
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className={`p-3 rounded-2xl active:scale-95 transition-transform ${theme === 'light' ? 'bg-emerald-100' : 'bg-slate-800'}`}>
            {theme === 'light' ? <Moon className="w-5 h-5 text-emerald-800" /> : <Sun className="w-5 h-5 text-amber-400" />}
          </button>
          <button onClick={() => setShowSettings(true)} className={`p-3 rounded-2xl active:scale-95 transition-transform ${theme === 'light' ? 'bg-emerald-100' : 'bg-slate-800'}`}>
            <Settings className={`w-5 h-5 ${theme === 'light' ? 'text-emerald-800' : 'text-slate-300'}`} />
          </button>
        </div>
      </header>

      <main className={`mx-auto p-4 lg:p-12 ${activeTab === 'log' ? 'max-w-7xl' : 'max-w-full'}`}>
        {activeTab === 'log' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-5 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-700 p-6 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
                  <p className="text-[10px] opacity-80 font-black uppercase tracking-[0.2em] mb-1 text-emerald-100">Sessione Odierna</p>
                  <p className="text-5xl font-black leading-none">{todayQsos.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-emerald-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Locator</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black uppercase text-slate-900 dark:text-white tracking-tighter">{settings.myLocator || '----'}</span>
                    <button onClick={updateLocation} className="p-2 bg-emerald-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 rounded-xl active:rotate-180 transition-all shadow-inner"><MapPin className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>

              <section className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-2xl border border-emerald-100 dark:border-slate-800 space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="DIGITA NOMINATIVO..."
                    className="w-full bg-emerald-50/50 dark:bg-slate-800 border-none rounded-[1.8rem] py-6 px-8 text-3xl font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-900 dark:text-white placeholder:text-emerald-200 placeholder:font-bold"
                    value={form.callsign}
                    onChange={(e) => {
                      setForm({ ...form, callsign: e.target.value });
                      if (e.target.value.length >= 4) handleLookup(e.target.value);
                    }}
                  />
                  {loadingLookup && <div className="absolute right-8 top-1/2 -translate-y-1/2 animate-spin h-8 w-8 border-4 border-emerald-700 border-t-transparent rounded-full" />}
                </div>

                {(form.name || form.qth) && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 p-6 rounded-3xl flex items-center justify-between border border-emerald-200 dark:border-emerald-800 animate-in slide-in-from-top-6 duration-300">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden flex items-center justify-center border border-emerald-100">
                        {form.profileImage ? (
                          <img src={form.profileImage} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <Search className="text-emerald-700 dark:text-emerald-400 w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <p className="text-lg font-black leading-tight text-slate-900 dark:text-white">{form.name}</p>
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1 uppercase tracking-wider">{form.qth} • {form.locator}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Distanza</p>
                      <p className="text-2xl font-black leading-none text-slate-900 dark:text-white">{form.distance} km</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex gap-2">
                    <input className="w-full bg-emerald-50 dark:bg-slate-800 rounded-2xl p-4 text-center text-lg font-black text-slate-900 dark:text-white outline-none focus:bg-white border-2 border-transparent focus:border-emerald-500/30 transition-all shadow-inner" value={form.rstSent} onChange={e => setForm({...form, rstSent: e.target.value})} placeholder="S" />
                    <input className="w-full bg-emerald-50 dark:bg-slate-800 rounded-2xl p-4 text-center text-lg font-black text-slate-900 dark:text-white outline-none focus:bg-white border-2 border-transparent focus:border-emerald-500/30 transition-all shadow-inner" value={form.rstRcvd} onChange={e => setForm({...form, rstRcvd: e.target.value})} placeholder="R" />
                  </div>
                  <select className="w-full bg-emerald-50 dark:bg-slate-800 rounded-2xl p-4 text-center font-black appearance-none outline-none text-slate-900 dark:text-white shadow-inner" value={form.band} onChange={e => setForm({...form, band: e.target.value})}>
                    {BANDS.map(b => <option key={b} className="text-slate-900">{b}</option>)}
                  </select>
                  <select className="w-full bg-emerald-50 dark:bg-slate-800 rounded-2xl p-4 text-center font-black appearance-none outline-none text-slate-900 dark:text-white shadow-inner" value={form.mode} onChange={e => setForm({...form, mode: e.target.value})}>
                    {["SSB", "CW", "FT8", "FM", "RTTY", "AM"].map(m => <option key={m} className="text-slate-900">{m}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => detectReference('POTA')} className={`py-5 rounded-[1.5rem] border-2 font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 ${form.potaRef ? 'bg-emerald-100 border-emerald-500 text-emerald-900 shadow-lg shadow-emerald-500/20' : 'bg-emerald-50 dark:bg-slate-800 border-transparent text-emerald-800 dark:text-emerald-400 shadow-inner'}`}>
                    <img src="https://parksontheair.com/wp-content/uploads/2022/10/POTA-Logo-Circle-250.png" alt="POTA" className="w-8 h-8 object-contain" />
                    {form.potaRef || 'Rileva POTA'}
                  </button>
                  <button onClick={() => detectReference('SOTA')} className={`py-5 rounded-[1.5rem] border-2 font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 ${form.sotaRef ? 'bg-rose-100 border-rose-500 text-rose-900 shadow-lg shadow-rose-500/20' : 'bg-rose-50 dark:bg-slate-800 border-transparent text-rose-800 dark:text-rose-400 shadow-inner'}`}>
                    <img src="https://www.sota.org.uk/images/sota-logo.png" alt="SOTA" className="w-8 h-8 object-contain" />
                    {form.sotaRef || 'Rileva SOTA'}
                  </button>
                </div>

                <div className="space-y-4 pt-2">
                  {isRecording ? (
                    <button 
                      onClick={stopRecordingAndSave} 
                      className="w-full bg-rose-700 text-white font-black py-6 rounded-[2rem] shadow-2xl flex items-center justify-center gap-4 transition-all animate-pulse text-lg"
                    >
                      <Square className="w-6 h-6 fill-white" /> FINE REGISTRAZIONE E SALVA
                    </button>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button 
                        onClick={() => prepareSaveQSO()} 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-6 rounded-[2rem] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-lg"
                      >
                        <Save className="w-6 h-6" /> SALVA QSO
                      </button>
                      {settings.enableAudioRecording && (
                        <button 
                          onClick={startRecording} 
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-6 rounded-[2rem] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-lg"
                        >
                          <Mic className="w-6 h-6" /> QSO + AUDIO
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-emerald-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-50 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.3em]">DX Cluster (IZ3MEZ)</h3>
                  </div>
                  <div className="flex items-center gap-2">
                     {loadingCluster && <RefreshCw className="w-3 h-3 animate-spin text-emerald-500" />}
                     <div className="w-2 h-2 bg-emerald-600 rounded-full animate-ping"></div>
                     <span className="text-[10px] font-black text-slate-400 uppercase">{settings.refreshInterval}s</span>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto no-scrollbar space-y-2">
                  {dxSpots.length === 0 ? <p className="text-center py-8 text-emerald-200 font-bold uppercase text-xs tracking-widest">In ascolto sui ponti...</p> : 
                    dxSpots.filter(s => s.dxCall.toLowerCase().includes(dxFilter.toLowerCase())).map(spot => (
                    <div key={spot.id} onClick={() => handleSpotClick(spot)} className="group bg-emerald-50/30 dark:bg-slate-800/50 p-4 px-6 rounded-3xl border border-emerald-50 dark:border-slate-800 flex items-center justify-between transition-all hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer active:scale-[0.98] shadow-sm">
                      <div className="flex gap-6 items-center">
                        <span className="text-emerald-700 dark:text-emerald-400 font-black text-base">{spot.freq}</span>
                        <span className="uppercase text-slate-900 dark:text-white font-black tracking-tight text-lg">{spot.dxCall}</span>
                        <span className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded-lg text-[10px] font-black text-emerald-600 dark:text-emerald-300 uppercase">{spot.mode}</span>
                      </div>
                      <span className="text-emerald-400 font-mono text-xs">{spot.time}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="lg:col-span-7 space-y-6 hidden lg:block">
              <section className="bg-white dark:bg-slate-900 p-4 rounded-[3.5rem] shadow-2xl border border-emerald-100 dark:border-slate-800 relative overflow-hidden h-[500px]">
                <div id="dashboard-map-container" className="h-full w-full rounded-[2.8rem]"></div>
                <div className="absolute top-8 left-8 z-10">
                   <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-[2rem] border border-emerald-200 dark:border-slate-800 shadow-lg">
                      <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1">Stato Operativo</p>
                      <div className="flex items-center gap-3">
                         <Globe className="w-5 h-5 text-emerald-900 dark:text-white" />
                         <span className="text-xl font-black text-emerald-900 dark:text-white">{todayQsos.length} QSO Oggi</span>
                      </div>
                   </div>
                </div>
                {!location && (
                  <div className="absolute bottom-8 right-8 z-10 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-xl border border-amber-200 text-[10px] font-black uppercase">GPS Manuale - Centro Italia</div>
                )}
              </section>

              <section className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-emerald-100 dark:border-slate-800 space-y-5">
                <div className="flex items-center justify-between border-b border-emerald-50 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-emerald-700" />
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.3em]">Ultimi Contatti</h3>
                  </div>
                  <button onClick={() => setActiveTab('history')} className="text-[10px] font-black text-emerald-700 uppercase hover:underline">Vedi Archivio</button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {todayQsos.slice(0, 5).map(qso => (
                    <div 
                      key={qso.id} 
                      onClick={() => setSelectedQso(qso)}
                      className="bg-emerald-50/20 dark:bg-slate-800/50 p-5 rounded-3xl border border-emerald-50 dark:border-slate-800 flex items-center justify-between hover:border-emerald-200 dark:hover:border-emerald-900 transition-colors cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl flex flex-col items-center justify-center shadow-sm overflow-hidden border border-emerald-50">
                           {qso.profileImage ? (
                             <img src={qso.profileImage} alt="Profile" className="w-full h-full object-cover" />
                           ) : (
                             <span className="text-xl font-black text-emerald-700 dark:text-white">{qso.band.replace('m','')}</span>
                           )}
                        </div>
                        <div>
                          <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter leading-none uppercase">{qso.callsign}</h4>
                          <div className="flex gap-4 items-center mt-2">
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">{qso.mode}</span>
                            <span className="text-[10px] font-bold text-emerald-400 uppercase">• {qso.distance}km</span>
                            {qso.audioUrl && <Mic className="w-4 h-4 text-rose-600" />}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                         <div className="text-right">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Segnale</p>
                           <p className="text-xl font-black text-emerald-800 dark:text-white">{qso.rstSent}/{qso.rstRcvd}</p>
                         </div>
                         {qso.audioUrl && (
                           <div className="p-4 bg-rose-100 dark:bg-rose-900/30 rounded-2xl">
                             <Radio className="w-6 h-6 text-rose-700 dark:text-rose-400" />
                           </div>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-in slide-in-from-right-10 duration-500 w-full">
            <div className="flex items-center justify-between mb-8 px-4">
              <h3 className="text-xl font-black text-emerald-900 dark:text-white uppercase tracking-tighter">Archivio Logbook</h3>
              <div className="bg-emerald-700 text-white px-6 py-2 rounded-full text-xs font-black shadow-lg">{qsos.length} QSO REGISTRATI</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
              {qsos.length === 0 ? (
                 <div className="col-span-full p-24 text-center opacity-10"><History className="w-24 h-24 mx-auto mb-4 text-emerald-900" /><p className="font-black text-2xl uppercase">VUOTO</p></div>
              ) : qsos.map(qso => (
                <div 
                  key={qso.id} 
                  onClick={() => setSelectedQso(qso)}
                  className={`bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border ${qso.synced ? 'border-emerald-500' : 'border-emerald-100'} dark:border-slate-800 flex justify-between items-center shadow-xl cursor-pointer hover:border-emerald-400 transition-all active:scale-[0.98] relative overflow-hidden`}
                >
                  {qso.synced && <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">Synced</div>}
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border border-emerald-100">
                      {qso.profileImage ? (
                        <img src={qso.profileImage} alt="QRZ Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-emerald-700 dark:text-white text-xl">{qso.band.replace('m','')}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-2xl tracking-tighter leading-none text-slate-900 dark:text-white uppercase">{qso.callsign}</h4>
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mt-2 tracking-widest">{qso.mode} • {new Date(qso.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-slate-800 rounded-2xl text-lg font-black px-5 text-emerald-900 dark:text-white border border-emerald-100 shadow-inner">
                    {qso.rstSent}/{qso.rstRcvd}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <div className="h-[78vh] w-full animate-in zoom-in-95 duration-500 rounded-[3.5rem] overflow-hidden shadow-2xl relative border-8 border-white dark:border-slate-800">
             <div id="map-container" className="h-full w-full"></div>
             {!location && (
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-full border border-emerald-200 shadow-xl pointer-events-none">
                  <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Visualizzazione GPS Predefinita</p>
                </div>
             )}
          </div>
        )}
      </main>

      {/* MODALE DUPLICATI */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm p-10 rounded-[3.5rem] shadow-2xl border border-emerald-200 dark:border-slate-800 text-center space-y-8 animate-in zoom-in-95">
             <div className="w-24 h-24 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle className="w-12 h-12 text-amber-600" />
             </div>
             <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Nominativo Duplicato</h3>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm mt-3 leading-relaxed uppercase tracking-widest">
                  Il nominativo <span className="text-emerald-700 font-black">{form.callsign?.toUpperCase()}</span> è già presente nel log di oggi. Procedere comunque con un nuovo QSO?
                </p>
             </div>
             <div className="flex flex-col gap-3">
                <button 
                  onClick={() => executeSaveQSO(pendingSave?.audioUrl)} 
                  className="w-full bg-emerald-700 text-white font-black py-5 rounded-[1.8rem] shadow-lg active:scale-95 transition-all uppercase tracking-[0.2em] text-xs hover:bg-emerald-800"
                >
                  Conferma Salvataggio
                </button>
                <button 
                  onClick={() => { setShowDuplicateModal(false); setPendingSave(null); }} 
                  className="w-full bg-emerald-50 dark:bg-slate-800 text-emerald-800 dark:text-slate-300 font-black py-5 rounded-[1.8rem] active:scale-95 transition-all uppercase tracking-[0.2em] text-xs shadow-inner"
                >
                  Annulla
                </button>
             </div>
          </div>
        </div>
      )}

      {selectedQso && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-full md:h-auto md:max-h-[92vh] rounded-[3.5rem] overflow-hidden shadow-2xl border border-emerald-200 dark:border-slate-800 flex flex-col md:flex-row">
              <div className="p-10 md:w-1/2 flex flex-col space-y-8 overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-start">
                   <div className="flex items-center gap-8">
                      <div className="w-28 h-28 bg-emerald-50 dark:bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden border-4 border-emerald-700">
                         {selectedQso.profileImage ? (
                           <img src={selectedQso.profileImage} alt="QRZ Profile" className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20">
                             <User className="w-12 h-12 text-emerald-700" />
                           </div>
                         )}
                      </div>
                      <div>
                        <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">{selectedQso.callsign}</h2>
                        <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mt-3">{selectedQso.name || 'Operatore Radio'}</p>
                      </div>
                   </div>
                   <button onClick={() => setSelectedQso(null)} className="p-4 bg-emerald-50 dark:bg-slate-800 rounded-full hover:bg-emerald-100 transition-all active:scale-90 shadow-inner">
                     <X className="w-8 h-8 text-emerald-900 dark:text-white" />
                   </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="bg-emerald-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-emerald-100 dark:border-slate-700 shadow-sm">
                      <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-1">Città / QTH</p>
                      <p className="text-xl font-black text-emerald-900 dark:text-white uppercase truncate">{selectedQso.qth || '---'}</p>
                   </div>
                   <div className="bg-emerald-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-emerald-100 dark:border-slate-700 shadow-sm">
                      <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-1">Grid Square</p>
                      <p className="text-xl font-black text-emerald-900 dark:text-white uppercase">{selectedQso.locator || '---'}</p>
                   </div>
                </div>

                <div className="bg-emerald-700 p-8 rounded-[2.5rem] text-white flex items-center justify-between shadow-[0_20px_50px_rgba(5,150,105,0.3)]">
                   <div className="flex items-center gap-6">
                      <div className="p-4 bg-white/10 rounded-2xl"><Navigation className="w-8 h-8" /></div>
                      <div>
                        <p className="text-[11px] font-black uppercase opacity-70 tracking-widest text-emerald-100">Distanza Segnale</p>
                        <p className="text-4xl font-black tracking-tighter leading-none">{selectedQso.distance} <span className="text-base opacity-50 uppercase ml-1">km</span></p>
                      </div>
                   </div>
                   <div className="text-right">
                     <p className="text-[11px] font-black uppercase opacity-70 tracking-widest text-emerald-100">Setup</p>
                     <p className="text-2xl font-black uppercase">{selectedQso.band} {selectedQso.mode}</p>
                   </div>
                </div>

                <div className="flex-1 space-y-5">
                  <div className="p-6 bg-emerald-50 dark:bg-slate-800/30 rounded-[2rem] border-l-8 border-emerald-700 shadow-sm">
                    <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-1 text-emerald-600">Timestamp Operazione</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{new Date(selectedQso.timestamp).toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' })}</p>
                  </div>
                  {selectedQso.audioUrl && (
                    <button 
                      onClick={() => {const a = new Audio(selectedQso.audioUrl); a.play();}} 
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-6 rounded-[2rem] flex items-center justify-center gap-4 shadow-xl transition-all active:scale-[0.98]"
                    >
                      <Radio className="w-6 h-6" /> ASCOLTA IL QSO
                    </button>
                  )}
                </div>
              </div>

              <div className="md:w-1/2 bg-emerald-50 dark:bg-slate-800 h-[350px] md:h-auto relative border-l border-emerald-100 dark:border-slate-800">
                 <div id="detail-map-container" className="w-full h-full"></div>
                 <div className="absolute bottom-10 right-10 z-10 pointer-events-none">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 px-8 rounded-full border border-emerald-200 dark:border-slate-800 shadow-2xl">
                       <p className="text-[11px] font-black text-emerald-700 dark:text-white uppercase tracking-widest">Tracciamento Punto-Punto</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-2xl animate-in fade-in duration-700">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xs p-16 rounded-[5rem] text-center space-y-10 animate-in zoom-in-90 border border-emerald-200 dark:border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 rounded-full border-[12px] border-emerald-50 dark:border-emerald-900/20" />
              <div className="absolute inset-0 rounded-full border-[12px] border-emerald-700 border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                {syncStatus.includes('completata') ? <CheckCircle2 className="w-14 h-14 text-emerald-600" /> : <CloudLightning className="w-14 h-14 text-emerald-700 animate-pulse" />}
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">QRZ Gateway</h3>
              <p className="text-emerald-500 dark:text-emerald-400 text-[10px] mt-4 font-black uppercase tracking-[0.4em] leading-relaxed">{syncStatus}</p>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/80 backdrop-blur-2xl transition-all">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg p-12 rounded-t-[4.5rem] shadow-2xl animate-in slide-in-from-bottom-80 transition-all border-t border-emerald-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-12">
              <h3 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Profilo Utente</h3>
              <button onClick={() => setShowSettings(false)} className="p-4 bg-emerald-50 dark:bg-slate-800 rounded-full active:scale-90 shadow-inner transition-transform"><X className="text-emerald-900 dark:text-white w-6 h-6" /></button>
            </div>
            <div className="space-y-8 max-h-[65vh] overflow-y-auto no-scrollbar pb-10 px-2">
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-emerald-400 uppercase ml-3 tracking-widest">Nominativo di Stazione</label>
                 <input type="text" className="w-full bg-emerald-50 dark:bg-slate-800 rounded-3xl p-7 font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/10 text-emerald-900 dark:text-white text-2xl shadow-inner border border-emerald-100 dark:border-slate-700" value={settings.myCall} onChange={e => setSettings({...settings, myCall: e.target.value})} placeholder="IZ1XXX" />
              </div>
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-emerald-400 uppercase ml-3 tracking-widest">Dimensione Caratteri</label>
                 <div className="grid grid-cols-2 gap-4 p-2 bg-emerald-50 dark:bg-slate-800 rounded-[2rem] border border-emerald-100 dark:border-slate-700 shadow-inner">
                    {['normal', 'large'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setSettings({ ...settings, fontSize: size as any })}
                        className={`py-5 rounded-2xl font-black text-sm uppercase transition-all shadow-sm ${
                          settings.fontSize === size 
                            ? 'bg-emerald-700 text-white' 
                            : 'text-emerald-400 hover:bg-emerald-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {size === 'normal' ? 'Normale' : 'Grande (+15%)'}
                      </button>
                    ))}
                 </div>
              </div>
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-emerald-400 uppercase ml-3 tracking-widest">Chiave API QRZ.com</label>
                 <input type="password" placeholder="••••••••••••" className="w-full bg-emerald-50 dark:bg-slate-800 rounded-3xl p-7 outline-none focus:ring-4 focus:ring-emerald-500/10 text-emerald-900 dark:text-white text-xl border border-emerald-100 dark:border-slate-700 shadow-inner" value={settings.qrzApiKey} onChange={e => setSettings({...settings, qrzApiKey: e.target.value})} />
              </div>
              <div className="space-y-4">
                 <label className="text-[11px] font-black text-emerald-400 uppercase ml-3 tracking-widest">QRZ Logbook UUID</label>
                 <input type="text" placeholder="UUID del Logbook" className="w-full bg-emerald-50 dark:bg-slate-800 rounded-3xl p-7 outline-none focus:ring-4 focus:ring-emerald-500/10 text-emerald-900 dark:text-white text-lg border border-emerald-100 dark:border-slate-700 shadow-inner" value={settings.logbookUuid} onChange={e => setSettings({...settings, logbookUuid: e.target.value})} />
              </div>
              <div className="flex items-center justify-between p-7 bg-emerald-50/50 dark:bg-slate-800 rounded-[2.5rem] border border-emerald-100 dark:border-slate-700 shadow-inner">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-white dark:bg-slate-700 rounded-2xl shadow-sm"><Mic className="w-7 h-7 text-emerald-700 dark:text-emerald-400" /></div>
                  <div>
                    <span className="text-sm font-black uppercase text-slate-800 dark:text-slate-200">Voice Log</span>
                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Salva clip audio QSO</p>
                  </div>
                </div>
                <input type="checkbox" checked={settings.enableAudioRecording} onChange={e => setSettings({...settings, enableAudioRecording: e.target.checked})} className="w-8 h-8 accent-emerald-700 cursor-pointer shadow-sm" />
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-black text-emerald-400 uppercase ml-3 tracking-widest">Auto-Refresh DX Cluster</label>
                <select className="w-full bg-emerald-50 dark:bg-slate-800 rounded-3xl p-7 font-black outline-none appearance-none text-emerald-900 dark:text-white text-lg border border-emerald-100 dark:border-slate-700 shadow-inner" value={settings.refreshInterval} onChange={e => setSettings({...settings, refreshInterval: parseInt(e.target.value)})}>
                  <option value={30} className="text-slate-900">30 Secondi</option>
                  <option value={60} className="text-slate-900">60 Secondi (Auto)</option>
                  <option value={120} className="text-slate-900">120 Secondi</option>
                </select>
              </div>
              <button onClick={() => { localStorage.setItem('hamlog_settings', JSON.stringify(settings)); setShowSettings(false); performCloudSync(qsos, settings); fetchClusterData(); }} className="w-full bg-emerald-700 text-white font-black py-7 rounded-[3rem] shadow-[0_15px_30px_rgba(5,150,105,0.3)] hover:bg-emerald-800 transition-all uppercase tracking-[0.3em] text-base mt-6 active:scale-95">
                Applica Modifiche
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className={`fixed bottom-0 left-0 right-0 ${theme === 'light' ? 'bg-white/95' : 'bg-slate-900/95'} backdrop-blur-3xl border-t ${theme === 'light' ? 'border-emerald-100' : 'border-slate-800'} px-8 py-6 flex justify-around items-center z-40 shadow-[0_-15px_40px_rgba(0,0,0,0.1)] lg:px-72`}>
        <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center gap-2 transition-all active:scale-90 ${activeTab === 'log' ? 'text-emerald-700 scale-110' : 'text-emerald-200 dark:text-slate-600'}`}>
          <Plus className={`w-10 h-10 ${activeTab === 'log' ? 'stroke-[3px]' : ''}`} /><span className="text-[11px] font-black uppercase tracking-widest">LOG</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-2 transition-all active:scale-90 ${activeTab === 'history' ? 'text-emerald-700 scale-110' : 'text-emerald-200 dark:text-slate-600'}`}>
          <History className={`w-10 h-10 ${activeTab === 'history' ? 'stroke-[3px]' : ''}`} /><span className="text-[11px] font-black uppercase tracking-widest">LISTA</span>
        </button>
        <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center gap-2 transition-all active:scale-90 ${activeTab === 'map' ? 'text-emerald-700 scale-110' : 'text-emerald-200 dark:text-slate-600'}`}>
          <Globe className={`w-10 h-10 ${activeTab === 'map' ? 'stroke-[3px]' : ''}`} /><span className="text-[11px] font-black uppercase tracking-widest">MAPS</span>
        </button>
      </nav>
    </div>
  );
};

export default App;