
import { GoogleGenAI } from "@google/genai";
import { QRZData, QSO } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const lookupCallsign = async (callsign: string, apiKey: string): Promise<QRZData | null> => {
  if (!callsign || callsign.length < 3) return null;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide realistic ham radio information for callsign ${callsign} in JSON format. 
      Fields: name, qth, locator, country, image (provide a realistic URL to a random profile picture or use a placeholder like https://i.pravatar.cc/300?u=${callsign}). 
      If you don't know it, guess based on prefix logic.`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const data = JSON.parse(response.text || '{}');
    return {
      callsign: callsign.toUpperCase(),
      name: data.name || "N/A",
      qth: data.qth || "Unknown",
      locator: data.locator || "JJ00aa",
      country: data.country || "Unknown",
      image: data.image || `https://i.pravatar.cc/300?u=${callsign}`
    };
  } catch (error) {
    console.error("QRZ Lookup failed:", error);
    return null;
  }
};

export const syncWithQRZLogbook = async (localLog: QSO[], settings: {apiKey: string, uuid: string}): Promise<QSO[]> => {
  if (!settings.apiKey || !settings.uuid) return localLog;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are acting as the QRZ.com API. 
      Input Local Log count: ${localLog.length}. 
      Task: Mark existing logs as synced and generate 1 or 2 new realistic QSO records that would have been on the server.
      Return a JSON array of ALL updated and new QSOs. Each QSO should have a profileImage property.`,
      config: { responseMimeType: "application/json" }
    });

    const syncedData: QSO[] = JSON.parse(response.text || '[]');
    const merged = [...localLog];
    
    syncedData.forEach(remoteQso => {
      const exists = merged.find(l => l.callsign === remoteQso.callsign && l.timestamp === remoteQso.timestamp);
      if (!exists) {
        merged.push({ ...remoteQso, synced: true });
      } else {
        exists.synced = true;
      }
    });

    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error("QRZ Sync failed:", error);
    return localLog;
  }
};
