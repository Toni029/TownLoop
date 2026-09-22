/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState, useEffect } from 'react';
import {
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudLightning,
  Wind,
  Snowflake,
  CloudFog,
  MapPin,
  Clock,
  Sparkles,
  Calendar,
  ChevronRight
} from 'lucide-react';

export type WeatherConditionType =
  | 'sun'       // Sunny / Clear: High visibility with direct sunlight and no clouds
  | 'cloud'     // Cloudy / Overcast: Sky partially/completely covered by clouds, blocking direct sunlight
  | 'rain'      // Rainy / Showers: Liquid water droplets falling from sky to ground
  | 'wind'      // Windy: Fast-moving air currents ranging from breezes to gusts
  | 'snow'      // Snowy: Frozen water vapor falling as soft, white ice crystals
  | 'fog'       // Foggy / Misty: Low-altitude clouds resting near the ground reducing visibility
  | 'storm'     // Stormy: Heavy rainfall with strong winds, thunder, and lightning
  | 'cloudSun'; // Partly Cloudy: Sun with drifting cumulus clouds

export interface HourlyForecast {
  time: string;
  temp: string;
  condition: string;
  shortForecast: string;
  icon: WeatherConditionType;
  pop?: string; // Probability of precipitation
}

export interface DayForecast {
  dayName: string;
  isToday: boolean;
  dateStr: string;
  tag: string;
  temp: string;
  high: string;
  low: string;
  condition: string;
  shortForecast: string;
  iconType: WeatherConditionType;
  hourly: HourlyForecast[];
}

const FALLBACK_FORECAST_DAYS: DayForecast[] = [
  {
    dayName: 'Wednesday',
    isToday: true,
    dateStr: 'Sep 16',
    tag: 'Wed • Sunny & Radiant',
    temp: '74°',
    high: '78°',
    low: '62°',
    condition: 'Sunny & Clear Skies',
    shortForecast: 'Sunny • 78°/62°',
    iconType: 'sun',
    hourly: [
      { time: 'Now', temp: '74°', condition: 'Pure Clear Sunshine', shortForecast: 'Sunny', icon: 'sun' },
      { time: '1 PM', temp: '76°', condition: 'Direct Radiant Sunlight', shortForecast: 'Sunny', icon: 'sun' },
      { time: '2 PM', temp: '77°', condition: 'Warm High-Visibility Sun', shortForecast: 'Sunny', icon: 'sun' },
      { time: '3 PM', temp: '78°', condition: 'Brisk Afternoon Air Currents', shortForecast: 'Windy 18mph', icon: 'wind' },
      { time: '4 PM', temp: '77°', condition: 'Gusty Pine Canopy Wind', shortForecast: 'Windy 22mph', icon: 'wind' },
      { time: '5 PM', temp: '75°', condition: 'Rolling Overcast Cloud Deck', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '6 PM', temp: '73°', condition: 'Dense Volumetric Clouds', shortForecast: 'Overcast', icon: 'cloud' },
      { time: '7 PM', temp: '70°', condition: 'Golden Clear Horizon Twilight', shortForecast: 'Clear', icon: 'sun' },
      { time: '8 PM', temp: '67°', condition: 'Warm Starlit Skies', shortForecast: 'Clear', icon: 'sun' },
      { time: '9 PM', temp: '64°', condition: 'Gentle Night Breeze', shortForecast: 'Clear', icon: 'sun' },
      { time: '10 PM', temp: '62°', condition: 'Crisp Starlit Night', shortForecast: 'Clear', icon: 'sun' },
      { time: '11 PM', temp: '60°', condition: 'Calm Night Air', shortForecast: 'Clear', icon: 'sun' },
      { time: '12 AM', temp: '58°', condition: 'Cool Midnight Twilight', shortForecast: 'Clear', icon: 'sun' }
    ]
  },
  {
    dayName: 'Thursday',
    isToday: false,
    dateStr: 'Sep 17',
    tag: 'Thu • Severe Storm & Lightning',
    temp: '68°',
    high: '71°',
    low: '57°',
    condition: 'Severe Thunderstorm & Lightning',
    shortForecast: 'Storm • 71°/57°',
    iconType: 'storm',
    hourly: [
      { time: 'Now', temp: '68°', condition: 'Dense Dark Cloud Canopy', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '12 PM', temp: '70°', condition: 'Powerful Pre-Storm Wind Gusts', shortForecast: 'Windy 26mph', icon: 'wind' },
      { time: '1 PM', temp: '69°', condition: 'Liquid Rain Droplets Starting', shortForecast: 'Rain 70%', icon: 'rain', pop: '70%' },
      { time: '2 PM', temp: '68°', condition: 'Heavy Rain Showers', shortForecast: 'Rain 85%', icon: 'rain', pop: '85%' },
      { time: '3 PM', temp: '67°', condition: 'Severe Lightning & Thunder', shortForecast: 'Storm 95%', icon: 'storm', pop: '95%' },
      { time: '4 PM', temp: '65°', condition: 'Violent Lightning & Torrential Rain', shortForecast: 'Storm 95%', icon: 'storm', pop: '95%' },
      { time: '5 PM', temp: '64°', condition: 'Thunderhead Storm & High Winds', shortForecast: 'Storm 90%', icon: 'storm', pop: '90%' },
      { time: '6 PM', temp: '63°', condition: 'Driving Liquid Rain Showers', shortForecast: 'Rain 80%', icon: 'rain', pop: '80%' },
      { time: '7 PM', temp: '62°', condition: 'Steady Falling Raindrops', shortForecast: 'Rain 65%', icon: 'rain', pop: '65%' },
      { time: '8 PM', temp: '60°', condition: 'Damp Overcast Cloud Cover', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '9 PM', temp: '59°', condition: 'Brisk Chilly Night Wind', shortForecast: 'Windy 20mph', icon: 'wind' },
      { time: '10 PM', temp: '58°', condition: 'Rolling Dark Clouds', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '11 PM', temp: '57°', condition: 'Cool Overcast Night', shortForecast: 'Cloudy', icon: 'cloud' }
    ]
  },
  {
    dayName: 'Friday',
    isToday: false,
    dateStr: 'Sep 18',
    tag: 'Fri • High Visibility Sunshine',
    temp: '75°',
    high: '77°',
    low: '60°',
    condition: 'Direct Sunlight & Blue Skies',
    shortForecast: 'Clear • 77°/60°',
    iconType: 'sun',
    hourly: [
      { time: 'Now', temp: '75°', condition: 'Unclouded Azure Sky', shortForecast: 'Sunny', icon: 'sun' },
      { time: '12 PM', temp: '76°', condition: 'Radiant Solar Beams', shortForecast: 'Sunny', icon: 'sun' },
      { time: '1 PM', temp: '77°', condition: 'Pure Clear Daylight', shortForecast: 'Sunny', icon: 'sun' },
      { time: '2 PM', temp: '77°', condition: 'Direct Sunlight & Warmth', shortForecast: 'Sunny', icon: 'sun' },
      { time: '3 PM', temp: '76°', condition: 'High Visibility Sunshine', shortForecast: 'Sunny', icon: 'sun' },
      { time: '4 PM', temp: '75°', condition: 'Golden Afternoon Rays', shortForecast: 'Sunny', icon: 'sun' },
      { time: '5 PM', temp: '73°', condition: 'Unobstructed Solar Glow', shortForecast: 'Sunny', icon: 'sun' },
      { time: '6 PM', temp: '71°', condition: 'Vibrant Sunset Radiance', shortForecast: 'Sunny', icon: 'sun' },
      { time: '7 PM', temp: '68°', condition: 'Clear Horizon Twilight', shortForecast: 'Clear', icon: 'sun' },
      { time: '8 PM', temp: '65°', condition: 'Crisp Starlit Evening', shortForecast: 'Clear', icon: 'sun' },
      { time: '9 PM', temp: '63°', condition: 'Gentle Clear Starlight', shortForecast: 'Clear', icon: 'sun' },
      { time: '10 PM', temp: '61°', condition: 'Calm Night Skies', shortForecast: 'Clear', icon: 'sun' },
      { time: '11 PM', temp: '60°', condition: 'Cool Clear Midnight', shortForecast: 'Clear', icon: 'sun' }
    ]
  },
  {
    dayName: 'Saturday',
    isToday: false,
    dateStr: 'Sep 19',
    tag: 'Sat • Rolling Overcast & Wind',
    temp: '71°',
    high: '74°',
    low: '59°',
    condition: 'Overcast & Swift Winds',
    shortForecast: 'Overcast • 74°/59°',
    iconType: 'cloud',
    hourly: [
      { time: 'Now', temp: '71°', condition: 'Volumetric Cloud Ceiling', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '12 PM', temp: '73°', condition: 'Dense Overcast Deck', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '1 PM', temp: '74°', condition: 'Fast-Moving Air Currents', shortForecast: 'Windy 22mph', icon: 'wind' },
      { time: '2 PM', temp: '73°', condition: 'Blustery Pine Gusts', shortForecast: 'Windy 25mph', icon: 'wind' },
      { time: '3 PM', temp: '72°', condition: 'Heavy Grey Stratus Clouds', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '4 PM', temp: '71°', condition: 'Billowing Cloud Masses', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '5 PM', temp: '69°', condition: 'Liquid Rain Droplets', shortForecast: 'Rain 50%', icon: 'rain', pop: '50%' },
      { time: '6 PM', temp: '67°', condition: 'Passing Rain Showers', shortForecast: 'Rain 65%', icon: 'rain', pop: '65%' },
      { time: '7 PM', temp: '65°', condition: 'Overcast Cloud Blanket', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '8 PM', temp: '63°', condition: 'Cool Night Breezes', shortForecast: 'Windy 18mph', icon: 'wind' },
      { time: '9 PM', temp: '61°', condition: 'Heavy Cloud Ceiling', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '10 PM', temp: '60°', condition: 'Dense Overcast', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '11 PM', temp: '59°', condition: 'Chilly Cloudy Night', shortForecast: 'Cloudy', icon: 'cloud' }
    ]
  },
  {
    dayName: 'Sunday',
    isToday: false,
    dateStr: 'Sep 20',
    tag: 'Sun • Cascading Rain Showers',
    temp: '63°',
    high: '66°',
    low: '54°',
    condition: 'Liquid Rain Droplets & Showers',
    shortForecast: 'Rain • 66°/54°',
    iconType: 'rain',
    hourly: [
      { time: 'Now', temp: '63°', condition: 'Steady Falling Raindrops', shortForecast: 'Rain 85%', icon: 'rain', pop: '85%' },
      { time: '12 PM', temp: '65°', condition: 'Continuous Liquid Rain Droplets', shortForecast: 'Rain 90%', icon: 'rain', pop: '90%' },
      { time: '1 PM', temp: '66°', condition: 'Sudden Thunder Flash & Rain', shortForecast: 'Storm 85%', icon: 'storm', pop: '85%' },
      { time: '2 PM', temp: '65°', condition: 'Violent Lightning Strike & Gale', shortForecast: 'Storm 85%', icon: 'storm', pop: '85%' },
      { time: '3 PM', temp: '64°', condition: 'Heavy Liquid Rain Showers', shortForecast: 'Rain 90%', icon: 'rain', pop: '90%' },
      { time: '4 PM', temp: '63°', condition: 'Wind-Swept Rain Droplets', shortForecast: 'Windy 20mph', icon: 'wind' },
      { time: '5 PM', temp: '62°', condition: 'Brisk Wet Gale Currents', shortForecast: 'Windy 22mph', icon: 'wind' },
      { time: '6 PM', temp: '60°', condition: 'Steady Evening Rain', shortForecast: 'Rain 75%', icon: 'rain', pop: '75%' },
      { time: '7 PM', temp: '58°', condition: 'Gentle Rain Drizzle', shortForecast: 'Rain 60%', icon: 'rain', pop: '60%' },
      { time: '8 PM', temp: '57°', condition: 'Damp Heavy Overcast', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '9 PM', temp: '56°', condition: 'Dense Night Clouds', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '10 PM', temp: '55°', condition: 'Cool Overcast Night', shortForecast: 'Cloudy', icon: 'cloud' },
      { time: '11 PM', temp: '54°', condition: 'Chilled Damp Midnight', shortForecast: 'Cloudy', icon: 'cloud' }
    ]
  }
];

