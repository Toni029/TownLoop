import test from 'node:test';
import assert from 'node:assert/strict';
import {headerTime} from '../src/home/headerTime.ts';
import {atmosphereFor,isNightHour} from '../src/home/weatherAtmosphereModel.ts';
import {parseWeather,type WeatherResponse} from '../src/home/weatherModel.ts';
const hour={time:'Now',temp:'70°',condition:'Clear',shortForecast:'Clear',icon:'sun' as const,sunrise:'2026-10-21T07:30',sunset:'2026-10-21T18:45'};
test('greeting switches at local boundaries and advances date at midnight',()=>{
 for(const [h,m,text] of [[0,0,'Good Night'],[5,59,'Good Night'],[6,0,'Good Morning'],[11,59,'Good Morning'],[12,0,'Good Afternoon'],[16,59,'Good Afternoon'],[17,0,'Good Evening'],[20,59,'Good Evening'],[21,0,'Good Night']] as const){
  const now=new Date(2026,9,21,h,m);const result=headerTime(now);assert.equal(result.greeting,text);assert.ok(result.next>now.getTime());
 }
 const before=headerTime(new Date(2026,9,21,23,59));assert.equal(headerTime(new Date(before.next)).today,'2026-10-22');
});
test('selected provider timestamp controls moon at sunrise/sunset, including before dawn',()=>{
 for(const [timestamp,night] of [['2026-10-21T06:00',true],['2026-10-21T07:30',false],['2026-10-21T18:44',false],['2026-10-21T18:45',true]] as const){
  assert.equal(isNightHour({...hour,timestamp}),night);assert.equal(atmosphereFor({...hour,timestamp}).moon,night);
 }
 assert.equal(isNightHour({...hour,isDay:false,sunrise:undefined,sunset:undefined}),true);
 assert.equal(isNightHour({...hour,sunrise:undefined,sunset:undefined}),false);
 for(const icon of ['cloud','cloudSun','rain','storm','snow','fog','wind'] as const){const scene=atmosphereFor({...hour,icon,isDay:false});assert.equal(scene.moon,false);assert.equal(scene.condition,icon);}
});
test('parseWeather associates solar times with each selected hour across midnight',()=>{
 const times=['2026-10-21T23:00','2026-10-22T00:00','2026-10-22T01:00'];
 const data:WeatherResponse={current:{temperature_2m:70,wind_speed_10m:1,relative_humidity_2m:60,weather_code:0,time:'2026-10-21T23:15'},hourly:{time:times,temperature_2m:[70,69,68],wind_speed_10m:[1,1,1],relative_humidity_2m:[60,60,60],precipitation_probability:[0,0,0],weather_code:[0,0,0],is_day:[0,0,0]},daily:{time:['2026-10-21','2026-10-22'],temperature_2m_max:[80,80],temperature_2m_min:[60,60],weather_code:[0,0],sunrise:['2026-10-21T07:30','2026-10-22T07:31'],sunset:['2026-10-21T18:45','2026-10-22T18:44']}};
 const result=parseWeather(data);assert.equal(result.forecastDays[0].hourly[0].timestamp,data.current.time);assert.equal(result.forecastDays[0].hourly[1].sunrise,'2026-10-22T07:31');assert.equal(atmosphereFor(result.forecastDays[0].hourly[1]).moon,true);
});
