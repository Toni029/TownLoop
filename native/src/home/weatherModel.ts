// Forecast mapping ported from main src/components/WeatherWidget.tsx. No sample-weather fallback.
export type WeatherConditionType =
  | "sun" // Sunny / Clear: High visibility with direct sunlight and no clouds
  | "cloud" // Cloudy / Overcast: Sky partially/completely covered by clouds, blocking direct sunlight
  | "rain" // Rainy / Showers: Liquid water droplets falling from sky to ground
  | "wind" // Windy: Fast-moving air currents ranging from breezes to gusts
  | "snow" // Snowy: Frozen water vapor falling as soft, white ice crystals
  | "fog" // Foggy / Misty: Low-altitude clouds resting near the ground reducing visibility
  | "storm" // Stormy: Heavy rainfall with strong winds, thunder, and lightning
  | "cloudSun"; // Partly Cloudy: Sun with drifting cumulus clouds

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

function mapWeatherCode(code: number): {
  label: string;
  condition: string;
  shortForecast: string;
  icon: WeatherConditionType;
} {
  switch (code) {
    case 0:
      return {
        label: "Clear",
        condition: "Clear & Sunny Skies",
        shortForecast: "Clear",
        icon: "sun",
      };
    case 1:
      return {
        label: "Mainly Clear",
        condition: "Mainly Clear Skies",
        shortForecast: "Mostly Clear",
        icon: "sun",
      };
    case 2:
      return {
        label: "Partly Cloudy",
        condition: "Partly Cloudy Skies",
        shortForecast: "Partly Cloudy",
        icon: "cloudSun",
      };
    case 3:
      return {
        label: "Overcast",
        condition: "Overcast Cloud Deck",
        shortForecast: "Overcast",
        icon: "cloud",
      };
    case 45:
    case 48:
      return {
        label: "Fog",
        condition: "Foggy & Reduced Visibility",
        shortForecast: "Fog",
        icon: "fog",
      };
    case 51:
      return {
        label: "Light Drizzle",
        condition: "Light Falling Drizzle",
        shortForecast: "Lt Drizzle",
        icon: "rain",
      };
    case 53:
    case 55:
      return {
        label: "Drizzle",
        condition: "Steady Liquid Drizzle",
        shortForecast: "Drizzle",
        icon: "rain",
      };
    case 56:
    case 57:
      return {
        label: "Freezing Drizzle",
        condition: "Freezing Liquid Drizzle",
        shortForecast: "Frz Drizzle",
        icon: "rain",
      };
    case 61:
      return {
        label: "Light Rain",
        condition: "Light Rain Showers",
        shortForecast: "Light Rain",
        icon: "rain",
      };
    case 63:
      return {
        label: "Rain",
        condition: "Steady Liquid Rain Droplets",
        shortForecast: "Rain",
        icon: "rain",
      };
    case 65:
      return {
        label: "Heavy Rain",
        condition: "Heavy Liquid Rain Showers",
        shortForecast: "Heavy Rain",
        icon: "rain",
      };
    case 66:
    case 67:
      return {
        label: "Freezing Rain",
        condition: "Freezing Liquid Rain Showers",
        shortForecast: "Freezing Rain",
        icon: "rain",
      };
    case 71:
      return {
        label: "Light Snow",
        condition: "Light Falling Snowflakes",
        shortForecast: "Light Snow",
        icon: "snow",
      };
    case 73:
    case 75:
    case 77:
      return {
        label: "Snow",
        condition: "Falling Snow & Ice Crystals",
        shortForecast: "Snow",
        icon: "snow",
      };
    case 80:
      return {
        label: "Light Showers",
        condition: "Passing Rain Showers",
        shortForecast: "Lt Showers",
        icon: "rain",
      };
    case 81:
    case 82:
      return {
        label: "Rain Showers",
        condition: "Cascading Liquid Rain Showers",
        shortForecast: "Showers",
        icon: "rain",
      };
    case 85:
    case 86:
      return {
        label: "Snow Showers",
        condition: "Passing Snow Showers",
        shortForecast: "Snow Showers",
        icon: "snow",
      };
    case 95:
      return {
        label: "Thunderstorm",
        condition: "Thunderstorm & Lightning",
        shortForecast: "Storm",
        icon: "storm",
      };
    case 96:
    case 99:
      return {
        label: "Severe Thunderstorm",
        condition: "Severe Thunderstorm & Lightning",
        shortForecast: "Severe Storm",
        icon: "storm",
      };
    default:
      return {
        label: "Partly Cloudy",
        condition: "Partly Cloudy Skies",
        shortForecast: "Partly Cloudy",
        icon: "cloudSun",
      };
  }
}

function formatHourLabel(isoString: string): string {
  const parts = isoString.split("T");
  if (parts.length > 1) {
    const hour = parseInt(parts[1].split(":")[0], 10);
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  }
  return isoString;
}

