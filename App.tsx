
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
  FileUp,
  Trash2
} from 'lucide-react';
import { QSO, UserSettings, DXSpot } from './types';
import { getMaidenhead, calculateDistance, locatorToCoords } from './services/geoService';
import { lookupCallsign, syncWithQRZLogbook, fetchFullLogbook } from './services/qrzService';
import { getLiveDxSpots } from './services/clusterService';

const MOCK_POTA = [
  { id: 'I-0123', name: 'Parco Nazionale dello Stelvio', lat: 46.50, lon: 10.50 },
  { id: 'I-0456', name: 'Parco Regionale dei Colli Euganei', lat: 45.31, lon: 11.71 }
];

const MOCK_SOTA = [
  { id: 'I/LO-123', name: 'Monte Generoso', lat: 45.92, lon: 9.01 },
  { id: 'I/VE-045', name: 'Monte Grappa', lat: 45.87, lon: 11.80 }
];

const DEFAULT_COORDS = { lat: 41.8719, lon: 12.5674 }; 

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
    myLocator: '',
    potaEnabled: true,
    sotaEnabled: true,
    dxClusterEnabled: true,
    refreshInterval: 60,
    enableAudioRecording: true,
    fontSize: 'normal',
    autoSyncEnabled: false
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
    callsign: '',
    rstSent: '59',
    rstRcvd: '59',
    band: '40m',
    mode: 'SSB',
    power: '100W',
    potaRef: '',
    sotaRef: '',
    locator: '',
    distance: 0,
    profileImage: ''
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayQsos = qsos.filter(q => new Date(q.timestamp) >= todayStart);

  const performCloudSync = async (currentLogs: QSO[], currentSettings: UserSettings) => {
    if (!currentSettings.qrzApiKey) {
        setSyncStatus('API Key Mancante');
        return;
    }
    
    setIsSyncing(true);
    setSyncStatus('Sincronizzazione...');
    
    try {
      const updatedLogs = await syncWithQRZLogbook(currentLogs, {
        apiKey: currentSettings.qrzApiKey
      });
      setQsos(updatedLogs);
      localStorage.setItem('hamlog_qsos', JSON.stringify(updatedLogs));
      setSyncStatus('Sincronizzato');
    } catch (err) {
      setSyncStatus('Errore Sync');
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncStatus('Pronto');
      }, 2000);
    }
  };

  const handleImportQRZ = async () => {
    if (!settings.qrzApiKey) {
      alert("Configura la API Key nelle impostazioni per importare il logbook.");
      return;
    }
    setIsSyncing(true);
    setSyncStatus('Importazione...');
    try {
      const remoteLogs = await fetchFullLogbook(settings.qrzApiKey);
      const merged = [...remoteLogs];
      qsos.forEach(localQso => {
        const isDuplicate = merged.some(m => 
          m.callsign === localQso.callsign && 
          Math.abs(new Date(m.timestamp).getTime() - new Date(localQso.timestamp).getTime()) < 60000
        );
        if (!isDuplicate) merged.push(localQso);
      });
      
      const sorted = merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setQsos(sorted);
      localStorage.setItem('hamlog_qsos', JSON.stringify(sorted));
      setSyncStatus('Importazione OK');
    } catch (err) {
      setSyncStatus('Errore Import');
      alert("Impossibile importare il logbook da QRZ.");
    } finally {
      setTimeout(() => setIsSyncing(false), 2000);
    }
  };

  const handleExportADIF = () => {
    if (qsos.length === 0) {
      alert("Il logbook è vuoto. Nulla da esportare.");
      return;
    }

    let adif = `HamLog Pro Export\nADIF Export\n<PROGRAMID:9>HAMLOGPRO\n<EOH>\n\n`;
    
    qsos.forEach(q => {
      const date = new Date(q.timestamp).toISOString().split('T')[0].replace(/-/g, '');
      const time = new Date(q.timestamp).toISOString().split('T')[1].