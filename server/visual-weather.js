const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const KEY = process.env.VISUALCROSSING_API_KEY;
if (!KEY) console.warn('Visual Crossing API key not set (VISUALCROSSING_API_KEY) - /api/visual-weather will fail without it');

// Simple in-memory cache: key -> { ts, data }
const cache = new Map();
const TTL = 10 * 60 * 1000; // 10 minutes

function normalizeCondition(text) {
  if (!text) return 'Indeterminado';
  const t = text.toLowerCase();
  if (t.includes('rain') || t.includes('storm') || t.includes('shower') || t.includes('chuv')) return 'Chuvoso';
  if (t.includes('cloud') || t.includes('overcast') || t.includes('nublado') || t.includes('cloudy')) return 'Nublado';
  if (t.includes('sun') || t.includes('clear') || t.includes('ensolar')) return 'Ensolarado';
  return 'Indeterminado';
}

router.get('/', async (req, res) => {
  try {
    const { lat, lon, start, end } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });
    const key = `${lat},${lon},${start||''},${end||''}`;
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.ts < TTL) return res.json({ source: 'cache', ...cached.data });

    const startPath = start ? `/${start}` : '';
    const endPath = end ? `/${end}` : '';
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(lat)},${encodeURIComponent(lon)}${startPath}${endPath}?unitGroup=metric&include=days&elements=datetime,conditions,temp,tempmax,tempmin,precip,precipprob&key=${encodeURIComponent(KEY)}&contentType=json`;

    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text().catch(()=>null);
      return res.status(502).json({ error: 'visualcrossing_error', status: r.status, body: txt });
    }
    const j = await r.json();
    const days = (j.days || []).map(d => ({ date: d.datetime, conditions: d.conditions || '', conditionSimple: normalizeCondition(d.conditions), temp: d.temp, tempmax: d.tempmax, tempmin: d.tempmin, precip: d.precip, precipprob: d.precipprob }));
    const out = { lat: j.latitude || parseFloat(lat), lon: j.longitude || parseFloat(lon), days };
    cache.set(key, { ts: now, data: out });
    res.json(out);
  } catch (e) {
    console.error('visual-weather error', e);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
