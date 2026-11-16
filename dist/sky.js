const latitude = -37.787;
const longitude = 175.279;
const radians = Math.PI / 180;
const refreshMinutes = 15;
const forecastUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude + '&longitude=' + longitude
  + '&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&timezone=Pacific%2FAuckland';

const clearWeather = { temperature: null, code: 0, precipitation: 0, cloud: 0.2, windSpeed: 8, windFrom: 250, live: false };

const descriptions = [
  [0, 'Clear'], [1, 'Mostly clear'], [2, 'Partly cloudy'], [3, 'Overcast'], [45, 'Fog'], [48, 'Fog'],
  [51, 'Light drizzle'], [53, 'Drizzle'], [55, 'Heavy drizzle'], [56, 'Freezing drizzle'], [57, 'Freezing drizzle'],
  [61, 'Light rain'], [63, 'Rain'], [65, 'Heavy rain'], [66, 'Freezing rain'], [67, 'Freezing rain'],
  [71, 'Light snow'], [73, 'Snow'], [75, 'Heavy snow'], [77, 'Snow grains'],
  [80, 'Showers'], [81, 'Heavy showers'], [82, 'Violent showers'], [85, 'Snow showers'], [86, 'Snow showers'],
  [95, 'Thunderstorm'], [96, 'Thunderstorm with hail'], [99, 'Thunderstorm with hail'],
];

const timeFormat = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', hour: 'numeric', minute: '2-digit' });

export function describe(ms, weather) {
  const time = timeFormat.format(ms).replace(/\s/g, ' ');
  if (!weather.live && !pinnedWeather) return `${time} in Hamilton`;
  const sky = (descriptions.find(([code]) => code === weather.code) ?? [0, 'Fair'])[1];
  const clear = (weather.code === 0 || weather.code === 1) && sunAltitude(ms) < -3 ? sky.replace('Clear', 'Clear night') : sky;
  const temperature = weather.temperature === null || weather.temperature === undefined ? '' : ` · ${Math.round(weather.temperature)}°C`;
  return `${time} · ${clear}${temperature}`;
}

const presets = {
  clear: { code: 0, precipitation: 0, cloud: 0.1, windSpeed: 7, windFrom: 250 },
  cloudy: { code: 3, precipitation: 0, cloud: 0.95, windSpeed: 14, windFrom: 230 },
  showers: { code: 80, precipitation: 1.2, cloud: 0.7, windSpeed: 18, windFrom: 240 },
  rain: { code: 63, precipitation: 3.5, cloud: 1, windSpeed: 22, windFrom: 220 },
  drizzle: { code: 53, precipitation: 0.3, cloud: 0.9, windSpeed: 10, windFrom: 230 },
  fog: { code: 45, precipitation: 0, cloud: 1, windSpeed: 3, windFrom: 200 },
  storm: { code: 95, precipitation: 6, cloud: 1, windSpeed: 35, windFrom: 270 },
};

const overrides = new URLSearchParams(location.search);
const pinnedTime = Date.parse(overrides.get('at') ?? '');
const startedAt = Date.now();
const pinnedWeather = presets[overrides.get('weather')];

export const now = () => Number.isNaN(pinnedTime) ? Date.now() : pinnedTime + Date.now() - startedAt;

export function sunAltitude(ms) {
  const days = (ms - 946728000000) / 86400000;
  const anomaly = (357.529 + 0.98560028 * days) * radians;
  const meanLongitude = 280.459 + 0.98564736 * days;
  const eclipticLongitude = (meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * radians;
  const obliquity = (23.439 - 0.00000036 * days) * radians;
  const ascension = Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLongitude), Math.cos(eclipticLongitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const siderealHours = (18.697374558 + 24.06570982441908 * days) % 24;
  const hourAngle = (siderealHours * 15 + longitude) * radians - ascension;
  const lat = latitude * radians;
  return Math.asin(Math.sin(lat) * Math.sin(declination)
    + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)) / radians;
}

const clockFormat = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland', hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23',
});

export function localClock(ms) {
  const parts = Object.fromEntries(clockFormat.formatToParts(ms).map(({ type, value }) => [type, value]));
  const date = new Date(ms);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const offset = ((minutes - date.getUTCHours() * 60 - date.getUTCMinutes()) % 1440 + 1440) % 1440;
  return { hour: minutes / 60, weekend: parts.weekday === 'Sat' || parts.weekday === 'Sun', utcOffset: offset * 60 };
}

