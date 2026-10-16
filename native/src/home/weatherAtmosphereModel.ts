import type { HourlyForecast } from './weatherModel';
export function atmosphereFor(hour: HourlyForecast) {
  const code = hour.weatherCode;
  const drizzle = code !== undefined ? [51, 53, 55, 56, 57].includes(code) : /drizzle/i.test(hour.shortForecast);
  const heavy = code !== undefined ? [65, 67, 82, 95, 96, 99].includes(code) : /heavy/i.test(hour.shortForecast);
  const storm = hour.icon === 'storm';
  const snow = hour.icon === 'snow';
  const wet = hour.icon === 'rain' || storm;
  const wind = Math.max(0, Math.min(60, Number.isFinite(hour.windSpeed) ? hour.windSpeed! : 0));
  return {
    condition: hour.icon,
    drizzle, storm, snow, wet,
    heavy: heavy || storm,
    windy: hour.icon === 'wind' || wind >= 18,
    wind,
    // Actual condition, not precipitation probability, controls particle density.
    particles: snow ? (code === 71 || code === 85 ? 16 : 28) : wet ? (drizzle ? 18 : heavy || storm ? 54 : 34) : 0,
    colors: (storm ? ['#080f20', '#26394e', '#172b42'] : wet ? (drizzle ? ['#293f52', '#527184', '#314d66'] : ['#142639', '#344d65', '#203e59']) : hour.icon === 'fog' ? ['#394d5e', '#718592', '#47657b'] : hour.icon === 'snow' ? ['#314b65', '#7896a9', '#466984'] : hour.icon === 'cloud' ? ['#293e54', '#668196', '#3b5e7c'] : hour.icon === 'cloudSun' ? ['#1a537e', '#7497ae', '#417da6'] : ['#165bb8', '#388bd0', '#5ea7f7']) as [string, string, string],
  };
}