function getConditionTheme(condition: WeatherConditionType) {
  switch (condition) {
    case 'sun':
      return {
        bgGradient: 'from-[#165bb8] via-[#277ece] to-[#5ea7f7]',
        borderColor: 'border-sky-300/40',
        tagBg: 'bg-amber-100 dark:bg-amber-950/70',
        tagText: 'text-amber-950 dark:text-amber-200',
        tagBorder: 'border-amber-300',
        tagDotColor: 'bg-amber-500'
      };
    case 'cloudSun':
      return {
        bgGradient: 'from-[#1c4f7f] via-[#306695] to-[#558bb3]',
        borderColor: 'border-slate-300/40',
        tagBg: 'bg-stone-200 dark:bg-slate-800',
        tagText: 'text-stone-900 dark:text-slate-100',
        tagBorder: 'border-stone-300',
        tagDotColor: 'bg-amber-600'
      };
    case 'cloud':
      return {
        bgGradient: 'from-[#1b2636] via-[#2d3a4d] to-[#455468]',
        borderColor: 'border-slate-400/40',
        tagBg: 'bg-slate-200 dark:bg-slate-800',
        tagText: 'text-slate-900 dark:text-slate-100',
        tagBorder: 'border-slate-300',
        tagDotColor: 'bg-slate-400'
      };
    case 'rain':
      return {
        bgGradient: 'from-[#0b1625] via-[#142337] to-[#22364f]',
        borderColor: 'border-sky-400/35',
        tagBg: 'bg-sky-100 dark:bg-sky-950/70',
        tagText: 'text-sky-950 dark:text-sky-200',
        tagBorder: 'border-sky-300',
        tagDotColor: 'bg-sky-400'
      };
    case 'wind':
      return {
        bgGradient: 'from-[#173e63] via-[#24537c] to-[#3f739e]',
        borderColor: 'border-teal-300/40',
        tagBg: 'bg-teal-100 dark:bg-teal-950/70',
        tagText: 'text-teal-950 dark:text-teal-200',
        tagBorder: 'border-teal-300',
        tagDotColor: 'bg-teal-400'
      };
    case 'snow':
      return {
        bgGradient: 'from-[#2b3a4a] via-[#43576c] to-[#6c859e]',
        borderColor: 'border-cyan-200/50',
        tagBg: 'bg-cyan-50 dark:bg-cyan-950/70',
        tagText: 'text-cyan-950 dark:text-cyan-200',
        tagBorder: 'border-cyan-200',
        tagDotColor: 'bg-cyan-400'
      };
    case 'fog':
      return {
        bgGradient: 'from-[#333d47] via-[#4a5560] to-[#6b7782]',
        borderColor: 'border-stone-400/40',
        tagBg: 'bg-stone-200 dark:bg-stone-800',
        tagText: 'text-stone-900 dark:text-stone-100',
        tagBorder: 'border-stone-300',
        tagDotColor: 'bg-stone-400'
      };
    case 'storm':
      return {
        bgGradient: 'from-[#070b14] via-[#0f1624] to-[#182133]',
        borderColor: 'border-violet-400/50',
        tagBg: 'bg-violet-100 dark:bg-violet-950/70',
        tagText: 'text-violet-950 dark:text-violet-200',
        tagBorder: 'border-violet-300',
        tagDotColor: 'bg-violet-400'
      };
  }
}

// Weather code interpretation mapping for Zip Code 32221 (Jacksonville, FL)
export function mapWeatherCode(
  code: number,
  windSpeedMph?: number
): {
  label: string;
  condition: string;
  shortForecast: string;
  icon: WeatherConditionType;
} {
  const isHighWind = (windSpeedMph ?? 0) >= 22;

  switch (code) {
    case 0:
      return {
        label: isHighWind ? 'Windy & Clear' : 'Clear',
        condition: isHighWind ? 'Clear Skies & Swift Winds' : 'Clear & Sunny Skies',
        shortForecast: isHighWind ? `Windy ${Math.round(windSpeedMph!)}mph` : 'Clear',
        icon: isHighWind ? 'wind' : 'sun'
      };
    case 1:
      return {
        label: isHighWind ? 'Windy & Mainly Clear' : 'Mainly Clear',
        condition: isHighWind ? 'Mainly Clear Skies & Winds' : 'Mainly Clear Skies',
        shortForecast: isHighWind ? `Windy ${Math.round(windSpeedMph!)}mph` : 'Mostly Clear',
        icon: isHighWind ? 'wind' : 'sun'
      };
    case 2:
      return {
        label: isHighWind ? 'Breezy & Partly Cloudy' : 'Partly Cloudy',
        condition: isHighWind ? 'Partly Cloudy & Swift Winds' : 'Partly Cloudy Skies',
        shortForecast: isHighWind ? `Windy ${Math.round(windSpeedMph!)}mph` : 'Partly Cloudy',
        icon: isHighWind ? 'wind' : 'cloudSun'
      };
    case 3:
      return {
        label: isHighWind ? 'Windy & Overcast' : 'Overcast',
        condition: isHighWind ? 'Overcast Cloud Deck & Gusty Winds' : 'Overcast Cloud Deck',
        shortForecast: isHighWind ? `Windy ${Math.round(windSpeedMph!)}mph` : 'Overcast',
        icon: isHighWind ? 'wind' : 'cloud'
      };
    case 45:
    case 48:
      return {
        label: 'Fog',
        condition: 'Foggy & Reduced Visibility',
        shortForecast: 'Fog',
        icon: 'fog'
      };
    case 51:
      return {
        label: 'Light Drizzle',
        condition: 'Light Falling Drizzle',
        shortForecast: 'Lt Drizzle',
        icon: 'rain'
      };
    case 53:
    case 55:
      return {
        label: 'Drizzle',
        condition: 'Steady Liquid Drizzle',
        shortForecast: 'Drizzle',
        icon: 'rain'
      };
    case 56:
    case 57:
      return {
        label: 'Freezing Drizzle',
        condition: 'Freezing Liquid Drizzle',
        shortForecast: 'Frz Drizzle',
        icon: 'rain'
      };
    case 61:
      return {
        label: 'Light Rain',
        condition: 'Light Rain Showers',
        shortForecast: 'Light Rain',
        icon: 'rain'
      };
    case 63:
      return {
        label: 'Rain',
        condition: 'Steady Liquid Rain Droplets',
        shortForecast: 'Rain',
        icon: 'rain'
      };
    case 65:
      return {
        label: 'Heavy Rain',
        condition: 'Heavy Liquid Rain Showers',
        shortForecast: 'Heavy Rain',
        icon: 'rain'
      };
    case 66:
    case 67:
      return {
        label: 'Freezing Rain',
        condition: 'Freezing Liquid Rain Showers',
        shortForecast: 'Freezing Rain',
        icon: 'rain'
      };
    case 71:
      return {
        label: 'Light Snow',
        condition: 'Light Falling Snowflakes',
        shortForecast: 'Light Snow',
        icon: 'snow'
      };
    case 73:
    case 75:
    case 77:
      return {
        label: 'Snow',
        condition: 'Falling Snow & Ice Crystals',
        shortForecast: 'Snow',
        icon: 'snow'
      };
    case 80:
      return {
        label: 'Light Showers',
        condition: 'Passing Rain Showers',
        shortForecast: 'Lt Showers',
        icon: 'rain'
      };
    case 81:
    case 82:
      return {
        label: 'Rain Showers',
        condition: 'Cascading Liquid Rain Showers',
        shortForecast: 'Showers',
        icon: 'rain'
      };
    case 85:
    case 86:
      return {
        label: 'Snow Showers',
        condition: 'Passing Snow Showers',
        shortForecast: 'Snow Showers',
        icon: 'snow'
      };
    case 95:
      return {
        label: 'Thunderstorm',
        condition: 'Thunderstorm & Lightning',
        shortForecast: 'Storm',
        icon: 'storm'
      };
    case 96:
    case 99:
      return {
        label: 'Severe Thunderstorm',
        condition: 'Severe Thunderstorm & Lightning',
        shortForecast: 'Severe Storm',
        icon: 'storm'
      };
    default:
      return {
        label: 'Partly Cloudy',
        condition: 'Partly Cloudy Skies',
        shortForecast: 'Partly Cloudy',
        icon: 'cloudSun'
      };
  }
}

function formatHourLabel(isoString: string): string {
  const parts = isoString.split('T');
  if (parts.length > 1) {
    const hour = parseInt(parts[1].split(':')[0], 10);
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  }
  return isoString;
}

// Open-Meteo API URL for Zip Code 32221 (Jacksonville, FL) with &timezone=America%2FNew_York
const OPEN_METEO_API_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=30.29&longitude=-81.84&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York';

interface CachedWeatherPayload {
  timestamp: number;
  forecastDays: DayForecast[];
  currentRealTimeWeather: {
    temp: string;
    windSpeed: number;
    humidity: number;
    weatherCode: number;
    label: string;
    condition: string;
    shortForecast: string;
    icon: WeatherConditionType;
  };
}