export function watchWeather(onChange) {
  const state = { ...(pinnedWeather ?? clearWeather), live: false };
  if (pinnedWeather) return state;
  const refresh = async () => {
    try {
      const response = await fetch(forecastUrl);
      if (!response.ok) throw new Error(`Weather returned HTTP ${response.status}`);
      const { current } = await response.json();
      Object.assign(state, {
        temperature: current.temperature_2m, code: current.weather_code, precipitation: current.precipitation, cloud: current.cloud_cover / 100,
        windSpeed: current.wind_speed_10m, windFrom: current.wind_direction_10m, live: true,
      });
      onChange();
    } catch (error) {
      console.warn('Live weather is unavailable, so the map shows fair weather.', error);
    }
  };
  refresh();
  setInterval(refresh, refreshMinutes * 60000);
  return state;
}

const keyframes = [
  [-14, [62, 76, 124]],
  [-7, [98, 102, 156]],
  [-2.5, [178, 146, 168]],
  [2, [252, 196, 160]],
  [9, [255, 236, 212]],
  [18, [255, 255, 255]],
];

function tintFor(altitude) {
  if (altitude <= keyframes[0][0]) return keyframes[0][1];
  for (let i = 1; i < keyframes.length; i++) {
    const [to, high] = keyframes[i];
    if (altitude > to) continue;
    const [from, low] = keyframes[i - 1];
    const t = (altitude - from) / (to - from);
    return low.map((value, channel) => value + (high[channel] - value) * t);
  }
  return keyframes.at(-1)[1];
}

const ramp = (value, from, to) => Math.max(0, Math.min(1, (value - from) / (to - from)));
const peak = (hour, centre, spread) => Math.exp(-(((hour - centre) / spread) ** 2));

function crowds(hour, weekend) {
  const day = ramp(hour, 5.5, 9) * (1 - ramp(hour, 20, 23.5));
  const lunch = weekend ? peak(hour, 13, 3.5) : peak(hour, 12.5, 1.4);
  return 0.08 + 0.55 * day + 0.37 * lunch;
}

function roadUse(hour, weekend) {
  const day = ramp(hour, 5, 7.5) * (1 - ramp(hour, 19, 23.5));
  const rush = weekend ? peak(hour, 12, 3) * 0.5 : peak(hour, 8.1, 1) + peak(hour, 17, 1.3);
  return Math.min(1, 0.1 + 0.55 * day + 0.4 * rush);
}

export function conditions(ms, weather) {
  const altitude = sunAltitude(ms);
  const { hour, weekend, utcOffset } = localClock(ms);
  const { code, precipitation, cloud, windSpeed, windFrom } = weather;
  const wet = code >= 51 && code < 70 || code >= 80;
  const rain = wet ? Math.min(1, 0.25 + precipitation / 4) : 0;
  const fog = code === 45 || code === 48 ? 1 : 0;
  const storm = code >= 95;
  const overcast = Math.max(cloud ** 2, rain * 0.8, fog);
  const sun = tintFor(altitude);
  const dim = 1 - overcast * 0.16 - rain * 0.06;
  const tint = sun.map(value => value * dim);
  const toward = (windFrom + 180) * radians;
  const east = Math.sin(toward), south = -Math.cos(toward);
  const cos = Math.cos(Math.PI / 9), sin = Math.sin(Math.PI / 9);
  const direction = [cos * east + sin * south, 0.68 * (cos * south - sin * east)];
  const length = Math.hypot(...direction) || 1;
  const unit = direction.map(value => value / length);
  const darkness = ramp(-altitude, -2, 12);
  const people = crowds(hour, weekend) * (1 - rain * 0.55);
  return {
    altitude, hour, weekend, utcOffset, rain, fog, storm, overcast, tint, darkness,
    daylight: 1 - darkness,
    lights: ramp(-altitude, -3, 5),
    shadows: (1 - darkness) * (1 - overcast * 0.85) * (0.4 + cloud * 1.2),
    wind: unit.map(value => value * (2 + windSpeed * 0.45)),
    drift: unit.map(value => value * Math.max(2, windSpeed) / 3.6 * 0.58 * 0.6),
    windSpeed,
    people,
    cyclists: people * (1 - rain * 0.8),
    traffic: roadUse(hour, weekend) * (1 + rain * 0.1),
    seated: people * (1 - rain * 0.9) * (1 - darkness * 0.7),
    balloons: altitude > 2 && hour > 5.5 && hour < 19.5 && windSpeed < 20 && !rain && !storm && !fog,
    windows: (house) => {
      const evening = ramp(-altitude, -3, 4);
      const lateness = ramp(hour < 12 ? hour + 24 : hour, 21.5, 25.5);
      const early = 1 - ramp(hour, 5, 6.5);
      return house
        ? evening * (0.62 - lateness * 0.42) * (hour < 12 ? 0.6 + early * 0.4 : 1)
        : evening * (0.5 - lateness * 0.36) + overcast * 0.08;
    },
  };
}

