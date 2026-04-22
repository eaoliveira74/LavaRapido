BEGIN TRANSACTION;

INSERT INTO appointments (id, nome_cliente, telefone_cliente, servico_id, horario, data, observacoes, status, comprovante_key, created_at) VALUES
('synth-20260421-1', 'Cliente Sintético A', '(11) 98765-4321', 'lavagem-simples', '09:00', '2026-04-21', 'Agendamento sintético', 'Pendente', NULL, '2026-04-21T08:00:00.000Z'),
('synth-20260422-1', 'Cliente Sintético B', '(11) 98765-4322', 'lavagem-completa', '10:30', '2026-04-22', 'Agendamento sintético', 'Reservado', NULL, '2026-04-22T09:15:00.000Z'),
('synth-20260423-1', 'Cliente Sintético C', '(11) 98765-4323', 'enceramento', '14:00', '2026-04-23', 'Agendamento sintético', 'Pendente', NULL, '2026-04-23T12:30:00.000Z'),
('synth-20260424-1', 'Cliente Sintético D', '(11) 98765-4324', 'lavagem-motor', '11:30', '2026-04-24', 'Agendamento sintético', 'Confirmado', NULL, '2026-04-24T10:10:00.000Z'),
('synth-20260425-1', 'Cliente Sintético E', '(11) 98765-4325', 'lavagem-completa', '09:30', '2026-04-25', 'Agendamento sintético', 'Reservado', NULL, '2026-04-25T08:45:00.000Z'),
('synth-20260425-2', 'Cliente Sintético F', '(11) 98765-4326', 'lavagem-simples', '15:00', '2026-04-25', 'Agendamento sintético', 'Pendente', NULL, '2026-04-25T13:20:00.000Z');

COMMIT;