const WEATHER_CACHE_KEY = 'cecil_pines_weather_cache_v2';
const WEATHER_CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes cache (refreshes only after 30-60 min)

let inMemoryWeatherCache: CachedWeatherPayload | null = null;

function loadCachedWeather(): CachedWeatherPayload | null {
  if (inMemoryWeatherCache && Date.now() - inMemoryWeatherCache.timestamp < WEATHER_CACHE_TTL_MS) {
    return inMemoryWeatherCache;
  }
  try {
    const raw = sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (raw) {
      const parsed: CachedWeatherPayload = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.timestamp === 'number' &&
        Date.now() - parsed.timestamp < WEATHER_CACHE_TTL_MS &&
        Array.isArray(parsed.forecastDays) &&
        parsed.forecastDays.length > 0 &&
        parsed.currentRealTimeWeather?.temp
      ) {
        inMemoryWeatherCache = parsed;
        return parsed;
      }
    }
  } catch {
    // sessionStorage unavailable
  }
  return null;
}

function saveCachedWeather(payload: {
  forecastDays: DayForecast[];
  currentRealTimeWeather: CachedWeatherPayload['currentRealTimeWeather'];
}) {
  const data: CachedWeatherPayload = {
    ...payload,
    timestamp: Date.now()
  };
  inMemoryWeatherCache = data;
  try {
    sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage quota/disabled errors
  }
}

