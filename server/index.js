require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
// Middlewares de segurança
app.use(helmet());
app.use(cors({ origin: true }));
// Faz o parse de JSON com limite razoável
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
if (!fs.existsSync(APPOINTMENTS_FILE)) fs.writeFileSync(APPOINTMENTS_FILE, '[]');

// Funções simples de leitura/escrita no armazenamento em disco
function readAppointments() {
  try {
    const raw = fs.readFileSync(APPOINTMENTS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}
function writeAppointments(arr) {
  fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(arr, null, 2));
}

// Configuração do Multer com limite de 1 MB e filtro de tipo de arquivo
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, base + ext);
  }
});

function fileFilter (req, file, cb) {
  // Aceita apenas imagens e PDFs
  const allowed = /jpeg|jpg|png|gif|pdf/;
  const mimetype = allowed.test((file.mimetype || '').toLowerCase());
  const extname = allowed.test(path.extname(file.originalname || '').toLowerCase());
  if (mimetype && extname) return cb(null, true);
  cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
}

const upload = multer({ 
  storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB
  fileFilter
});

// Credenciais do admin: usa hash via env ou um padrão seguro apenas para testes
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin@2025', 8);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES = '12h';

// Limitador de requisições em endpoints de autenticação para mitigar força bruta
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

// Limitador aplicado à rota de login logo abaixo

// Endpoint de autenticação (login com senha)
app.post('/api/admin/login', authLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });
  if (!bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) return res.status(401).json({ error: 'invalid password' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token });
});

// Middleware que protege rotas administrativas
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'missing authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid authorization header' });
  try {
    const payload = jwt.verify(parts[1], JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

// Cria agendamento (com upload opcional de comprovante)
app.post('/api/appointments', upload.single('comprovante'), (req, res) => {
  const { nomeCliente, telefoneCliente, servicoId, horario, data, observacoes } = req.body || {};
  // Validação básica de tamanho dos campos
  if ((nomeCliente || '').length > 100) return res.status(400).json({ error: 'nomeCliente too long' });
  if ((telefoneCliente || '').length > 30) return res.status(400).json({ error: 'telefoneCliente too long' });
  if ((observacoes || '').length > 500) return res.status(400).json({ error: 'observacoes too long' });
  const appointments = readAppointments();
  const id = Date.now().toString(36) + '-' + Math.round(Math.random() * 1e6).toString(36);
  const newA = {
    id,
    nomeCliente: nomeCliente || '',
    telefoneCliente: telefoneCliente || '',
    servicoId: servicoId || null,
    horario: horario || '',
    data: data || '',
    observacoes: observacoes || '',
    status: req.file ? 'Reservado' : 'Pendente',
    comprovantePath: req.file ? path.relative(__dirname, req.file.path).replace(/\\/g, '/') : null,
    createdAt: new Date().toISOString()
  };
  appointments.push(newA);
  writeAppointments(appointments);
  res.status(201).json(newA);
});

// Lista todos os agendamentos (admin)
app.get('/api/appointments', requireAdmin, (req, res) => {
  const appointments = readAppointments();
  res.json(appointments);
});

// Lista pública de agendamentos (campos não sensíveis) para exibir disponibilidade
app.get('/api/appointments/public', (req, res) => {
  try {
    const appointments = readAppointments();
  // Retorna apenas campos essenciais para não expor dados sensíveis
    const publicList = appointments.map(a => ({ id: a.id, nomeCliente: a.nomeCliente, servicoId: a.servicoId, data: a.data, horario: a.horario, status: a.status }));
    res.json(publicList);
  } catch (e) {
    res.status(500).json({ error: 'failed' });
  }
});

// Download/visualização de comprovante (admin)
// Retorna o arquivo como anexo; rota protegida
app.get('/api/appointments/:id/comprovante', requireAdmin, (req, res) => {
  const id = req.params.id;
  const appointments = readAppointments();
  const ap = appointments.find(a => a.id === id);
  if (!ap || !ap.comprovantePath) return res.status(404).json({ error: 'comprovante not found' });
  const abs = path.join(__dirname, ap.comprovantePath);
  res.sendFile(abs, { dotfiles: 'deny' }, function (err) {
    if (err) {
      res.status(500).json({ error: 'failed to send file' });
    }
  });
});

// Confirma um agendamento (admin)
app.post('/api/appointments/:id/confirm', requireAdmin, (req, res) => {
  const id = req.params.id;
  const appointments = readAppointments();
  const ap = appointments.find(a => a.id === id);
  if (!ap) return res.status(404).json({ error: 'not found' });
  ap.status = 'Confirmado';
  writeAppointments(appointments);
  res.json(ap);
});

// Exclui um agendamento (admin)
app.delete('/api/appointments/:id', requireAdmin, (req, res) => {
  const id = req.params.id;
  let appointments = readAppointments();
  const idx = appointments.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const [removed] = appointments.splice(idx, 1);
  // Remove o arquivo associado, se existir
  if (removed.comprovantePath) {
    const abs = path.join(__dirname, removed.comprovantePath);
    if (fs.existsSync(abs)) {
      try { fs.unlinkSync(abs); } catch (e) { /* ignore */ }
    }
  }
  writeAppointments(appointments);
  res.json({ ok: true });
});

// Serve uploads de forma estática para conveniência (em produção ajustar segurança)
app.use('/uploads', express.static(UPLOADS_DIR));

// Proxy de clima do Visual Crossing (exige VISUALCROSSING_API_KEY nas variáveis)
try {
  const visualWeather = require('./visual-weather');
  app.use('/api/visual-weather', visualWeather);
} catch (e) {
  console.warn('visual-weather route not loaded', e.message);
}

// Endpoint simples de saúde para healthchecks do container
app.get('/health', (req, res) => {
  const appointments = readAppointments();
  res.json({ status: 'ok', now: new Date().toISOString(), appointments: appointments.length });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on http://localhost:${PORT}`));
