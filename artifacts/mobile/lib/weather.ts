// ─── Open-Meteo weather integration for Kios ────────────────────────────────
// Fetches current conditions + 3-day forecast for the active kitchen location.
// Results are cached for 30 minutes — enough to stay fresh across a service
// without hammering the free Open-Meteo API.

export interface WeatherDay {
  date: string;       // YYYY-MM-DD
  label: string;      // "Mo 12.05"
  maxTemp: number;    // °C rounded
  minTemp: number;    // °C rounded
  code: number;       // WMO weather code
  desc: string;       // German description
  precipSum: number;  // mm
}

export interface WeatherCtx {
  lat: number;
  lon: number;
  locationName: string;
  currentTemp: number;     // °C
  currentCode: number;     // WMO code
  currentDesc: string;     // e.g. "leichter Regen"
  feelsLike: number;       // °C
  windSpeed: number;       // km/h
  precipitation: number;   // mm in last hour
  forecastDays: WeatherDay[];
  updatedAt: number;       // ms timestamp
}

const CACHE_TTL_MS = 30 * 60 * 1000;
let weatherCtxCache: WeatherCtx | null = null;

export function getWeatherCache(): WeatherCtx | null {
  if (!weatherCtxCache) return null;
  if (Date.now() - weatherCtxCache.updatedAt > CACHE_TTL_MS) return null;
  return weatherCtxCache;
}

export function updateWeatherCache(ctx: WeatherCtx | null): void {
  weatherCtxCache = ctx;
}

const WMO_DE: Record<number, string> = {
  0: "klarer Himmel",
  1: "überwiegend klar",
  2: "teilweise bewölkt",
  3: "bedeckt",
  45: "Nebel",
  48: "gefrierender Nebel",
  51: "leichter Nieselregen",
  53: "mäßiger Nieselregen",
  55: "starker Nieselregen",
  61: "leichter Regen",
  63: "mäßiger Regen",
  65: "starker Regen",
  71: "leichter Schneefall",
  73: "mäßiger Schneefall",
  75: "starker Schneefall",
  77: "Eiskörnchen",
  80: "leichte Schauer",
  81: "mäßige Schauer",
  82: "starke Schauer",
  85: "leichte Schneeschauer",
  86: "starke Schneeschauer",
  95: "Gewitter",
  96: "Gewitter mit Hagel",
  99: "Gewitter mit schwerem Hagel",
};

export function wmoDesc(code: number): string {
  return WMO_DE[code] ?? "wechselhaftes Wetter";
}

const DAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Fetch weather from Open-Meteo and populate the module-level cache. */
export async function fetchAndCacheWeather(
  lat: number,
  lon: number,
  locationName: string,
): Promise<WeatherCtx | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: "temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
      timezone: "Europe/Berlin",
      forecast_days: "4",
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      current: {
        temperature_2m: number;
        apparent_temperature: number;
        precipitation: number;
        wind_speed_10m: number;
        weather_code: number;
      };
      daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
      };
    };

    const c = data.current;
    const d = data.daily;

    const forecastDays: WeatherDay[] = d.time.slice(1, 4).map((dateStr, i) => {
      const idx = i + 1;
      const dt = new Date(dateStr + "T12:00:00");
      const [, mm, dd] = dateStr.split("-");
      return {
        date: dateStr,
        label: `${DAYS_DE[dt.getDay()]} ${dd}.${mm}`,
        maxTemp: Math.round(d.temperature_2m_max[idx] ?? 0),
        minTemp: Math.round(d.temperature_2m_min[idx] ?? 0),
        code: d.weather_code[idx] ?? 0,
        desc: wmoDesc(d.weather_code[idx] ?? 0),
        precipSum: Math.round((d.precipitation_sum[idx] ?? 0) * 10) / 10,
      };
    });

    const ctx: WeatherCtx = {
      lat,
      lon,
      locationName,
      currentTemp: Math.round(c.temperature_2m),
      currentCode: c.weather_code,
      currentDesc: wmoDesc(c.weather_code),
      feelsLike: Math.round(c.apparent_temperature),
      windSpeed: Math.round(c.wind_speed_10m),
      precipitation: Math.round(c.precipitation * 10) / 10,
      forecastDays,
      updatedAt: Date.now(),
    };
    updateWeatherCache(ctx);
    return ctx;
  } catch {
    return null;
  }
}

/** Build a compact German weather line for the Kios context string. */
export function buildWeatherContext(w: WeatherCtx): string {
  const now = `Jetzt bei ${w.locationName}: ${w.currentTemp}°C (gefühlt ${w.feelsLike}°C), ${w.currentDesc}, Wind ${w.windSpeed} km/h`;
  const forecast = w.forecastDays
    .map((d) => `${d.label}: ${d.minTemp}–${d.maxTemp}°C, ${d.desc}${d.precipSum > 0 ? `, ${d.precipSum} mm` : ""}`)
    .join(" | ");
  return `${now}\n  3-Tage-Vorschau: ${forecast}`;
}
