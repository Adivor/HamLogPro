
export const getMaidenhead = (lat: number, lon: number): string => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWX";
  const lower = "abcdefghijklmnopqrstuvwx";
  
  lon += 180;
  lat += 90;

  const f1 = Math.floor(lon / 20);
  const f2 = Math.floor(lat / 10);
  
  const s1 = Math.floor((lon % 20) / 2);
  const s2 = Math.floor((lat % 10));
  
  const t1 = Math.floor((lon % 2) * 12);
  const t2 = Math.floor((lat % 1) * 24);

  return `${upper[f1]}${upper[f2]}${s1}${s2}${lower[t1]}${lower[t2]}`;
};

export const locatorToCoords = (locator: string): { lat: number, lon: number } | null => {
  if (!locator || locator.length < 4) return null;
  const upper = locator.toUpperCase();
  
  let lon = (upper.charCodeAt(0) - 65) * 20 - 180;
  let lat = (upper.charCodeAt(1) - 65) * 10 - 90;
  
  lon += (parseInt(upper[2])) * 2;
  lat += (parseInt(upper[3])) * 1;
  
  // Mid-point of the square
  lon += 1;
  lat += 0.5;

  return { lat, lon };
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
};
