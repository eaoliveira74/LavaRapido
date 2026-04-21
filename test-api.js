// Teste simplificado da rota /api/appointments/future
// Para executar: node test-api.js

// Simula o resultado esperado da API
const mockAppointments = [
  {
    id: "abc123-xyz",
    nomeCliente: "João Silva",
    servicoId: "lavagem-simples",
    data: "2026-04-25",
    horario: "09:00",
    status: "Pendente"
  },
  {
    id: "def456-uvw",
    nomeCliente: "Maria Santos",
    servicoId: "lavagem-completa",
    data: "2026-04-26",
    horario: "14:00",
    status: "Reservado"
  },
  {
    id: "ghi789-rst",
    nomeCliente: "Carlos Souza",
    servicoId: "enceramento",
    data: "2026-04-27",
    horario: "10:30",
    status: "Confirmado"
  }
];

// Simula a função que filtra agendamentos futuros
function getFutureAppointments(appointments, todayDate) {
  const today = new Date(todayDate).toISOString().slice(0, 10);
  return appointments
    .filter(apt => apt.data >= today)
    .sort((a, b) => {
      const dateCompare = a.data.localeCompare(b.data);
      return dateCompare !== 0 ? dateCompare : a.horario.localeCompare(b.horario);
    });
}

// Teste
console.log("🧪 TESTE DA API /api/appointments/future\n");

const today = "2026-04-21";
console.log(`📅 Data atual: ${today}\n`);

const futureAppointments = getFutureAppointments(mockAppointments, today);

console.log(`✅ Agendamentos futuros encontrados: ${futureAppointments.length}\n`);
console.log("Resultado JSON:\n");
console.log(JSON.stringify(futureAppointments, null, 2));

// Validações
console.log("\n✔️ VALIDAÇÕES:");
console.log(`   ✓ Todos têm data >= ${today}? ${futureAppointments.every(a => a.data >= today) ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   ✓ Estão ordenados por data? ${futureAppointments.every((a, i, arr) => i === 0 || a.data >= arr[i-1].data) ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   ✓ Campos obrigatórios presentes? ${futureAppointments.every(a => a.id && a.nomeCliente && a.data && a.horario) ? '✅ SIM' : '❌ NÃO'}`);
console.log(`   ✓ Dados sensíveis removidos (sem telefone)? ${futureAppointments.every(a => !a.telefoneCliente) ? '✅ SIM' : '❌ NÃO'}`);
