import fs from 'fs';
import path from 'path';

const base = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const tmp = path.join(process.cwd(), 'tmp_comprovante.png');
fs.writeFileSync(tmp, Buffer.from(base, 'base64'));

const services = ['lavagem-simples','lavagem-completa','enceramento','lavagem-motor'];

async function postAppointments() {
  for (let i=0;i<10;i++){
    const dt = new Date(); dt.setDate(dt.getDate()-i);
    const dateStr = dt.toISOString().split('T')[0];
    const form = new FormData();
    form.append('nomeCliente', `Teste ${i}`);
    form.append('telefoneCliente', `(11) 99999-000${i}`);
    form.append('servicoId', services[i % services.length]);
    form.append('data', dateStr);
    form.append('horario', '11:00');
    form.append('observacoes', 'sintetico');
    form.append('comprovante', fs.createReadStream(tmp));

    try {
      const res = await fetch('http://localhost:4000/api/appointments', { method: 'POST', body: form });
      const text = await res.text();
      console.log(`[${i}] status=${res.status}`, text);
    } catch (e) {
      console.error('error', e.message);
    }
  // pequeno atraso
    await new Promise(r=>setTimeout(r,200));
  }
  try { fs.unlinkSync(tmp); } catch(e){}
}

postAppointments().then(()=>console.log('done')).catch(err=>console.error(err));
