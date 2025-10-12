-- D1 schema for appointments
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  nome_cliente TEXT,
  telefone_cliente TEXT,
  servico_id TEXT,
  horario TEXT,
  data TEXT,
  observacoes TEXT,
  status TEXT,
  comprovante_key TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (data);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
