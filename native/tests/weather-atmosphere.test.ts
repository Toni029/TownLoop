import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atmosphereFor } from '../src/home/weatherAtmosphereModel.ts';
import type { HourlyForecast } from '../src/home/weatherModel.ts';
const hour = (weatherCode: number, icon: HourlyForecast['icon'], windSpeed = 0): HourlyForecast => ({ time: '2 PM', temp: '74°', condition: '', shortForecast: '', weatherCode, icon, windSpeed });
test('selected-hour codes distinguish drizzle, rain and heavy rain without using rain probability', () => {
  const drizzle = atmosphereFor(hour(51, 'rain'));
  const rain = atmosphereFor(hour(63, 'rain'));
  const heavy = atmosphereFor(hour(65, 'rain'));
  assert.ok(drizzle.particles < rain.particles && rain.particles < heavy.particles);
  assert.equal(atmosphereFor({ ...hour(0, 'sun'), pop: '90%' }).wet, false);
  assert.equal(atmosphereFor(hour(95, 'storm')).storm, true);
});
test('wind complements precipitation; snow, fog and cloud scenes remain distinct', () => {
  const windyRain = atmosphereFor(hour(63, 'rain', 30));
  assert.ok(windyRain.windy && windyRain.wet);
  assert.ok(atmosphereFor(hour(71, 'snow')).particles < atmosphereFor(hour(75, 'snow')).particles);
  assert.equal(atmosphereFor(hour(45, 'fog')).particles, 0);
  assert.notDeepEqual(atmosphereFor(hour(2, 'cloudSun')).colors, atmosphereFor(hour(3, 'cloud')).colors);
});