export function paintTint(ctx, sky, bounds) {
  const [r, g, b] = sky.tint.map(Math.round);
  if (r > 252 && g > 252 && b > 252) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  if (sky.overcast > 0.3) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = (sky.overcast - 0.3) * 0.45;
    ctx.fillStyle = '#808080';
    ctx.fillRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  }
  ctx.restore();
}

export function paintFog(ctx, sky, time, width, height) {
  if (!sky.fog) return;
  ctx.save();
  ctx.fillStyle = sky.darkness > 0.5 ? 'rgba(96, 108, 124, 0.32)' : 'rgba(226, 230, 224, 0.38)';
  ctx.fillRect(0, 0, width, height);
  for (let band = 0; band < 5; band++) {
    const y = ((band * 0.23 + time * 0.004) % 1.2 - 0.1) * height;
    const haze = ctx.createLinearGradient(0, y - 90, 0, y + 90);
    const colour = sky.darkness > 0.5 ? '120, 130, 146' : '236, 238, 232';
    haze.addColorStop(0, `rgba(${colour}, 0)`);
    haze.addColorStop(0.5, `rgba(${colour}, 0.22)`);
    haze.addColorStop(1, `rgba(${colour}, 0)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, y - 90, width, 180);
  }
  ctx.restore();
}

const hash = (a, b) => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function paintRain(ctx, sky, time, width, height, scale) {
  if (!sky.rain) return;
  const count = Math.round(width * height / 2600 * sky.rain);
  const fall = 520;
  const slant = Math.max(-0.6, Math.min(0.6, sky.wind[0] * 0.04));
  const length = 7 + sky.rain * 6;
  ctx.save();
  ctx.strokeStyle = sky.darkness > 0.5 ? 'rgba(170, 186, 214, 0.42)' : 'rgba(214, 226, 236, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let drop = 0; drop < count; drop++) {
    const life = 0.55 + hash(drop, 3) * 0.4;
    const cycle = time / life + hash(drop, 1);
    const round = Math.floor(cycle);
    const t = cycle - round;
    const x = hash(drop, round * 2 + 7) * (width + 80) - 40;
    const y = hash(drop, round * 2 + 8) * height * 1.1 - height * 0.1 + t * fall * life;
    ctx.moveTo(x + slant * t * fall * life, y);
    ctx.lineTo(x + slant * (t * fall * life + length), y + length);
  }
  ctx.stroke();
  if (scale > 0.8) {
    ctx.fillStyle = sky.darkness > 0.5 ? 'rgba(170, 186, 214, 0.5)' : 'rgba(230, 238, 242, 0.55)';
    for (let splash = 0; splash < count / 3; splash++) {
      const cycle = time * 3 + hash(splash, 11);
      const round = Math.floor(cycle);
      if (cycle - round > 0.3) continue;
      const x = Math.round(hash(splash, round + 13) * width);
      const y = Math.round(hash(splash, round + 17) * height);
      const r = Math.max(1, Math.round(scale));
      ctx.fillRect(x - r, y, r, r);
      ctx.fillRect(x + r, y, r, r);
      ctx.fillRect(x, y - r, r, r);
    }
  }
  if (sky.storm && hash(Math.floor(time * 2), 99) < 0.012) {
    ctx.fillStyle = 'rgba(235, 240, 255, 0.35)';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}
