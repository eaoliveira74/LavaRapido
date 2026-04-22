import fs from 'fs';
import path from 'path';

const base = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
const tmp = path.join(process.cwd(), 'tmp_comprovante.png');
fs.writeFileSync(tmp, Buffer.from(base, 'base64'));

const services = ['lavagem-simples','lavagem-completa','enceramento','lavagem-motor'];

async function postAppointments() {
  const schedule = [
    { nome: 'Cliente Sintético A', telefone: '(11) 98765-4321', servico: 'lavagem-simples', data: '2026-04-21', horario: '09:00' },
    { nome: 'Cliente Sintético B', telefone: '(11) 98765-4322', servico: 'lavagem-completa', data: '2026-04-22', horario: '10:30' },
    { nome: 'Cliente Sintético C', telefone: '(11) 98765-4323', servico: 'enceramento', data: '2026-04-23', horario: '14:00' },
    { nome: 'Cliente Sintético D', telefone: '(11) 98765-4324', servico: 'lavagem-motor', data: '2026-04-24', horario: '11:30' },
    { nome: 'Cliente Sintético E', telefone: '(11) 98765-4325', servico: 'lavagem-completa', data: '2026-04-25', horario: '09:30' },
    { nome: 'Cliente Sintético F', telefone: '(11) 98765-4326', servico: 'lavagem-simples', data: '2026-04-25', horario: '15:00' }
  ];

  for (let i = 0; i < schedule.length; i++) {
    const item = schedule[i];
    const form = new FormData();
    form.append('nomeCliente', item.nome);
    form.append('telefoneCliente', item.telefone);
    form.append('servicoId', item.servico);
    form.append('data', item.data);
    form.append('horario', item.horario);
    form.append('observacoes', 'Agendamento sintético');
    form.append('comprovante', fs.createReadStream(tmp));

    try {
      const res = await fetch('http://localhost:4000/api/appointments', { method: 'POST', body: form });
      const text = await res.text();
      console.log(`[${i}] status=${res.status}`, text);
    } catch (e) {
      console.error('error', e.message);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  try { fs.unlinkSync(tmp); } catch (e) {}
}

postAppointments().then(()=>console.log('done')).catch(err=>console.error(err));
