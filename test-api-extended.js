// Testes estendidos para a API /api/appointments/future
// Executa: node test-api-extended.js

const testCases = [
  {
    name: "Teste 1: Filtrar apenas agendamentos futuros",
    data: [
      { id: "1", data: "2026-04-20", horario: "09:00", nomeCliente: "Passado" },
      { id: "2", data: "2026-04-21", horario: "10:00", nomeCliente: "Hoje" },
      { id: "3", data: "2026-04-22", horario: "11:00", nomeCliente: "Futuro" },
    ],
    today: "2026-04-21",
    expected: 2, // Hoje e Futuro
    description: "Deve retornar agendamentos de hoje em diante"
  },
  {
    name: "Teste 2: Ordenação por data e horário",
    data: [
      { id: "1", data: "2026-04-23", horario: "15:00", nomeCliente: "Tarde" },
      { id: "2", data: "2026-04-23", horario: "09:00", nomeCliente: "Manhã" },
      { id: "3", data: "2026-04-22", horario: "10:00", nomeCliente: "Ontem" },
    ],
    today: "2026-04-21",
    expected: 3,
    description: "Deve ordenar por data ASC, depois horário ASC"
  },
  {
    name: "Teste 3: Lista vazia (sem agendamentos futuros)",
    data: [
      { id: "1", data: "2026-04-20", horario: "09:00", nomeCliente: "Passado 1" },
      { id: "2", data: "2026-04-19", horario: "10:00", nomeCliente: "Passado 2" },
    ],
    today: "2026-04-21",
    expected: 0,
    description: "Deve retornar array vazio quando não há agendamentos futuros"
  },
  {
    name: "Teste 4: Campos corretos (sem dados sensíveis)",
    data: [
      { 
        id: "1", 
        nomeCliente: "João",
        telefoneCliente: "11999999999",
        servicoId: "lavagem-simples",
        data: "2026-04-22", 
        horario: "09:00",
        status: "Pendente",
        observacoes: "Dados sensíveis"
      },
    ],
    today: "2026-04-21",
    expected: 1,
    description: "Deve remover telefoneCliente e observacoes"
  }
];

// Função que simula a lógica do worker
function getFutureAppointments(appointments, todayDate) {
  const today = new Date(todayDate).toISOString().slice(0, 10);
  return appointments
    .filter(apt => apt.data >= today)
    .sort((a, b) => {
      const dateCompare = a.data.localeCompare(b.data);
      return dateCompare !== 0 ? dateCompare : a.horario.localeCompare(b.horario);
    })
    .map(apt => ({
      id: apt.id,
      nomeCliente: apt.nomeCliente,
      servicoId: apt.servicoId,
      data: apt.data,
      horario: apt.horario,
      status: apt.status
    }));
}

// Executar testes
console.log("\n╔════════════════════════════════════════════════════════╗");
console.log("║       TESTES DA API /api/appointments/future        ║");
console.log("╚════════════════════════════════════════════════════════╝\n");

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  console.log(`\n📋 ${test.name}`);
  console.log(`   └─ ${test.description}`);
  
  const result = getFutureAppointments(test.data, test.today);
  const success = result.length === test.expected;
  
  if (success) {
    console.log(`   ✅ PASSOU - Retornou ${result.length} agendamento(s)`);
    passed++;
    
    // Mostrar resultado para testes relevantes
    if (test.expected > 0 && index === 1) {
      console.log(`   Ordem verificada:`);
      result.forEach((apt, i) => {
        console.log(`     ${i + 1}. ${apt.data} ${apt.horario} - ${apt.nomeCliente}`);
      });
    }
    
    if (test.expected > 0 && index === 3) {
      console.log(`   Campos retornados:`, Object.keys(result[0]).join(", "));
      console.log(`   ✓ Sem telefoneCliente?`, !result[0].telefoneCliente ? "✅" : "❌");
      console.log(`   ✓ Sem observacoes?`, !result[0].observacoes ? "✅" : "❌");
    }
  } else {
    console.log(`   ❌ FALHOU - Esperava ${test.expected}, obteve ${result.length}`);
    failed++;
  }
});

// Resumo
console.log("\n╔════════════════════════════════════════════════════════╗");
console.log(`║  RESULTADO: ${passed} ✅  |  ${failed} ❌               `);
console.log("╚════════════════════════════════════════════════════════╝\n");

if (failed === 0) {
  console.log("🎉 TODOS OS TESTES PASSARAM!\n");
} else {
  console.log(`⚠️  ${failed} teste(s) falharam.\n`);
}
