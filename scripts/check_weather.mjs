// Uses global fetch provided by Node 18+
(async ()=>{
  try {
    const cep = process.argv[2] || '01001000';
    const vres = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const vj = await vres.json();
    console.log('ViaCEP:', vj.localidade, vj.uf);
    const q = encodeURIComponent(`${vj.localidade||''} ${vj.uf||''}`.trim());
    console.log('Geocoding query:', q);
    const gres = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=pt`);
    const gj = await gres.json();
    console.log('Open-Meteo geocode result:', (gj.results && gj.results[0]) ? [gj.results[0].latitude, gj.results[0].longitude] : null);
    if ((!gj.results || !gj.results[0])) {
      console.log('Open-Meteo geocoding returned no results — trying Nominatim fallback');
      const nomq = encodeURIComponent(`${vj.localidade || ''} ${vj.uf || ''} Brasil`.trim());
      const nomUrl = `https://nominatim.openstreetmap.org/search.php?q=${nomq}&format=jsonv2&limit=1`;
      const nres = await fetch(nomUrl, { headers: { 'User-Agent': 'LavaRapido-Test/1.0' } });
      const nj = await nres.json();
      console.log('Nominatim result:', nj && nj[0] ? [nj[0].lat, nj[0].lon] : null);
      if (!(nj && nj[0])) return;
      gj.results = [{ latitude: parseFloat(nj[0].lat), longitude: parseFloat(nj[0].lon) }];
    }
    const lat = gj.results[0].latitude; const lon = gj.results[0].longitude;
    const start = '2025-10-09'; const end = '2025-10-11';
    const wres = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=weathercode&timezone=auto`);
    const wj = await wres.json();
    console.log('Weather days:', wj.daily && wj.daily.time, wj.daily && wj.daily.weathercode);
  } catch (e) { console.error('err', e); }
})();