export const WeatherWidget: React.FC = () => {
  const initialCache = loadCachedWeather();

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);
  const [forecastDays, setForecastDays] = useState<DayForecast[]>(
    () => initialCache?.forecastDays ?? []
  );
  // Dedicated state directly populated from data.current (current.temperature_2m)
  const [currentRealTimeWeather, setCurrentRealTimeWeather] = useState<{
    temp: string;
    windSpeed: number;
    humidity: number;
    weatherCode: number;
    label: string;
    condition: string;
    shortForecast: string;
    icon: WeatherConditionType;
  } | null>(() => initialCache?.currentRealTimeWeather ?? null);

  // Fetch real-time client-side weather data for Zip Code 32221 (Lat: 30.29, Lon: -81.84)
  useEffect(() => {
    // Check if we already have valid cached weather (within 30-60 min TTL)
    const validCache = loadCachedWeather();
    if (validCache) {
      if (!currentRealTimeWeather || forecastDays.length === 0) {
        setForecastDays(validCache.forecastDays);
        setCurrentRealTimeWeather(validCache.currentRealTimeWeather);
      }
      return;
    }

    let isMounted = true;

    async function fetchRealTimeWeather() {
      try {
        const response = await fetch(OPEN_METEO_API_URL);
        if (!response.ok) {
          throw new Error(`Open-Meteo HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!isMounted || !data.current || !data.hourly || !data.daily) return;

        // 1. Current Conditions: directly extract current.temperature_2m, wind_speed_10m, and relative_humidity_2m
        const currentTempRaw = data.current.temperature_2m;
        const currentTemp = Math.round(currentTempRaw);
        const currentWind = Math.round(data.current.wind_speed_10m);
        const currentHumidity = Math.round(data.current.relative_humidity_2m);
        const currentCode = data.current.weather_code;
        const currentMapped = mapWeatherCode(currentCode, currentWind);

        const realTimePayload = {
          temp: `${currentTemp}°`,
          windSpeed: currentWind,
          humidity: currentHumidity,
          weatherCode: currentCode,
          label: currentMapped.label,
          condition: `${currentMapped.label} • Wind ${currentWind} mph • ${currentHumidity}% Humidity`,
          shortForecast: currentMapped.label,
          icon: currentMapped.icon
        };

        // Find current hour index in data.hourly.time
        let curHourIdx = 0;
        if (data.current.time) {
          const prefix = data.current.time.slice(0, 13);
          const foundIdx = data.hourly.time.findIndex((t: string) => t.startsWith(prefix));
          if (foundIdx !== -1) {
            curHourIdx = foundIdx;
          }
        }

        // 2. Next 12 Hours Forecast
        const next12Hours: HourlyForecast[] = [];
        for (let i = 0; i < 12; i++) {
          const hIdx = curHourIdx + i;
          if (hIdx >= data.hourly.time.length) break;

          if (i === 0) {
            const popVal = data.hourly.precipitation_probability?.[hIdx];
            next12Hours.push({
              time: 'Now',
              temp: `${currentTemp}°`,
              condition: `${currentMapped.label} • Wind ${currentWind} mph • ${currentHumidity}% Humidity`,
              shortForecast: currentMapped.label,
              icon: currentMapped.icon,
              pop: popVal && popVal > 0 ? `${popVal}%` : undefined
            });
          } else {
            const hTime = formatHourLabel(data.hourly.time[hIdx]);
            const hTemp = Math.round(data.hourly.temperature_2m[hIdx]);
            const hWind = Math.round(data.hourly.wind_speed_10m[hIdx]);
            const hHum = Math.round(data.hourly.relative_humidity_2m[hIdx]);
            const hPop = data.hourly.precipitation_probability?.[hIdx];
            const hMapped = mapWeatherCode(data.hourly.weather_code[hIdx], hWind);

            next12Hours.push({
              time: hTime,
              temp: `${hTemp}°`,
              condition: `${hMapped.label} • Wind ${hWind} mph • ${hHum}% Humidity`,
              shortForecast: hPop && hPop > 30 ? `${hMapped.label} ${hPop}%` : hMapped.label,
              icon: hMapped.icon,
              pop: hPop && hPop > 0 ? `${hPop}%` : undefined
            });
          }
        }

        // 3. 5-Day Outlook
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const updatedDays: DayForecast[] = [];

        const daysCount = Math.min(5, data.daily.time.length);
        for (let d = 0; d < daysCount; d++) {
          const dateStrRaw = data.daily.time[d];
          const [year, month, day] = dateStrRaw.split('-').map(Number);
          const dateObj = new Date(year, (month || 1) - 1, day || 1);
          const dayName = dayNames[dateObj.getDay()];
          const dateFormatted = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
          const isToday = d === 0;

          const dMax = Math.round(data.daily.temperature_2m_max[d]);
          const dMin = Math.round(data.daily.temperature_2m_min[d]);
          const dCode = data.daily.weather_code[d];
          const dMapped = mapWeatherCode(dCode);

          if (isToday) {
            updatedDays.push({
              dayName,
              isToday: true,
              dateStr: dateFormatted,
              tag: `${dayName.slice(0, 3)} • ${currentMapped.label} • ${currentWind} mph Wind`,
              temp: `${currentTemp}°`,
              high: `${dMax}°`,
              low: `${dMin}°`,
              condition: `${currentMapped.label} • Wind ${currentWind} mph • ${currentHumidity}% Humidity`,
              shortForecast: `${currentMapped.label} • ${dMax}°/${dMin}°`,
              iconType: currentMapped.icon,
              hourly: next12Hours
            });
          } else {
            // Populate hourly for day
            const dayHourly: HourlyForecast[] = [];
            const dayIndices: number[] = [];
            data.hourly.time.forEach((t: string, idx: number) => {
              if (t.startsWith(dateStrRaw)) {
                dayIndices.push(idx);
              }
            });

            const sampleIndices = dayIndices.length >= 12 ? dayIndices.slice(0, 12) : dayIndices;
            sampleIndices.forEach((hIdx, idx) => {
              const hTime = idx === 0 ? 'Morning' : formatHourLabel(data.hourly.time[hIdx]);
              const hTemp = Math.round(data.hourly.temperature_2m[hIdx]);
              const hWind = Math.round(data.hourly.wind_speed_10m[hIdx]);
              const hHum = Math.round(data.hourly.relative_humidity_2m[hIdx]);
              const hPop = data.hourly.precipitation_probability?.[hIdx];
              const hMapped = mapWeatherCode(data.hourly.weather_code[hIdx], hWind);

              dayHourly.push({
                time: hTime,
                temp: `${hTemp}°`,
                condition: `${hMapped.label} • Wind ${hWind} mph • ${hHum}% Humidity`,
                shortForecast: hPop && hPop > 30 ? `${hMapped.label} ${hPop}%` : hMapped.label,
                icon: hMapped.icon,
                pop: hPop && hPop > 0 ? `${hPop}%` : undefined
              });
            });

            updatedDays.push({
              dayName,
              isToday: false,
              dateStr: dateFormatted,
              tag: `${dayName.slice(0, 3)} • ${dMapped.label}`,
              temp: `${dMax}°`,
              high: `${dMax}°`,
              low: `${dMin}°`,
              condition: `${dMapped.condition} • High ${dMax}° / Low ${dMin}°`,
              shortForecast: `${dMapped.label} • ${dMax}°/${dMin}°`,
              iconType: dMapped.icon,
              hourly: dayHourly.length > 0 ? dayHourly : next12Hours
            });
          }
        }

        if (isMounted) {
          setCurrentRealTimeWeather(realTimePayload);
          setForecastDays(updatedDays);
          saveCachedWeather({
            forecastDays: updatedDays,
            currentRealTimeWeather: realTimePayload
          });
        }
      } catch (err) {
        console.warn('Could not fetch real-time Open-Meteo weather data, using fallback:', err);
        if (isMounted && forecastDays.length === 0) {
          setForecastDays(FALLBACK_FORECAST_DAYS);
        }
      }
    }

    fetchRealTimeWeather();

    return () => {
      isMounted = false;
    };
  }, []);

  // If no cached or fetched data is available yet, display subtle skeleton loader without hardcoded flash
  if (forecastDays.length === 0) {
    return (
      <div className="space-y-2">
        {/* Top Header Row with Location */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-stone-700 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="text-xs font-bold text-stone-900 tracking-tight truncate">
              Cecil Pines
            </span>
            <span className="text-[11px] text-stone-400 font-medium hidden sm:inline">
              • Jacksonville, FL
            </span>
          </div>
          <div className="h-6 w-28 rounded-full bg-stone-200/80 dark:bg-stone-800 animate-pulse" />
        </div>

        {/* Dynamic Animated iOS Weather Canvas Card - Skeleton Loader */}
        <div className="relative overflow-hidden rounded-[28px] p-5 shadow-lg border border-sky-300/40 text-white bg-gradient-to-b from-[#1e4d79] via-[#2d6898] to-[#4585b5] transition-all duration-700">
          <div className="relative z-10 flex items-start justify-between gap-2">
            <div className="space-y-2 min-w-0">
              <div className="flex items-baseline gap-2">
                <div className="w-24 sm:w-28 h-12 sm:h-14 bg-white/20 rounded-2xl animate-pulse" />
                <div className="w-16 h-4 bg-white/20 rounded-full animate-pulse" />
              </div>
              <div className="w-40 sm:w-48 h-4 bg-white/20 rounded-full animate-pulse mt-1" />
            </div>

            <div className="flex flex-col items-end shrink-0">
              <div className="w-16 h-3 bg-white/20 rounded-full animate-pulse mb-1.5" />
              <div className="w-24 h-7 bg-white/20 rounded-xl animate-pulse" />
            </div>
          </div>

          {/* Hourly Forecast Strip Skeleton */}
          <div className="relative z-10 mt-3.5 pt-3 border-t border-white/20">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/90 mb-2">
              <div className="w-32 h-3 bg-white/20 rounded-full animate-pulse" />
              <div className="w-20 h-3 bg-white/20 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 pt-0.5 px-0.5 -mx-1 px-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 flex flex-col items-center py-2 px-3 rounded-2xl min-w-[64px] h-[82px] bg-white/15 animate-pulse"
                />
              ))}
            </div>
          </div>

          {/* 5-Day Outlook Skeleton */}
          <div className="relative z-10 mt-3 pt-3 border-t border-white/20">
            <div className="w-24 h-3 bg-white/20 rounded-full animate-pulse mb-2" />
            <div className="grid grid-cols-5 gap-1.5">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-white/15 animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentDay = forecastDays[selectedDayIndex] || forecastDays[0];
  const activeHour = currentDay.hourly[selectedHourIndex] || currentDay.hourly[0];
  const isViewingCurrent = selectedDayIndex === 0 && selectedHourIndex === 0;

  // 'Current Temperature' maps directly to current.temperature_2m field from API response
  const currentTemperatureDisplay = isViewingCurrent && currentRealTimeWeather !== null
    ? currentRealTimeWeather.temp
    : activeHour.temp;
  const currentConditionDisplay = isViewingCurrent && currentRealTimeWeather !== null
    ? currentRealTimeWeather.condition
    : activeHour.condition;
  const currentShortForecastDisplay = isViewingCurrent && currentRealTimeWeather !== null
    ? currentRealTimeWeather.shortForecast
    : activeHour.shortForecast;
  const activeCondition: WeatherConditionType = (isViewingCurrent && currentRealTimeWeather !== null)
    ? currentRealTimeWeather.icon
    : activeHour.icon;
  const theme = getConditionTheme(activeCondition);

  const handleSelectDay = (dayIdx: number) => {
    setSelectedDayIndex(dayIdx);
    setSelectedHourIndex(0);
  };

  const handleSelectHour = (hourIdx: number) => {
    setSelectedHourIndex(hourIdx);
  };

  return (
    <div className="space-y-2">
      {/* Top Header Row with Location and Dynamic Status Tag */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-stone-700 min-w-0">
          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="text-xs font-bold text-stone-900 tracking-tight truncate">
            Cecil Pines
          </span>
          <span className="text-[11px] text-stone-400 font-medium hidden sm:inline">
            • Jacksonville, FL
          </span>
        </div>

        {/* The single, dedicated tag for the day & active hour */}
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${theme.tagBg} ${theme.tagText} border ${theme.tagBorder} shadow-2xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-300`}
        >
          <span className={`w-2 h-2 rounded-full ${theme.tagDotColor} animate-pulse`} />
          {activeHour.time === 'Now'
            ? currentDay.tag
            : `${currentDay.dayName.slice(0, 3)} • ${activeHour.time}: ${activeHour.shortForecast}`}
        </span>
      </div>

      {/* Dynamic Animated iOS Weather Canvas Card */}
      <div
        className={`relative overflow-hidden rounded-[28px] p-5 shadow-lg border ${theme.borderColor} text-white bg-gradient-to-b ${theme.bgGradient} transition-all duration-700`}
      >
        {/* ================= MASTER PROCEDURAL SVG CLOUD & LIGHT FILTERS ================= */}
        <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
          <defs>
            {/* 1. Volumetric Overcast Cumulus & Stratocumulus Fractal Filter */}
            <filter id="filter-cloud-overcast" x="-35%" y="-35%" width="170%" height="170%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.016" numOctaves="5" seed="42" result="cloudNoise" />
              <feDisplacementMap in="SourceGraphic" in2="cloudNoise" scale="42" xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feGaussianBlur in="displaced" stdDeviation="3.6" result="softCloud" />
              <feMerge>
                <feMergeNode in="softCloud" />
                <feMergeNode in="displaced" opacity="0.82" />
              </feMerge>
            </filter>

            {/* 2. High-Velocity Wind-Sheared Cirrus & Fractus Cloud Filter */}
            <filter id="filter-cloud-wispy-wind" x="-40%" y="-40%" width="180%" height="180%">
              <feTurbulence type="fractalNoise" baseFrequency="0.0032 0.038" numOctaves="4" seed="73" result="windNoise" />
              <feDisplacementMap in="SourceGraphic" in2="windNoise" scale="54" xChannelSelector="R" yChannelSelector="G" result="windDisplaced" />
              <feGaussianBlur in="windDisplaced" stdDeviation="2.4" result="windSoft" />
              <feMerge>
                <feMergeNode in="windSoft" />
                <feMergeNode in="windDisplaced" opacity="0.8" />
              </feMerge>
            </filter>

            {/* 3. Dark Violent Supercell Storm Cloud Shelf Filter */}
            <filter id="filter-cloud-storm" x="-35%" y="-35%" width="170%" height="170%">
              <feTurbulence type="fractalNoise" baseFrequency="0.015 0.022" numOctaves="5" seed="19" result="stormNoise" />
              <feDisplacementMap in="SourceGraphic" in2="stormNoise" scale="48" xChannelSelector="R" yChannelSelector="G" result="stormDisplaced" />
              <feGaussianBlur in="stormDisplaced" stdDeviation="4.2" result="stormSoft" />
              <feMerge>
                <feMergeNode in="stormSoft" />
                <feMergeNode in="stormDisplaced" opacity="0.88" />
              </feMerge>
            </filter>

            {/* 4. Realistic Sunlit Cumulus with Illuminated Silver Lining */}
            <filter id="filter-cloud-partly" x="-30%" y="-30%" width="160%" height="160%">
              <feTurbulence type="fractalNoise" baseFrequency="0.013 0.017" numOctaves="4" seed="31" result="partlyNoise" />
              <feDisplacementMap in="SourceGraphic" in2="partlyNoise" scale="38" xChannelSelector="R" yChannelSelector="G" result="partlyDisplaced" />
              <feGaussianBlur in="partlyDisplaced" stdDeviation="3" result="partlySoft" />
              <feMerge>
                <feMergeNode in="partlySoft" />
                <feMergeNode in="partlyDisplaced" opacity="0.85" />
              </feMerge>
            </filter>

            {/* 5. Lightning High-Voltage Ion Glow */}
            <filter id="lightningGlowEnhanced" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur3" />
              <feMerge>
                <feMergeNode in="blur3" />
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
        
        {/* ================= REALISTIC CONDITION ANIMATIONS ================= */}

        {/* 1. SUNNY / CLEAR: Unmodified, kept exactly how it currently is as requested */}
        {activeCondition === 'sun' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden animate-in fade-in duration-500">
            {/* Full-Tile Radiant Solar Ambient Wash */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-200/30 via-yellow-200/15 to-transparent pointer-events-none" />
            <div className="absolute -top-24 -right-20 w-[130%] h-[130%] rounded-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-200/50 via-yellow-300/20 to-transparent blur-3xl animate-pulse-glow" />

            {/* Glowing Golden Solar Chromosphere Core */}
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-r from-white via-amber-100 to-yellow-200 blur-xl opacity-95 animate-pulse-glow" />

            {/* Broad Sweeping Sunbeam Light Shafts SPANNING THE ENTIRE TILE from top-right to bottom-left */}
            <div className="absolute inset-0 opacity-55 animate-sunbeam-full pointer-events-none">
              <svg viewBox="0 0 400 300" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="fullTileSunbeam1" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
                    <stop offset="35%" stopColor="#fef08a" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#fef08a" stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="fullTileSunbeam2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
                    <stop offset="45%" stopColor="#fed7aa" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#fed7aa" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points="380,0 320,0 0,220 0,300" fill="url(#fullTileSunbeam1)" />
                <polygon points="400,0 400,80 120,300 0,300" fill="url(#fullTileSunbeam2)" />
                <polygon points="360,0 400,30 240,300 160,300" fill="url(#fullTileSunbeam1)" />
                <polygon points="400,0 400,160 300,300 220,300" fill="url(#fullTileSunbeam2)" />
              </svg>
            </div>

            {/* Rotating 32-Ray Corona */}
            <svg
              className="absolute -top-28 -right-28 w-96 h-96 opacity-60 animate-spin-very-slow pointer-events-none"
              viewBox="0 0 200 200"
              fill="none"
            >
              <circle cx="100" cy="100" r="32" fill="url(#sunCoreGlowFull)" />
              {Array.from({ length: 32 }).map((_, i) => (
                <line
                  key={i}
                  x1="100"
                  y1="100"
                  x2={100 + Math.cos((i * 11.25 * Math.PI) / 180) * (92 + (i % 4) * 8)}
                  y2={100 + Math.sin((i * 11.25 * Math.PI) / 180) * (92 + (i % 4) * 8)}
                  stroke="rgba(255, 250, 210, 0.6)"
                  strokeWidth={i % 2 === 0 ? '2' : '1'}
                  strokeLinecap="round"
                />
              ))}
              <defs>
                <radialGradient id="sunCoreGlowFull" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                  <stop offset="50%" stopColor="#fef08a" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>

            {/* Diagonal Lens Flare Sequence across the tile */}
            <div className="absolute top-12 right-28 w-14 h-14 rounded-full border border-yellow-200/50 bg-yellow-100/20 blur-[1px] animate-flare" />
            <div className="absolute top-24 right-48 w-8 h-8 rounded-full border border-emerald-300/40 bg-emerald-200/20 blur-[0.5px] animate-flare" style={{ animationDelay: '1.8s' }} />
            <div className="absolute top-36 right-64 w-12 h-12 rounded-full border border-amber-300/35 bg-amber-100/15 blur-[1px] animate-flare" style={{ animationDelay: '3s' }} />
            <div className="absolute bottom-12 left-16 w-16 h-16 rounded-full border border-cyan-300/30 bg-cyan-100/10 blur-[1px] animate-flare" style={{ animationDelay: '4.2s' }} />

            {/* Golden Atmospheric Motes distributed across the entire tile */}
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="weather-mote"
                style={{
                  width: `${3 + (i % 3) * 1.5}px`,
                  height: `${3 + (i % 3) * 1.5}px`,
                  left: `${(i * 5.6 + 8) % 90}%`,
                  top: `${(i * 6.2 + 12) % 80}%`,
                  animationDelay: `${(i * 0.35) % 4.5}s`,
                  animationDuration: `${3.5 + (i % 3) * 1.2}s`
                }}
              />
            ))}
          </div>
        )}

        {/* 2. CLOUDY / OVERCAST (PHOTOREALISTIC VOLUMETRIC CLOUDS):
               Organic, multi-layer volumetric cloud banks displaced with fractal noise filters,
               natural silver daylight diffusion through upper cloud seams, multi-altitude parallax drift,
               low-hanging scud shreds, and atmospheric moisture mist */}
        {activeCondition === 'cloud' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden animate-in fade-in duration-500">
            {/* Full-Tile Overcast Atmospheric Filter */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[0.5px]" />

            {/* Diffused Silver Skylight breaking through upper cloud seams */}
            <div className="absolute top-0 right-1/4 w-80 h-44 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100/40 via-slate-300/15 to-transparent blur-3xl animate-pulse-glow" />

            {/* Layer 1: High-Altitude Stratocumulus Base (Parallax Slow Drift with Fractal Noise) */}
            <svg
              className="absolute -top-14 -left-20 w-[155%] h-72 opacity-85 animate-cloud-slow pointer-events-none"
              viewBox="0 0 340 160"
              preserveAspectRatio="none"
              style={{ filter: 'url(#filter-cloud-overcast)' }}
            >
              <defs>
                <linearGradient id="cloudStratoBaseRealistic" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.9" />
                  <stop offset="35%" stopColor="#94a3b8" stopOpacity="0.95" />
                  <stop offset="70%" stopColor="#475569" stopOpacity="0.98" />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity="0.98" />
                </linearGradient>
              </defs>
              <path
                fill="url(#cloudStratoBaseRealistic)"
                d="M 0 130 C 35 75, 80 60, 130 75 C 175 35, 240 25, 280 60 C 310 45, 335 60, 340 95 L 340 160 L 0 160 Z"
              />
            </svg>

            {/* Layer 2: Volumetric Billowing Cumulus Clouds with Silver Edges & 3D Shading */}
            <div className="absolute top-[-10px] -right-16 w-[145%] h-72 animate-cloud-fast pointer-events-none drop-shadow-2xl">
              <svg
                viewBox="0 0 320 160"
                className="w-full h-full animate-cloud-realistic-billow"
                style={{ filter: 'url(#filter-cloud-overcast)' }}
              >
                <defs>
                  <linearGradient id="cumulusVolumetricGrad1" x1="30%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.98" />
                    <stop offset="30%" stopColor="#e2e8f0" stopOpacity="0.92" />
                    <stop offset="65%" stopColor="#64748b" stopOpacity="0.88" />
                    <stop offset="100%" stopColor="#334155" stopOpacity="0.96" />
                  </linearGradient>
                  <linearGradient id="cumulusVolumetricGrad2" x1="40%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#f1f5f9" stopOpacity="0.95" />
                    <stop offset="40%" stopColor="#cbd5e1" stopOpacity="0.9" />
                    <stop offset="75%" stopColor="#475569" stopOpacity="0.88" />
                    <stop offset="100%" stopColor="#1e293b" stopOpacity="0.95" />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#cumulusVolumetricGrad1)"
                  d="M 10 140 C 30 90, 75 70, 120 85 C 160 40, 230 35, 270 70 C 295 55, 315 75, 320 110 L 320 160 L 0 160 Z"
                />
                <path
                  fill="url(#cumulusVolumetricGrad2)"
                  opacity="0.85"
                  d="M 0 150 C 40 110, 95 95, 140 110 C 180 80, 245 75, 285 105 C 310 95, 320 115, 320 160 L 0 160 Z"
                />
              </svg>
            </div>

            {/* Layer 3: Foreground Low-Hanging Scud Wisps drifting across mid-sky */}
            <svg
              className="absolute top-24 -left-12 w-[140%] h-48 opacity-65 animate-cloud-1 pointer-events-none"
              viewBox="0 0 300 120"
              style={{ filter: 'url(#filter-cloud-overcast)' }}
            >
              <defs>
                <linearGradient id="scudWispsRealistic" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#64748b" stopOpacity="0.1" />
                  <stop offset="25%" stopColor="#cbd5e1" stopOpacity="0.8" />
                  <stop offset="65%" stopColor="#94a3b8" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#475569" stopOpacity="0.15" />
                </linearGradient>
              </defs>
              <path
                fill="url(#scudWispsRealistic)"
                d="M 20 85 C 15 55, 65 45, 95 60 C 125 30, 185 22, 215 50 C 245 38, 285 52, 295 78 C 275 95, 220 98, 180 82 C 145 95, 75 98, 20 85 Z"
              />
            </svg>

            {/* Atmospheric Condensation Vapor Motes */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: `${2 + (i % 3) * 1.5}px`,
                  height: `${2 + (i % 3) * 1.5}px`,
                  left: `${(i * 7.5 + 8) % 90}%`,
                  top: `${(i * 6.8 + 22) % 72}%`,
                  backgroundColor: 'rgba(226, 232, 240, 0.45)',
                  boxShadow: '0 0 6px rgba(255, 255, 255, 0.3)',
                  animation: `weather-mote-rise ${4 + (i % 3) * 1.4}s ease-in-out infinite`,
                  animationDelay: `${(i * 0.45) % 4.5}s`
                }}
              />
            ))}

            {/* Low-altitude Fog Shelf across ground */}
            <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-slate-300/35 via-slate-400/20 to-transparent blur-md pointer-events-none" />
          </div>
        )}

        {/* 3. RAINY / SHOWERS (PHOTOREALISTIC RAIN & WATER DROPS):
               - Heavy dark nimbostratus rain cloud ceiling with fractal turbulent edges & hanging virga sheets
               - Multiphase falling rain streaks with liquid light refraction and velocity blur (foreground, midground, background)
               - Tactile photorealistic glass condensation droplets with 3D caustic light pooling and trickling trails
               - Ground impact micro-splashes and concentric puddle ripples */}
        {activeCondition === 'rain' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden animate-in fade-in duration-500">
            {/* Atmospheric Moisture Filter */}
            <div className="absolute inset-0 bg-slate-950/30" />

            {/* Dense Nimbostratus Rain Cloud Ceiling at Top */}
            <svg
              className="absolute -top-10 -left-12 w-[135%] h-56 opacity-95 pointer-events-none drop-shadow-2xl"
              viewBox="0 0 320 140"
              style={{ filter: 'url(#filter-cloud-storm)' }}
            >
              <defs>
                <linearGradient id="nimbostratusGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity="0.98" />
                  <stop offset="45%" stopColor="#1e293b" stopOpacity="0.95" />
                  <stop offset="80%" stopColor="#334155" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#475569" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <path
                fill="url(#nimbostratusGrad)"
                d="M 0 110 C 35 65, 85 55, 135 70 C 180 30, 245 25, 285 55 C 310 45, 335 65, 340 95 L 340 140 L 0 140 Z"
              />
            </svg>

            {/* Rain Virga Precipitation Curtain */}
            <svg
              className="absolute top-10 left-0 w-full h-44 opacity-25 pointer-events-none"
              viewBox="0 0 300 100"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="virgaSheetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points="0,0 80,0 40,100 0,100" fill="url(#virgaSheetGrad)" />
              <polygon points="110,0 190,0 150,100 90,100" fill="url(#virgaSheetGrad)" />
              <polygon points="210,0 290,0 260,100 190,100" fill="url(#virgaSheetGrad)" />
            </svg>

            {/* Layer A: Foreground Heavy Liquid Water Streaks (18 drops) */}
            {Array.from({ length: 18 }).map((_, i) => {
              const leftPercent = (i * 5.4 + 4) % 96;
              const delay = (i * 0.08) % 0.85;
              const duration = 0.68 + (i % 3) * 0.1;
              const height = 28 + (i % 4) * 6;
              return (
                <div
                  key={`fg-rain-${i}`}
                  className="absolute"
                  style={{
                    left: `${leftPercent}%`,
                    top: '-35px',
                    width: '2px',
                    height: `${height}px`,
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(186, 230, 253, 0.35) 30%, rgba(224, 242, 254, 0.9) 75%, #ffffff 100%)',
                    borderRadius: '9999px',
                    boxShadow: '0 0 3px rgba(255, 255, 255, 0.8), 0 0 5px rgba(186, 230, 253, 0.6)',
                    transform: 'rotate(13deg)',
                    animation: `weather-rain-fall ${duration}s linear infinite`,
                    animationDelay: `${delay}s`
                  }}
                />
              );
            })}

            {/* Layer B: Midground Liquid Rain Droplets (30 drops) */}
            {Array.from({ length: 30 }).map((_, i) => {
              const leftPercent = (i * 3.3 + (i % 7) * 1.7) % 98;
              const delay = (i * 0.05) % 1.05;
              const duration = 0.82 + (i % 4) * 0.12;
              const height = 18 + (i % 4) * 5;
              return (
                <div
                  key={`mg-rain-${i}`}
                  className="rain-drop"
                  style={{
                    left: `${leftPercent}%`,
                    top: '-30px',
                    height: `${height}px`,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`
                  }}
                />
              );
            })}

            {/* Layer C: Fine Background Drizzle Mist (18 drops) */}
            {Array.from({ length: 18 }).map((_, i) => {
              const leftPercent = (i * 5.8 + 6) % 94;
              const delay = (i * 0.09) % 1.25;
              const duration = 1.05 + (i % 3) * 0.18;
              return (
                <div
                  key={`bg-rain-${i}`}
                  className="rain-drop"
                  style={{
                    left: `${leftPercent}%`,
                    top: '-25px',
                    width: '1px',
                    height: '14px',
                    opacity: 0.45,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`
                  }}
                />
              );
            })}

            {/* ================= PHOTOREALISTIC GLASS WATER DROPLETS ================= */}
            {/* Real liquid water beads clinging to camera/window glass with 3D caustic refraction */}
            <div className="realistic-glass-drop w-2.5 h-2.5 top-8 left-10" />
            <div className="realistic-glass-drop w-3.5 h-4 top-16 right-16" />
            <div className="realistic-glass-drop w-2 h-2 top-28 left-1/4 opacity-90" />
            <div className="realistic-glass-drop w-3 h-3.5 bottom-20 left-12" />
            <div className="realistic-glass-drop w-2.5 h-2.5 bottom-14 right-20" />
            <div className="realistic-glass-drop w-1.5 h-1.5 top-36 right-1/3 opacity-75" />
            <div className="realistic-glass-drop w-2 h-2 bottom-24 right-1/4 opacity-80" />

            {/* Dynamic Droplet 1: Slowly trickling down the glass surface leaving a wet trail */}
            <div className="absolute top-6 left-1/3 pointer-events-none">
              <div className="w-[1.5px] bg-gradient-to-b from-white/30 via-sky-200/20 to-transparent blur-[0.4px] animate-glass-trail-1 ml-[3px]" />
              <div className="realistic-glass-drop w-3 h-3.5 animate-glass-trickle-1" />
            </div>

            {/* Dynamic Droplet 2: Trickling on the right flank */}
            <div className="absolute top-12 right-1/4 pointer-events-none">
              <div className="realistic-glass-drop w-2.5 h-3 animate-glass-trickle-2" />
            </div>

            {/* Ground Impact Splashes & Concentric Ripples */}
            <div className="absolute bottom-2 left-10 w-1.5 h-1.5 rounded-full bg-cyan-100 shadow-xs animate-splash-rebound" />
            <div className="absolute bottom-3 left-1/3 w-1.5 h-1.5 rounded-full bg-white shadow-xs animate-splash-rebound" style={{ animationDelay: '0.45s' }} />
            <div className="absolute bottom-2.5 right-1/4 w-1.5 h-1.5 rounded-full bg-cyan-200 shadow-xs animate-splash-rebound" style={{ animationDelay: '0.8s' }} />
            <div className="absolute bottom-2 right-14 w-1.5 h-1.5 rounded-full bg-white shadow-xs animate-splash-rebound" style={{ animationDelay: '1.05s' }} />

            <div className="absolute bottom-2 left-8 w-12 h-3.5 rounded-full border border-sky-300/60 animate-[weather-ripple_1.8s_infinite]" />
            <div className="absolute bottom-3 left-1/3 w-16 h-4 rounded-full border border-sky-200/50 animate-[weather-ripple_2.1s_infinite_0.6s]" />
            <div className="absolute bottom-2 right-1/4 w-14 h-3.5 rounded-full border border-sky-300/60 animate-[weather-ripple_1.9s_infinite_1.1s]" />
            <div className="absolute bottom-2 right-10 w-11 h-3 rounded-full border border-sky-200/50 animate-[weather-ripple_1.7s_infinite_1.4s]" />

            {/* Atmospheric Precipitation Vapor Sheen along bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-sky-400/20 via-sky-300/10 to-transparent blur-md pointer-events-none" />
          </div>
        )}

        {/* 4. WINDY (PHOTOREALISTIC ATMOSPHERIC WIND & CIRRUS/FRACTUS CLOUDS):
               - Realistic high-velocity wind-torn clouds (fractus & cirrus streamers) swept horizontally across the sky
               - Fine aerodynamic vapor condensation streamlines with natural motion blur (NO cartoon leaves or cartoon trees)
               - Atmospheric gust pressure pulses across the atmosphere
               - Natural airborne micro-motes and seed fluff */}
        {activeCondition === 'wind' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden animate-in fade-in duration-500">
            {/* Ambient Wind Gust Pressure Surge Wash */}
            <div className="absolute inset-0 bg-gradient-to-r from-teal-200/10 via-cyan-100/20 to-transparent pointer-events-none animate-wind-gust-pulse" />

            {/* Layer 1: High-Altitude Wind-Blown Cirrus Streamers across upper atmosphere */}
            <svg
              className="absolute -top-6 -left-16 w-[150%] h-44 opacity-75 animate-cirrus-1 pointer-events-none"
              viewBox="0 0 360 120"
              style={{ filter: 'url(#filter-cloud-wispy-wind)' }}
            >
              <defs>
                <linearGradient id="cirrusGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
                  <stop offset="30%" stopColor="#e0f2fe" stopOpacity="0.8" />
                  <stop offset="70%" stopColor="#bae6fd" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <path
                fill="url(#cirrusGrad1)"
                d="M 0 50 Q 90 20 180 45 T 360 35 L 360 90 Q 270 65 180 75 T 0 85 Z"
              />
            </svg>

            {/* Layer 2: Fast-Moving Wind-Torn Scud Clouds (Fractus) racing horizontally */}
            <div className="absolute top-6 left-0 w-[140%] h-36 animate-wind-cloud-1 pointer-events-none">
              <svg viewBox="0 0 320 90" className="w-full h-full" style={{ filter: 'url(#filter-cloud-wispy-wind)' }}>
                <path
                  d="M 20 40 Q 90 15 170 38 T 320 28 L 300 70 Q 210 50 130 65 T 10 60 Z"
                  fill="rgba(240, 249, 255, 0.8)"
                />
              </svg>
            </div>

            <div className="absolute top-22 left-0 w-[140%] h-36 animate-wind-cloud-2 pointer-events-none">
              <svg viewBox="0 0 320 90" className="w-full h-full" style={{ filter: 'url(#filter-cloud-wispy-wind)' }}>
                <path
                  d="M 0 45 Q 100 25 200 48 T 320 38 L 310 75 Q 190 55 100 70 T 0 65 Z"
                  fill="rgba(224, 242, 254, 0.75)"
                />
              </svg>
            </div>

            <div className="absolute top-38 left-0 w-[140%] h-32 animate-wind-cloud-3 pointer-events-none">
              <svg viewBox="0 0 320 80" className="w-full h-full" style={{ filter: 'url(#filter-cloud-wispy-wind)' }}>
                <path
                  d="M 30 35 Q 120 18 210 36 T 320 30 L 300 65 Q 180 48 90 60 T 20 55 Z"
                  fill="rgba(203, 213, 225, 0.65)"
                />
              </svg>
            </div>

            {/* Aerodynamic Vapor Streamlines (Fine, high-velocity air currents) */}
            <div className="absolute top-10 left-0 w-[460px] h-1.5 bg-gradient-to-r from-transparent via-white/85 to-transparent rounded-full blur-[0.4px] animate-wind-fast-1" />
            <div className="absolute top-22 left-0 w-[380px] h-1 bg-gradient-to-r from-transparent via-cyan-100/75 to-transparent rounded-full blur-[0.4px] animate-wind-fast-2" />
            <div className="absolute top-36 left-0 w-[500px] h-2 bg-gradient-to-r from-transparent via-sky-100/80 to-transparent rounded-full blur-[0.4px] animate-wind-fast-3" />
            <div className="absolute top-50 left-0 w-[420px] h-1 bg-gradient-to-r from-transparent via-teal-100/65 to-transparent rounded-full blur-[0.4px] animate-wind-fast-1" style={{ animationDelay: '1.1s' }} />
            <div className="absolute top-64 left-0 w-[360px] h-1 bg-gradient-to-r from-transparent via-white/70 to-transparent rounded-full blur-[0.4px] animate-wind-fast-2" style={{ animationDelay: '1.9s' }} />

            {/* Aerodynamic Wind Shear Vector Arcs */}
            <svg className="absolute top-4 -left-10 w-[140%] h-36 opacity-55 pointer-events-none animate-wind-stream-2" viewBox="0 0 320 90" fill="none">
              <path d="M 0 32 Q 90 8 175 38 T 320 22" stroke="rgba(255,255,255,0.85)" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M 20 48 Q 120 26 210 56 T 320 36" stroke="rgba(224,242,254,0.65)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>

            {/* Airborne Natural Wind Particles & Seed Motes */}
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: `${1.5 + (i % 3) * 1.2}px`,
                  height: `${1.5 + (i % 3) * 1.2}px`,
                  backgroundColor: 'rgba(240, 249, 255, 0.85)',
                  boxShadow: '0 0 3px rgba(255, 255, 255, 0.7)',
                  left: `${(i * 6.5 + 4) % 94}%`,
                  top: `${(i * 5.6 + 10) % 78}%`,
                  animation: `weather-wind-particle-fast ${1.8 + (i % 4) * 0.35}s cubic-bezier(0.2, 0.8, 0.2, 1) infinite`,
                  animationDelay: `${(i * 0.22) % 2.2}s`
                }}
              />
            ))}

            {/* High-altitude Breezy Atmospheric Sheen */}
            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-r from-transparent via-white/15 to-transparent blur-md pointer-events-none" />
          </div>
        )}

        {/* 5. STORMY (PHOTOREALISTIC THUNDERHEADS, VOLUMETRIC INTERNAL LIGHTNING & MULTI-FORK DISCHARGES):
               - Menacing dark cumulonimbus supercell shelf clouds with turbulent fractal edges
               - Volumetric internal illumination: thunderclouds light up from within during electrical discharges
               - 4 photorealistic cloud-to-ground strikes (fractal fork, zig-zag, vertical double strike, needle whip)
               - Intra-cloud horizontal spider/crawler lightning
               - Torrential wind-whipped rain streaks & glass deluge beads */}
        {activeCondition === 'storm' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden animate-in fade-in duration-500">
            {/* Ambient Dark Tempest Storm Backdrop */}
            <div className="absolute inset-0 bg-slate-950/85" />

            {/* Full-Tile Primary Ambient Lightning Sky Flash (Blinding multi-stroke strobe illumination) */}
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-100/90 via-sky-200/80 to-violet-300/60 animate-lightning-flash-main pointer-events-none z-0 mix-blend-screen" />

            {/* Secondary Horizon Sheet Lightning & Distant Crawler Illumination */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-100/85 via-indigo-200/70 to-transparent animate-lightning-flash-sheet pointer-events-none z-0 mix-blend-screen" />

            {/* Photorealistic Ominous Cumulonimbus Thundercloud Canopy with Internal Backlight Glow */}
            <div className="absolute -top-12 left-[-10%] w-[130%] h-60 pointer-events-none drop-shadow-2xl">
              {/* Internal Cloud Backlight Glow (Flashes from INSIDE the cloud with lightning strikes) */}
              <svg
                className="w-full h-full absolute inset-0 text-cyan-200 animate-cloud-backlight fill-current"
                viewBox="0 0 320 140"
                style={{ filter: 'url(#filter-cloud-storm)' }}
              >
                <path d="M 0 115 C 40 60, 95 45, 150 65 C 195 20, 265 20, 305 55 C 325 45, 335 65, 340 95 L 340 140 L 0 140 Z" />
              </svg>

              {/* Dark Bruised Thunderhead Cloud Mass */}
              <svg
                className="w-full h-full relative"
                viewBox="0 0 320 140"
                style={{ filter: 'url(#filter-cloud-storm)' }}
              >
                <defs>
                  <linearGradient id="stormCloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#020617" stopOpacity="0.98" />
                    <stop offset="45%" stopColor="#0f172a" stopOpacity="0.95" />
                    <stop offset="80%" stopColor="#1e293b" stopOpacity="0.92" />
                    <stop offset="100%" stopColor="#334155" stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                <path
                  fill="url(#stormCloudGrad)"
                  d="M 0 115 C 40 60, 95 45, 150 65 C 195 20, 265 20, 305 55 C 325 45, 335 65, 340 95 L 340 140 L 0 140 Z"
                />
              </svg>
            </div>

            {/* STRIKE 1: Photorealistic Major Fractal Branching Bolt (Right Flank) */}
            <svg
              className="absolute top-2 right-8 sm:right-20 w-52 h-64 animate-lightning-bolt-1 pointer-events-none z-10 overflow-visible"
              viewBox="0 0 110 160"
              fill="none"
            >
              {/* Outer Cyan Ion Electric Aura */}
              <path
                d="M 60 0 L 52 32 L 66 42 L 46 80 L 56 86 L 36 145"
                stroke="#38bdf8"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
                filter="url(#lightningGlowEnhanced)"
              />
              {/* Blistering White Core */}
              <path
                d="M 60 0 L 52 32 L 66 42 L 46 80 L 56 86 L 36 145"
                stroke="#ffffff"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Sub-Branch 1 */}
              <path d="M 52 32 L 34 56 L 24 82" stroke="#e0f2fe" strokeWidth="1.8" strokeLinecap="round" />
              {/* Sub-Branch 2 */}
              <path d="M 46 80 L 64 105 L 72 125" stroke="#e0f2fe" strokeWidth="1.8" strokeLinecap="round" />
              {/* Tertiary Fine Fork */}
              <path d="M 34 56 L 40 70" stroke="#bae6fd" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M 64 105 L 56 122" stroke="#bae6fd" strokeWidth="1.2" strokeLinecap="round" />
            </svg>

            {/* STRIKE 2: Sharp High-Voltage Zig-Zag Bolt (Left Flank) */}
            <svg
              className="absolute top-3 left-6 sm:left-14 w-44 h-60 animate-lightning-bolt-2 pointer-events-none z-10 overflow-visible"
              viewBox="0 0 110 160"
              fill="none"
            >
              <path
                d="M 48 0 L 56 28 L 42 44 L 60 84 L 50 90 L 64 140"
                stroke="#38bdf8"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
                filter="url(#lightningGlowEnhanced)"
              />
              <path
                d="M 48 0 L 56 28 L 42 44 L 60 84 L 50 90 L 64 140"
                stroke="#ffffff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M 42 44 L 28 68 L 18 88" stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M 60 84 L 76 108" stroke="#bae6fd" strokeWidth="1.4" strokeLinecap="round" />
            </svg>

            {/* STRIKE 3: Violent Center-Right Double-Fork Strike */}
            <svg
              className="absolute top-1 right-28 sm:right-44 w-40 h-56 animate-lightning-bolt-3 pointer-events-none z-10 overflow-visible"
              viewBox="0 0 100 150"
              fill="none"
            >
              <path
                d="M 50 0 L 44 26 L 56 46 L 40 82 L 48 94 L 38 135"
                stroke="#38bdf8"
                strokeWidth="5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
                filter="url(#lightningGlowEnhanced)"
              />
              <path
                d="M 50 0 L 44 26 L 56 46 L 40 82 L 48 94 L 38 135"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Secondary ground fork */}
              <path d="M 40 82 L 62 108 L 68 138" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M 44 26 L 30 48" stroke="#bae6fd" strokeWidth="1.4" strokeLinecap="round" />
            </svg>

            {/* STRIKE 4: Quick Needle Whip Strike (Center-Left) */}
            <svg
              className="absolute top-2 left-24 sm:left-36 w-36 h-52 animate-lightning-bolt-4 pointer-events-none z-10 overflow-visible"
              viewBox="0 0 90 140"
              fill="none"
            >
              <path
                d="M 45 0 L 40 25 L 52 48 L 38 78 L 46 88 L 34 130"
                stroke="#38bdf8"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
                filter="url(#lightningGlowEnhanced)"
              />
              <path
                d="M 45 0 L 40 25 L 52 48 L 38 78 L 46 88 L 34 130"
                stroke="#ffffff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M 40 25 L 26 42" stroke="#bae6fd" strokeWidth="1.3" strokeLinecap="round" />
            </svg>

            {/* INTRA-CLOUD SPIDER / CRAWLER LIGHTNING (Creeps horizontally across the cloud ceiling) */}
            <svg
              className="absolute top-1 left-4 right-4 w-[95%] h-24 animate-lightning-crawler pointer-events-none z-10 overflow-visible"
              viewBox="0 0 320 60"
              fill="none"
            >
              {/* Horizontal creeping crawler branches */}
              <path
                d="M 20 25 L 55 18 L 90 28 L 130 16 L 175 26 L 210 18 L 250 24 L 295 15"
                stroke="#38bdf8"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
                filter="url(#lightningGlowEnhanced)"
              />
              <path
                d="M 20 25 L 55 18 L 90 28 L 130 16 L 175 26 L 210 18 L 250 24 L 295 15"
                stroke="#ffffff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Spider crawling forks downward into clouds */}
              <path d="M 90 28 L 105 45 L 98 55" stroke="#bae6fd" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M 175 26 L 188 44 L 202 52" stroke="#bae6fd" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M 250 24 L 262 38" stroke="#bae6fd" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M 55 18 L 65 32" stroke="#bae6fd" strokeWidth="1.2" strokeLinecap="round" />
            </svg>

            {/* 48 Driving Heavy Torrential Rain Streaks with Wind Shear */}
            {Array.from({ length: 48 }).map((_, i) => {
              const leftPercent = (i * 2.2 + (i % 6) * 2.1) % 98;
              const delay = (i * 0.04) % 0.8;
              const duration = 0.58 + (i % 4) * 0.12;
              const height = 28 + (i % 5) * 8;
              return (
                <div
                  key={`thunder-rain-${i}`}
                  className="rain-drop-thunder"
                  style={{
                    left: `${leftPercent}%`,
                    top: '-35px',
                    height: `${height}px`,
                    opacity: 0.88,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`
                  }}
                />
              );
            })}

            {/* Glass Water Beads Beaded during Storm Deluge */}
            <div className="realistic-glass-drop w-3 h-3 top-10 right-14" />
            <div className="realistic-glass-drop w-3.5 h-4 bottom-16 left-12" />
            <div className="realistic-glass-drop w-2 h-2 top-24 left-1/3" />
            <div className="realistic-glass-drop w-2.5 h-3 bottom-24 right-1/4" />

            {/* Violent Puddle Splash Ripples & Splashes */}
            <div className="absolute bottom-2 left-6 w-14 h-4 rounded-full border-2 border-cyan-300/60 animate-[weather-ripple_1.5s_infinite]" />
            <div className="absolute bottom-4 left-1/3 w-18 h-4.5 rounded-full border-2 border-cyan-200/50 animate-[weather-ripple_1.7s_infinite_0.4s]" />
            <div className="absolute bottom-2 right-12 w-16 h-4 rounded-full border-2 border-cyan-300/60 animate-[weather-ripple_1.4s_infinite_0.8s]" />
            <div className="absolute bottom-3 left-10 w-2 h-2 rounded-full bg-cyan-100 shadow-md animate-splash-rebound" />
            <div className="absolute bottom-3 right-16 w-2 h-2 rounded-full bg-white shadow-md animate-splash-rebound" style={{ animationDelay: '0.6s' }} />
          </div>
        )}

        {/* 6. SNOWY: Soft falling ice crystals & snowflakes with drifting physics */}
        {activeCondition === 'snow' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden animate-in fade-in duration-500">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-slate-800/15 to-transparent pointer-events-none" />

            {Array.from({ length: 42 }).map((_, i) => {
              const leftPercent = (i * 2.4 + (i % 7) * 1.8) % 100;
              const isSlow = i % 2 === 0;
              const delay = (i * 0.14) % 3.8;
              const duration = isSlow ? 4.5 + (i % 3) * 0.8 : 3.4 + (i % 3) * 0.6;
              const size = 3 + (i % 4) * 2;
              const opacity = 0.7 + (i % 3) * 0.15;
              const blur = i % 5 === 0 ? 'blur-[0.8px]' : 'blur-[0.2px]';

              return (
                <div
                  key={i}
                  className={`${isSlow ? 'snow-flake-slow' : 'snow-flake-soft'} ${blur}`}
                  style={{
                    left: `${leftPercent}%`,
                    top: '-20px',
                    width: `${size}px`,
                    height: `${size}px`,
                    opacity,
                    animationDelay: `${delay}s`,
                    animationDuration: `${duration}s`
                  }}
                />
              );
            })}

            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={`crystal-${i}`}
                className="absolute snow-flake-slow pointer-events-none opacity-80"
                style={{
                  left: `${14 + i * 19}%`,
                  top: '-25px',
                  animationDelay: `${i * 0.8}s`,
                  animationDuration: `${5.2 + i * 0.5}s`
                }}
              >
                <Snowflake className="w-4 h-4 text-white drop-shadow-md animate-spin-very-slow" />
              </div>
            ))}
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white/35 via-white/15 to-transparent blur-sm" />
          </div>
        )}

        {/* 7. FOGGY / MISTY: Low-altitude rolling ground fog banks reducing visibility */}
        {activeCondition === 'fog' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden animate-in fade-in duration-500">
            <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[1px]" />
            <div className="absolute top-4 right-1/4 w-32 h-32 rounded-full bg-amber-100/20 blur-3xl animate-pulse" />
            <div className="absolute top-6 -left-20 w-[140%] h-40 bg-gradient-to-b from-slate-200/25 via-stone-300/30 to-transparent blur-xl animate-fog-roll-1" />
            <div className="absolute top-20 -right-20 w-[140%] h-44 bg-gradient-to-t from-stone-200/45 via-slate-300/35 to-transparent blur-2xl animate-fog-roll-2" />
            <div className="absolute bottom-0 -left-10 right-0 h-40 bg-gradient-to-t from-slate-100/60 via-stone-200/45 to-transparent blur-lg animate-fog-drift-low" />
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/70 via-slate-100/50 to-transparent blur-md" />
          </div>
        )}

        {/* 8. PARTLY CLOUDY: Sun peeking through billowy cumulus clouds */}
        {activeCondition === 'cloudSun' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden animate-in fade-in duration-500">
            <div className="absolute -top-6 right-10 w-36 h-36 rounded-full bg-gradient-to-br from-amber-100 via-amber-300/40 to-transparent blur-2xl animate-pulse-glow" />
            <div className="absolute top-2 right-16 w-16 h-16 rounded-full bg-yellow-100/80 blur-md" />

            <svg
              className="absolute -top-2 -left-10 w-[440px] h-52 opacity-80 animate-cloud-slow pointer-events-none"
              viewBox="0 0 240 120"
              style={{ filter: 'url(#filter-cloud-partly)' }}
            >
              <defs>
                <linearGradient id="partlyCloudBack3" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="#cbd5e1" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#64748b" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <path
                fill="url(#partlyCloudBack3)"
                d="M 20 95 C 15 70, 50 55, 75 68 C 95 40, 140 32, 168 55 C 188 44, 225 55, 230 78 C 245 88, 238 102, 215 102 Z"
              />
            </svg>

            <svg
              className="absolute top-6 -right-12 w-[460px] h-56 opacity-90 animate-cloud-fast pointer-events-none drop-shadow-md"
              viewBox="0 0 260 130"
              style={{ filter: 'url(#filter-cloud-partly)' }}
            >
              <defs>
                <linearGradient id="partlyCloudFront3" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
                  <stop offset="50%" stopColor="#e2e8f0" stopOpacity="0.92" />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.88" />
                </linearGradient>
              </defs>
              <path
                fill="url(#partlyCloudFront3)"
                d="M 30 100 C 20 75, 60 60, 85 75 C 105 45, 155 38, 185 62 C 205 50, 245 62, 250 88 C 265 98, 255 112, 230 112 Z"
              />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-200/15 via-white/10 to-transparent blur-md" />
          </div>
        )}

        {/* ================= WEATHER CARD CONTENT ================= */}

        {/* Top Header: Current Temp & SHORT FORECAST SECTION */}
        <div className="relative z-10 flex items-start justify-between gap-2">
          {/* Current Temp and Condition: Maps directly to current.temperature_2m */}
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl sm:text-6xl font-black tracking-tight drop-shadow-md leading-none">
                {currentTemperatureDisplay}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white/90 drop-shadow-xs whitespace-nowrap">
                H: {currentDay.high}  L: {currentDay.low}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white/95 drop-shadow-xs pt-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
              <span className="truncate">{currentConditionDisplay}</span>
            </div>
          </div>

          {/* SHORT, COMPACT FORECAST BADGE */}
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/75">
              Forecast • {activeHour.time}
            </span>
            <div className="mt-1 px-3 py-1.5 rounded-xl bg-black/35 backdrop-blur-md border border-white/25 text-white shadow-xs flex items-center gap-1.5 whitespace-nowrap">
              {activeCondition === 'sun' && (
                <Sun className="w-3.5 h-3.5 text-yellow-300 animate-spin-very-slow shrink-0" />
              )}
              {activeCondition === 'cloudSun' && (
                <CloudSun className="w-3.5 h-3.5 text-amber-200 shrink-0" />
              )}
              {activeCondition === 'cloud' && (
                <Cloud className="w-3.5 h-3.5 text-slate-200 shrink-0" />
              )}
              {activeCondition === 'rain' && (
                <CloudRain className="w-3.5 h-3.5 text-sky-300 shrink-0" />
              )}
              {activeCondition === 'wind' && (
                <Wind className="w-3.5 h-3.5 text-teal-200 shrink-0" />
              )}
              {activeCondition === 'snow' && (
                <Snowflake className="w-3.5 h-3.5 text-cyan-200 animate-spin-very-slow shrink-0" />
              )}
              {activeCondition === 'fog' && (
                <CloudFog className="w-3.5 h-3.5 text-stone-200 shrink-0" />
              )}
              {activeCondition === 'storm' && (
                <CloudLightning className="w-3.5 h-3.5 text-violet-300 animate-pulse shrink-0" />
              )}
              <span className="text-xs font-bold tracking-tight">
                {currentShortForecastDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Hourly Forecast Strip (Apple Weather Style - NEXT 12 CONSECUTIVE HOURS, NO SCROLLBAR) */}
        <div className="relative z-10 mt-3.5 pt-3 border-t border-white/20">
          <div className="flex items-center justify-between text-[11px] font-bold text-white/90 mb-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-white/80" />
              <span>HOURLY FORECAST (NEXT 12 HOURS)</span>
            </span>
            <span className="text-[10px] text-white/75 font-medium flex items-center gap-1">
              <span>Swipe hours to preview</span>
              <ChevronRight className="w-3 h-3 opacity-60" />
            </span>
          </div>

          {/* Smooth Horizontally Scrollable Hourly Strip (NO VISIBLE SCROLLBAR) */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1 pt-0.5 px-0.5 scroll-smooth -mx-1 px-1">
            {currentDay.hourly.map((h, i) => {
              const isSelectedHour = selectedHourIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectHour(i)}
                  className={`flex-shrink-0 flex flex-col items-center py-2 px-3 rounded-2xl transition-all duration-200 cursor-pointer min-w-[64px] ${
                    isSelectedHour
                      ? 'bg-white/35 backdrop-blur-md border-2 border-white text-white shadow-md scale-105 ring-2 ring-white/40'
                      : 'bg-black/25 hover:bg-black/35 backdrop-blur-xs border border-white/15 text-white/90'
                  }`}
                  title={`View ${h.time} (${h.condition})`}
                >
                  <span className={`text-[10px] font-bold leading-tight whitespace-nowrap ${
                    isSelectedHour ? 'text-white' : 'text-white/80'
                  }`}>
                    {h.time}
                  </span>

                  <div className="my-1.5 flex items-center justify-center">
                    {h.icon === 'sun' && (
                      <Sun className={`w-4 h-4 ${isSelectedHour ? 'text-yellow-100 scale-110' : 'text-yellow-200'} animate-spin-very-slow`} />
                    )}
                    {h.icon === 'cloudSun' && (
                      <CloudSun className={`w-4 h-4 ${isSelectedHour ? 'text-amber-100 scale-110' : 'text-amber-200'}`} />
                    )}
                    {h.icon === 'cloud' && (
                      <Cloud className={`w-4 h-4 ${isSelectedHour ? 'text-white scale-110' : 'text-slate-200'}`} />
                    )}
                    {h.icon === 'rain' && (
                      <CloudRain className={`w-4 h-4 ${isSelectedHour ? 'text-sky-100 scale-110' : 'text-sky-200'}`} />
                    )}
                    {h.icon === 'wind' && (
                      <Wind className={`w-4 h-4 ${isSelectedHour ? 'text-teal-100 scale-110' : 'text-teal-200'}`} />
                    )}
                    {h.icon === 'snow' && (
                      <Snowflake className={`w-4 h-4 ${isSelectedHour ? 'text-cyan-100 scale-110 animate-spin-very-slow' : 'text-cyan-200'}`} />
                    )}
                    {h.icon === 'fog' && (
                      <CloudFog className={`w-4 h-4 ${isSelectedHour ? 'text-stone-100 scale-110' : 'text-stone-200'}`} />
                    )}
                    {h.icon === 'storm' && (
                      <CloudLightning className={`w-4 h-4 ${isSelectedHour ? 'text-violet-100 scale-110 animate-bounce' : 'text-violet-200'}`} />
                    )}
                  </div>

                  {h.pop && (
                    <span className="text-[9px] font-black text-cyan-300 leading-none mb-1">
                      {h.pop}
                    </span>
                  )}

                  <span className={`text-xs font-black whitespace-nowrap ${
                    isSelectedHour ? 'text-white' : 'text-white/95'
                  }`}>
                    {h.temp}
                  </span>

                  {isSelectedHour && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white mt-1 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5-Day Forecast Interactive Selector (LEAVE INTACT AS REQUESTED) */}
        <div className="relative z-10 mt-3 pt-3 border-t border-white/20">
          <div className="flex items-center justify-between text-[11px] font-bold text-white/85 mb-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-white/70" />
              5-DAY OUTLOOK
            </span>
            <span className="text-[10px] text-white/70 font-medium">
              Tap day to preview forecast
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {forecastDays.map((d, idx) => {
              const isSelectedDay = selectedDayIndex === idx;
              return (
                <button
                  key={d.dayName}
                  type="button"
                  onClick={() => handleSelectDay(idx)}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isSelectedDay
                      ? 'bg-white text-slate-900 shadow-md ring-2 ring-white/90 scale-102'
                      : 'bg-black/25 text-white hover:bg-black/35'
                  }`}
                  title={`View ${d.dayName}'s weather`}
                >
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider block whitespace-nowrap leading-tight ${
                      isSelectedDay ? 'text-slate-900' : 'text-white/90'
                    }`}
                  >
                    {d.isToday ? 'Today' : d.dayName.slice(0, 3)}
                  </span>
                  
                  <div className="my-1 flex items-center justify-center">
                    {d.iconType === 'sun' && (
                      <Sun className={`w-3.5 h-3.5 ${isSelectedDay ? 'text-amber-500' : 'text-yellow-200'}`} />
                    )}
                    {d.iconType === 'cloudSun' && (
                      <CloudSun className={`w-3.5 h-3.5 ${isSelectedDay ? 'text-amber-600' : 'text-amber-200'}`} />
                    )}
                    {d.iconType === 'cloud' && (
                      <Cloud className={`w-3.5 h-3.5 ${isSelectedDay ? 'text-slate-600' : 'text-slate-300'}`} />
                    )}
                    {d.iconType === 'rain' && (
                      <CloudRain className={`w-3.5 h-3.5 ${isSelectedDay ? 'text-sky-600' : 'text-sky-300'}`} />
                    )}
                    {d.iconType === 'wind' && (
                      <Wind className={`w-3.5 h-3.5 ${isSelectedDay ? 'text-teal-600' : 'text-teal-200'}`} />
                    )}
                    {d.iconType === 'snow' && (
                      <Snowflake className={`w-3.5 h-3.5 ${isSelectedDay ? 'text-cyan-600' : 'text-cyan-200'}`} />
                    )}
                    {d.iconType === 'fog' && (
                      <CloudFog className={`w-3.5 h-3.5 ${isSelectedDay ? 'text-stone-600' : 'text-stone-300'}`} />
                    )}
                    {d.iconType === 'storm' && (
                      <CloudLightning className={`w-3.5 h-3.5 ${isSelectedDay ? 'text-violet-700' : 'text-violet-300'}`} />
                    )}
                  </div>

                  <span
                    className={`text-xs font-black whitespace-nowrap block leading-tight ${
                      isSelectedDay ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {d.high}
                  </span>
                  <span
                    className={`text-[9px] font-medium block whitespace-nowrap leading-tight ${
                      isSelectedDay ? 'text-slate-500' : 'text-white/70'
                    }`}
                  >
                    {d.low}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
