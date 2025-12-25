
import { GoogleGenAI } from "@google/genai";
import { DXSpot } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getLiveDxSpots = async (): Promise<DXSpot[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Recupera gli ultimi 15 spot DX radioamatoriali reali (frequenza, nominativo DX, nominativo spotter, modo e ora UTC) tipicamente visibili sul cluster italiano cluster.iz3mez.it:8000. Restituisci i dati SOLO in formato JSON come un array di oggetti con i campi: dxCall, freq, mode, spotter, time, comment.",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      },
    });

    const spots: any[] = JSON.parse(response.text || "[]");
    return spots.map((s, index) => ({
      id: `live-${Date.now()}-${index}`,
      dxCall: s.dxCall || "Unknown",
      freq: s.freq || "0.000",
      mode: s.mode || "SSB",
      spotter: s.spotter || "SYS",
      time: s.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      comment: s.comment || ""
    }));
  } catch (error) {
    console.error("Errore nel recupero dei DX Spot reali:", error);
    return [];
  }
};
