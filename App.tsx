
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Settings, 
  History, 
  MapPin, 
  Radio, 
  Search, 
  X,
  Sun,
  Moon,
  Zap,
  RefreshCw,
  Cloud,
  CheckCircle2,
  Mic,
  Square,
  Globe,
  Save,
  Clock,
  User,
  Navigation,
  AlertTriangle,
  Compass,
  CloudLightning,
  Activity,
  ArrowRight,
  Download,
  UploadCloud,
  FileDown,
  Trash2
} from 'lucide-react';
import { QSO, UserSettings, DXSpot } from './types';
import { getMaidenhead, calculateDistance, locatorToCoords } from './services/geoService';
import { lookupCallsign, syncWithQRZLogbook, fetchFullLogbook } from './services/qrzService';
import { getLiveDxSpots } from './services/clusterService';

const DEFAULT_COORDS = { lat: 41.8719, lon: 12.5674 }; 
const BANDS = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "2m", "70cm", "23cm"];

const App: React.FC = () => {
  const [qsos, setQsos] = useState<QSO[]>([]);
  const [dxSpots, setDxSpots] = useState<DXSpot[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'map'>('log');
  const [syncStatus, setSyncStatus] = useState('Pronto');
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingCluster, setLoadingCluster] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    myCall: '',
    qrzApiKey: '',
    myLocator: '',
    potaEnabled: true,
    sotaEnabled: true,
    dxClusterEnabled: true,
    refreshInterval: 60,
    enableAudioRecording: true,
    fontSize: 'normal'
  });
  
  const [showSettings, setShowSettings] = useState(false);
  const [selectedQso, setSelectedQso] = useState<QSO | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingSave, setPendingSave] = useState<{audioUrl?: string} | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lookupTimeoutRef = useRef<number | null>(null);
  
  const mapRef = useRef<any>(null);
  const dashboardMapRef = useRef<any>(null);
  const detailMapRef = useRef<any>(null);

  const [form, setForm] = useState<Partial<QSO>>({
    callsign: '', rstSent: '59', rstRcvd: '59', band: '40m', mode: 'SSB', power: '100W', locator: '', distance: 0
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayQsos = qsos.filter(q => new Date(q.timestamp) >= todayStart);

  useEffect(() => {
    const saved = localStorage.getItem('hamlog_qsos');
    if (saved) setQsos(JSON.parse(saved));
    
    const savedSettings = localStorage.getItem('hamlog_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));

    const savedTheme = localStorage.getItem('hamlog_theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme || 'light');

    updateLocation();
    fetchClusterData();
  }, []);

  const fetchClusterData = async () => {
    if (!settings.dxClusterEnabled) return;
    setLoadingCluster(true);
    const spots = await getLiveDxSpots();
    if (spots.length > 0) setDxSpots(spots);
    setLoadingCluster(false);
  };

  const updateLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({ lat: latitude, lon: longitude });
        setSettings(prev => ({ ...prev, myLocator: getMaidenhead(latitude, longitude) }));
      });
    }
  };

  const handleImportQRZ = async () => {
    if (!settings.qrzApiKey) {
      alert("Configura prima la API Key nelle impostazioni.");
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Importazione...');
    try {
      const remoteLogs = await fetchFullLogbook(settings.qrzApiKey);
      const merged = [...remoteLogs];
      // Evitiamo duplicati semplici basati su callsign e timestamp (approssimativo)
      qsos.forEach(localQso => {
        if (!merged.some(m => m.callsign === localQso.callsign && Math.abs(new Date(m.timestamp).getTime() - new Date(localQso.timestamp).getTime()) < 60000)) {
          merged.push(localQso);
        }
      });
      const sorted = merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setQsos(sorted);
      localStorage.setItem('hamlog_qsos', JSON.stringify(sorted));
      setSyncStatus('Importazione OK');
    } catch (err) {
      setSyncStatus('Errore Import');
    } finally {
      setTimeout(() => setIsSyncing(false), 2000);
    }
  };

  const handleExportADIF = () => {
    if (qsos.length === 0) return;
    let adif = `HamLog Pro Mobile Export\nADIF Export\n<PROGRAMID:9>HAMLOGPRO\n<EOH>\n\n`;
    qsos.forEach(q => {
      const date = new Date(q.timestamp).toISOString().split('T')[0].replace(/-/g, '');
      const time = new Date(q.timestamp).toISOString().split('T')[1].replace(/:/g, '').split('.')[0];
      adif += `<CALL:${q.callsign.length}>${q.callsign.toUpperCase()} `;
      adif += `<QSO_DATE:8>${date} <TIME_ON:6>${time} `;
      adif += `<BAND:${q.band.length}>${q.band.toUpperCase()} <MODE:${q.mode.length}>${q.mode.toUpperCase()} `;
      adif += `<RST_SENT:${q.rstSent.length}>${q.rstSent} <RST_RCVD:${q.rstRcvd.length}>${q.rstRcvd} `;
      if (q.locator) adif += `<GRIDSQUARE:${q.locator.length}>${q.locator.toUpperCase()} `;
      if (q.name) adif += `<NAME:${q.name.length}>${q.name} `;
      adif += `<EOR>\n`;
    });

    const blob = new Blob([adif], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hamlog_export_${new Date().toISOString().split('T')[0]}.adi`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCallsignChange = (val: string) => {
    const upperVal = val.toUpperCase();
    setForm(prev => ({ ...prev, callsign: upperVal }));
    if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current);
    if (upperVal.length >= 4) {
      lookupTimeoutRef.current = window.setTimeout(() => handleLookup(upperVal), 1200);
    }
  };

  const handleLookup = async (call: string) => {
    setLoadingLookup(true);
    const data = await lookupCallsign(call, settings.qrzApiKey);
    if (data) {
      const activeLoc = location || DEFAULT_COORDS;
      const theirCoords = data.locator ? locatorToCoords(data.locator) : null;
      setForm(prev => ({
        ...prev,
        name: data.name, qth: data.qth, locator: data.locator, profileImage: data.image,
        distance: theirCoords ? calculateDistance(activeLoc.lat, activeLoc.lon, theirCoords.lat, theirCoords.lon) : 0
      }));
    }
    setLoadingLookup(false);
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
      synced: false,
      distance: form.distance,
      audioUrl,
      profileImage: form.profileImage
    };
    const newList = [newQSO, ...qsos];
    setQsos(newList);
    localStorage.setItem('hamlog_qsos', JSON.stringify(newList));
    setForm({ callsign: '', rstSent: '59', rstRcvd: '59', band: '40m', mode: 'SSB', power: '100W', locator: '', distance: 0 });
    setShowDuplicateModal(false);
    setPendingSave(null);
  };

  return (
    <div className={`min-h-screen transition-all duration-300 pb-28 ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-emerald-50 text-slate-900'}`}>
      <header className={`bg-white/95 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-[100] border-b ${theme === 'light' ? 'border-emerald-200' : 'border-slate-800'} p-4 flex justify-between items-center shadow-sm lg:px-12`}>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-700 dark:bg-emerald-600 p-2.5 rounded-2xl shadow-lg">
            <Radio className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">HamLog <span className="text-emerald-700 dark:text-emerald-400">Pro</span></h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-100 dark:bg-slate-800 rounded-full">
            <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-slate-300">{syncStatus}</span>
          </div>
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-3 rounded-2xl bg-emerald-100 dark:bg-slate-800 transition-transform active:scale-95">
            {theme === 'light' ? <Moon className="w-5 h-5 text-emerald-800" /> : <Sun className="w-5 h-5 text-amber-400" />}
          </button>
          <button onClick={() => setShowSettings(true)} className="p-3 rounded-2xl bg-emerald-100 dark:bg-slate-800 active:scale-95">
            <Settings className="w-5 h-5 text-emerald-800 dark:text-slate-300" />
          </button>
        </div>
      </header>

      <main className="mx-auto p-4 lg:p-12 max-w-7xl">
        {activeTab === 'log' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="md:col-span-5 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-700 p-6 rounded-[2.5rem] text-white shadow-2xl">
                  <p className="text-[10px] opacity-80 font-black uppercase tracking-[0.2em] mb-1">Oggi</p>
                  <p className="text-5xl font-black leading-none">{todayQsos.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-emerald-200 dark:border-slate-800 flex flex-col justify-between">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Locator</p>
                  <span className="text-2xl font-black uppercase tracking-tighter">{settings.myLocator || '----'}</span>
                </div>
              </div>

              <section className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-2xl border border-emerald-100 dark:border-slate-800 space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="NOMINATIVO..."
                    className="w-full bg-emerald-50/50 dark:bg-slate-800 rounded-[1.8rem] py-6 px-8 text-3xl font-black uppercase outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all text-slate-900 dark:text-white"
                    value={form.callsign}
                    onChange={(e) => handleCallsignChange(e.target.value)}
                  />
                  {loadingLookup && <div className="absolute right-8 top-1/2 -translate-y-1/2 animate-spin h-8 w-8 border-4 border-emerald-700 border-t-transparent rounded-full" />}
                </div>

                {form.callsign && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 p-6 rounded-3xl flex items-center gap-5 border border-emerald-200 animate-in slide-in-from-top-4">
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden flex items-center justify-center border border-emerald-100 shadow-sm">
                      {form.profileImage ? <img src={form.profileImage} alt="Profile" className="w-full h-full object-cover" /> : <Search className="text-emerald-700 w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-black leading-tight">{form.name || '---'}</p>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">{form.qth || 'Località'} • {form.locator || 'Locator'}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-emerald-600 uppercase">Banda</label>
                    <select className="w-full bg-emerald-50 dark:bg-slate-800 rounded-xl p-3 font-black text-sm outline-none" value={form.band} onChange={e => setForm({...form, band: e.target.value})}>
                      {BANDS.map(b => <option key={b} className="bg-white text-black">{b}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-emerald-600 uppercase">Modo</label>
                    <select className="w-full bg-emerald-50 dark:bg-slate-800 rounded-xl p-3 font-black text-sm outline-none" value={form.mode} onChange={e => setForm({...form, mode: e.target.value})}>
                      {["SSB", "CW", "FT8", "FM", "RTTY"].map(m => <option key={m} className="bg-white text-black">{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-emerald-600 uppercase">RST IN</label>
                    <input className="w-full bg-emerald-50 dark:bg-slate-800 rounded-xl p-3 text-center font-black text-sm outline-none" value={form.rstRcvd} onChange={e => setForm({...form, rstRcvd: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-emerald-600 uppercase">RST OUT</label>
                    <input className="w-full bg-emerald-50 dark:bg-slate-800 rounded-xl p-3 text-center font-black text-sm outline-none" value={form.rstSent} onChange={e => setForm({...form, rstSent: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <button onClick={() => executeSaveQSO()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all text-base">
                    <Save className="w-5 h-5" /> SALVA QSO
                  </button>
                  <button onClick={() => alert("POTA non implementato in questa demo")} className="w-full bg-white dark:bg-slate-800 border-2 border-emerald-100 dark:border-slate-700 font-black py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-base">
                    POTA/SOTA
                  </button>
                </div>
              </section>
            </div>

            <div className="md:col-span-7 space-y-6">
              <section className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-emerald-100 dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-emerald-50 dark:border-slate-800 pb-4 mb-5">
                  <div className="flex items-center gap-3 text-emerald-700">
                    <Clock className="w-5 h-5" />
                    <h3 className="text-xs font-black uppercase tracking-widest">Ultimi Contatti</h3>
                  </div>
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                  {todayQsos.length === 0 ? <p className="text-center py-10 opacity-30 italic">Nessun contatto oggi</p> :
                    todayQsos.slice(0, 5).map(qso => (
                      <div key={qso.id} className="bg-emerald-50/20 dark:bg-slate-800/50 p-4 rounded-2xl border border-emerald-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-700 rounded-xl flex items-center justify-center text-white font-black">{qso.band.replace('m','')}</div>
                          <div>
                            <p className="font-black text-xl uppercase leading-none">{qso.callsign}</p>
                            <p className="text-[10px] font-bold opacity-60 uppercase">{qso.mode} • {qso.distance || 0}km</p>
                          </div>
                        </div>
                        <p className="font-black text-emerald-700">{qso.rstSent}/{qso.rstRcvd}</p>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-8 animate-in slide-in-from-right-10 duration-500 w-full pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
              <div>
                <h3 className="text-3xl font-black tracking-tighter uppercase">Archivio Logbook</h3>
                <p className="text-sm opacity-60 font-bold">{qsos.length} QSO Totali</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={handleImportQRZ} 
                  disabled={isSyncing}
                  className="flex items-center gap-2 bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 disabled:opacity-50 transition-all"
                >
                  <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} /> Sincronizza QRZ
                </button>
                <button 
                  onClick={handleExportADIF}
                  className="flex items-center gap-2 bg-white dark:bg-slate-800 border-2 border-emerald-100 text-emerald-900 dark:text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  <FileDown className="w-4 h-4" /> Esporta ADIF
                </button>
                <button 
                  onClick={() => { if(confirm("Cancellare tutto il log locale?")) { setQsos([]); localStorage.removeItem('hamlog_qsos'); } }}
                  className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 active:scale-90"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {qsos.length === 0 ? <div className="col-span-full text-center py-20 opacity-20 font-black text-2xl">LOG VUOTO</div> :
                qsos.map(qso => (
                  <div key={qso.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-emerald-100 shadow-xl flex flex-col justify-between group hover:border-emerald-500 transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-emerald-50">
                          {qso.profileImage ? <img src={qso.profileImage} className="w-full h-full object-cover" /> : <User className="w-full h-full p-3 opacity-30" />}
                        </div>
                        <div>
                          <h4 className="text-2xl font-black uppercase tracking-tighter leading-none">{qso.callsign}</h4>
                          <p className="text-[10px] font-black text-emerald-600 uppercase mt-1">{new Date(qso.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${qso.synced ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {qso.synced ? 'Sinc' : 'Locale'}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-emerald-50 opacity-80">
                      <div className="text-center">
                        <p className="text-[8px] font-black uppercase opacity-40">Banda</p>
                        <p className="text-xs font-black">{qso.band}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black uppercase opacity-40">Modo</p>
                        <p className="text-xs font-black">{qso.mode}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black uppercase opacity-40">Sent/Rcvd</p>
                        <p className="text-xs font-black">{qso.rstSent}/{qso.rstRcvd}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <div className="h-[70vh] rounded-[3rem] overflow-hidden border-8 border-white shadow-2xl relative z-0">
             <div id="map-container" className="h-full w-full"></div>
             {!location && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-600 text-white px-4 py-2 rounded-full font-black text-xs z-[400] shadow-lg">Attiva GPS per precisione</div>}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border-t border-emerald-100 px-8 py-6 flex justify-around items-center z-[100] shadow-2xl lg:px-72">
        <button onClick={() => setActiveTab('log')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'log' ? 'text-emerald-700 scale-110' : 'text-emerald-200'}`}>
          <Plus className="w-8 h-8" /><span className="text-[9px] font-black">LOG</span>
        </button>
        <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'history' ? 'text-emerald-700 scale-110' : 'text-emerald-200'}`}>
          <History className="w-8 h-8" /><span className="text-[9px] font-black">LISTA</span>
        </button>
        <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'map' ? 'text-emerald-700 scale-110' : 'text-emerald-200'}`}>
          <Globe className="w-8 h-8" /><span className="text-[9px] font-black">MAPPA</span>
        </button>
      </nav>

      {showSettings && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg p-10 rounded-t-[4rem] shadow-2xl animate-in slide-in-from-bottom-80">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black uppercase tracking-tighter">Impostazioni</h3>
              <button onClick={() => setShowSettings(false)} className="p-3 bg-emerald-50 rounded-full active:scale-90 transition-transform"><X className="w-6 h-6 text-emerald-900" /></button>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-emerald-600 uppercase">Tuo Nominativo</label>
                 <input type="text" className="w-full bg-emerald-50 dark:bg-slate-800 rounded-2xl p-5 font-black uppercase outline-none shadow-inner" value={settings.myCall} onChange={e => setSettings({...settings, myCall: e.target.value})} placeholder="IZ1XXX" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-emerald-600 uppercase">QRZ API Key</label>
                 <input type="password" placeholder="Inserisci chiave..." className="w-full bg-emerald-50 dark:bg-slate-800 rounded-2xl p-5 outline-none shadow-inner" value={settings.qrzApiKey} onChange={e => setSettings({...settings, qrzApiKey: e.target.value})} />
              </div>
              <button onClick={() => { localStorage.setItem('hamlog_settings', JSON.stringify(settings)); setShowSettings(false); }} className="w-full bg-emerald-700 text-white font-black py-6 rounded-3xl shadow-xl hover:bg-emerald-800 transition-all uppercase tracking-widest active:scale-95">Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
