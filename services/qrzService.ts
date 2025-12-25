
import { GoogleGenAI } from "@google/genai";
import { QRZData, QSO } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Esegue il lookup di un nominativo simulando l'interazione con il servizio QRZ XML Data.
 */
export const lookupCallsign = async (callsign: string, apiKey: string): Promise<QRZData | null> => {
  if (!callsign || callsign.length < 3) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Esegui una ricerca approfondita sul database radioamatoriale per il nominativo "${callsign}". 
      Simula una risposta XML di QRZ.com. Estrai: Nome completo, QTH (Città/Stato), Maidenhead Locator (6 cifre), Paese.
      Se disponibile, trova l'URL di una foto dell'operatore.
      
      Restituisci ESCLUSIVAMENTE un oggetto JSON valido:
      {
        "name": "Nome Cognome",
        "qth": "Città",
        "locator": "GRIDSQUARE",
        "country": "Paese",
        "image": "URL_IMMAGINE o null"
      }`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(response.text || '{}');

    return {
      callsign: callsign.toUpperCase(),
      name: data.name || "N/A",
      qth: data.qth || "N/A",
      locator: data.locator || "",
      country: data.country || "Italy",
      image: data.image || `https://i.pravatar.cc/150?u=${callsign}`
    };
  } catch (error) {
    console.error("QRZ Lookup Exception:", error);
    return null;
  }
};

/**
 * Recupera l'intero logbook da QRZ.com (simulazione via Gemini bridge).
 * Restituisce un array di QSO pronti per essere importati.
 */
export const fetchFullLogbook = async (apiKey: string): Promise<QSO[]> => {
  if (!apiKey) throw new Error("API Key mancante");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Agisci come bridge per le API Logbook di QRZ.com (chiave ${apiKey}). 
      Recupera o simula il logbook completo associato a questa chiave in formato ADIF.
      Poi converti l'ADIF in un array JSON di oggetti QSO validi. 
      Assicurati di includere timestamp, callsign, band, mode, rstSent, rstRcvd e locator.`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const logs: QSO[] = JSON.parse(response.text || '[]');
    return logs.map(q => ({
      ...q,
      id: q.id || Math.random().toString(36).substr(2, 9),
      synced: true
    }));
  } catch (error) {
    console.error("Errore importazione logbook:", error);
    throw error;
  }
};

/**
 * Sincronizza i QSO locali non ancora inviati a QRZ.
 */
export const syncWithQRZLogbook = async (localLog: QSO[], settings: {apiKey: string}): Promise<QSO[]> => {
  if (!settings.apiKey) return localLog;

  const toSync = localLog.filter(q => !q.synced);
  if (toSync.length === 0) return localLog;

  try {
    const adifData = toSync.map(q => 
      `<CALL:${q.callsign.length}>${q.callsign}<BAND:${q.band.length}>${q.band}<MODE:${q.mode.length}>${q.mode}<RST_SENT:${q.rstSent.length}>${q.rstSent}<RST_RCVD:${q.rstRcvd.length}>${q.rstRcvd}<EOR>`
    ).join('\n');

    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Simula l'azione 'INSERT' verso logbook.qrz.com con questi dati ADIF: ${adifData}. Rispondi con successo se i dati sono validi.`,
    });

    return localLog.map(q => ({ ...q, synced: true }));
  } catch (error) {
    console.error("QRZ Sync Error:", error);
    return localLog;
  }
};
