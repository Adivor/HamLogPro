
export interface QSO {
  id: string;
  timestamp: string;
  callsign: string;
  rstSent: string;
  rstRcvd: string;
  band: string;
  mode: string;
  power: string;
  name: string;
  qth: string;
  locator: string;
  potaRef?: string;
  sotaRef?: string;
  notes?: string;
  synced?: boolean;
  distance?: number;
  audioUrl?: string;
  profileImage?: string;
}

export interface DXSpot {
  id: string;
  dxCall: string;
  freq: string;
  mode: string;
  spotter: string;
  time: string;
  comment?: string;
}

export interface QRZData {
  callsign: string;
  name?: string;
  qth?: string;
  locator?: string;
  country?: string;
  lat?: number;
  lon?: number;
  image?: string;
}

export interface UserSettings {
  myCall: string;
  qrzApiKey: string;
  logbookUuid: string;
  myLocator: string;
  potaEnabled: boolean;
  sotaEnabled: boolean;
  refreshInterval: number;
  enableAudioRecording: boolean;
  fontSize: 'normal' | 'large';
}

export interface Reference {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
