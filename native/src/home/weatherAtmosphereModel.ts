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
    colors: (storm ? ['#456681', '#7093ad', '#8eafc5'] : wet ? ['#638ea9', '#8cb7cc', '#b3d7e4'] : hour.icon === 'fog' ? ['#a3bfce', '#d0e1e8', '#bbd5e2'] : hour.icon === 'snow' ? ['#84bbda', '#c3e4f1', '#a5d4ea'] : hour.icon === 'cloud' ? ['#6bafda', '#a3d3ed', '#c3e5f5'] : hour.icon === 'cloudSun' ? ['#329ee3', '#84c9f0', '#b5e2fa'] : ['#168fe5', '#49b7f3', '#9edfff']) as [string, string, string],
  };
}