export const OPEN_METEO_API_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=30.29&longitude=-81.84&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York";

export interface WeatherResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
    weather_code: number;
    time: string;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    wind_speed_10m: number[];
    relative_humidity_2m: number[];
    precipitation_probability: number[];
    weather_code: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
}
export function parseWeather(data: WeatherResponse) {
  if (
    !data.current ||
    !data.hourly ||
    !data.daily ||
    !Number.isFinite(data.current.temperature_2m) ||
    !data.daily.time.length
  )
    throw Error("Weather unavailable");
  // 1. Current Conditions: directly extract current.temperature_2m, wind_speed_10m, and relative_humidity_2m
  const currentTempRaw = data.current.temperature_2m;
  const currentTemp = Math.round(currentTempRaw);
  const currentWind = Math.round(data.current.wind_speed_10m);
  const currentHumidity = Math.round(data.current.relative_humidity_2m);
  const currentCode = data.current.weather_code;
  const currentMapped = mapWeatherCode(currentCode);

  const realTimePayload = {
    temp: `${currentTemp}°`,
    windSpeed: currentWind,
    humidity: currentHumidity,
    weatherCode: currentCode,
    label: currentMapped.label,
    condition: `${currentMapped.label} • ${currentHumidity}% Humidity`,
    shortForecast: currentMapped.label,
    icon: currentMapped.icon,
  };

  // Find current hour index in data.hourly.time
  let curHourIdx = 0;
  if (data.current.time) {
    const prefix = data.current.time.slice(0, 13);
    const foundIdx = data.hourly.time.findIndex((t: string) =>
      t.startsWith(prefix),
    );
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
        time: "Now",
        temp: `${currentTemp}°`,
        condition: `${currentMapped.label} • ${currentHumidity}% Humidity`,
        shortForecast: currentMapped.label,
        icon: currentMapped.icon,
        pop: popVal && popVal > 0 ? `${popVal}%` : undefined,
      });
    } else {
      const hTime = formatHourLabel(data.hourly.time[hIdx]);
      const hTemp = Math.round(data.hourly.temperature_2m[hIdx]);
      const hHum = Math.round(data.hourly.relative_humidity_2m[hIdx]);
      const hPop = data.hourly.precipitation_probability?.[hIdx];
      const hMapped = mapWeatherCode(data.hourly.weather_code[hIdx]);

      next12Hours.push({
        time: hTime,
        temp: `${hTemp}°`,
        condition: `${hMapped.label} • ${hHum}% Humidity`,
        shortForecast:
          hPop && hPop > 30 ? `${hMapped.label} ${hPop}%` : hMapped.label,
        icon: hMapped.icon,
        pop: hPop && hPop > 0 ? `${hPop}%` : undefined,
      });
    }
  }

  // 3. 5-Day Outlook
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const updatedDays: DayForecast[] = [];

  const daysCount = Math.min(5, data.daily.time.length);
  for (let d = 0; d < daysCount; d++) {
    const dateStrRaw = data.daily.time[d];
    const [year, month, day] = dateStrRaw.split("-").map(Number);
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
        tag: `${dayName.slice(0, 3)} • ${currentMapped.label}`,
        temp: `${currentTemp}°`,
        high: `${dMax}°`,
        low: `${dMin}°`,
        condition: `${currentMapped.label} • ${currentHumidity}% Humidity`,
        shortForecast: `${currentMapped.label} • ${dMax}°/${dMin}°`,
        iconType: currentMapped.icon,
        hourly: next12Hours,
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

      const sampleIndices =
        dayIndices.length >= 12 ? dayIndices.slice(0, 12) : dayIndices;
      sampleIndices.forEach((hIdx, idx) => {
        const hTime =
          idx === 0 ? "Morning" : formatHourLabel(data.hourly.time[hIdx]);
        const hTemp = Math.round(data.hourly.temperature_2m[hIdx]);
        const hHum = Math.round(data.hourly.relative_humidity_2m[hIdx]);
        const hPop = data.hourly.precipitation_probability?.[hIdx];
        const hMapped = mapWeatherCode(data.hourly.weather_code[hIdx]);

        dayHourly.push({
          time: hTime,
          temp: `${hTemp}°`,
          condition: `${hMapped.label} • ${hHum}% Humidity`,
          shortForecast:
            hPop && hPop > 30 ? `${hMapped.label} ${hPop}%` : hMapped.label,
          icon: hMapped.icon,
          pop: hPop && hPop > 0 ? `${hPop}%` : undefined,
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
        hourly: dayHourly.length > 0 ? dayHourly : next12Hours,
      });
    }
  }

  return { forecastDays: updatedDays, currentRealTimeWeather: realTimePayload };
}
export type WeatherData = ReturnType<typeof parseWeather>;
