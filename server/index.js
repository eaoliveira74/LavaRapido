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
const STATS_FILE = path.join(DATA_DIR, 'stats-daily.json');
if (!fs.existsSync(STATS_FILE)) fs.writeFileSync(STATS_FILE, '{}');

const SERVICE_PRICE_MAP = {
  'lavagem-simples': 15.00,
  'lavagem-completa': 25.00,
  'enceramento': 40.00,
  'lavagem-motor': 30.00
};

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

function readStatsStore() {
  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf8');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeStatsStore(obj) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(obj || {}, null, 2));
}

function normalizeDateISO(value) {
  if (!value) return null;
  return value.toString().slice(0, 10);
}

function withinRange(iso, start, end) {
  if (!iso) return false;
  if (start && iso < start) return false;
  if (end && iso > end) return false;
  return true;
}

function getServicePrice(servicoId) {
  if (!servicoId) return 0;
  const direct = SERVICE_PRICE_MAP[servicoId];
  if (typeof direct === 'number' && !Number.isNaN(direct)) return direct;
  return 0;
}

function aggregateStats(appointments, startISO, endISO) {
  const map = new Map();
  (appointments || []).forEach((ap) => {
    if (!ap) return;
    const status = (ap.status || '').toLowerCase();
    if (!(status.includes('concluído') || status.includes('concluido'))) return;
    const iso = normalizeDateISO(ap.data);
    if (!withinRange(iso, startISO, endISO)) return;
    const entry = map.get(iso) || { date: iso, carsWashed: 0, totalRevenue: 0, rainProbability: null };
    entry.carsWashed += 1;
    entry.totalRevenue = Math.round((entry.totalRevenue + getServicePrice(ap.servicoId)) * 100) / 100;
    map.set(iso, entry);
  });
  return map;
}

function recomputeStatsForDates(dates, appointments) {
  const unique = Array.from(new Set((dates || []).map(normalizeDateISO))).filter(Boolean);
  if (!unique.length) return;
  const store = readStatsStore();
  unique.forEach((iso) => {
    const aggregated = aggregateStats(appointments, iso, iso);
    const entry = aggregated.get(iso);
    const current = store[iso];
    if (!entry) {
      if (current) {
        store[iso] = {
          date: iso,
          carsWashed: typeof current.carsWashed === 'number' ? current.carsWashed : 0,
          totalRevenue: typeof current.totalRevenue === 'number' ? current.totalRevenue : 0,
          rainProbability: current.rainProbability !== undefined ? current.rainProbability : null
        };
      }
      return;
    }
    store[iso] = {
      date: iso,
      carsWashed: entry.carsWashed,
      totalRevenue: entry.totalRevenue,
      rainProbability: current && current.rainProbability !== undefined ? current.rainProbability : entry.rainProbability
    };
  });
  writeStatsStore(store);
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

// Marca um agendamento como concluído (admin)
app.post('/api/appointments/:id/complete', requireAdmin, (req, res) => {
  const id = req.params.id;
  const appointments = readAppointments();
  const ap = appointments.find(a => a.id === id);
  if (!ap) return res.status(404).json({ error: 'not found' });
  ap.status = 'Concluído';
  writeAppointments(appointments);
  recomputeStatsForDates([ap.data], appointments);
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
  if ((removed.status || '').toLowerCase().includes('conclu')) {
    recomputeStatsForDates([removed.data], appointments);
  }
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

// Estatísticas agregadas diárias (público)
app.get('/api/stats-daily', (req, res) => {
  const start = normalizeDateISO(req.query.start);
  const end = normalizeDateISO(req.query.end);
  if (!start || !end) return res.status(400).json({ error: 'start and end required' });
  const appointments = readAppointments();
  const aggregated = aggregateStats(appointments, start, end);
  const persisted = readStatsStore();
  const merged = new Map(aggregated);
  Object.entries(persisted || {}).forEach(([date, data]) => {
    const iso = normalizeDateISO(date);
    if (!withinRange(iso, start, end)) return;
    const entry = merged.get(iso) || { date: iso, carsWashed: 0, totalRevenue: 0, rainProbability: null };
    if (typeof data.carsWashed === 'number' && data.carsWashed > entry.carsWashed) entry.carsWashed = data.carsWashed;
    if (typeof data.totalRevenue === 'number' && data.totalRevenue > entry.totalRevenue) entry.totalRevenue = Math.round(data.totalRevenue * 100) / 100;
    if (data.rainProbability !== undefined) entry.rainProbability = (data.rainProbability === null || data.rainProbability === '') ? null : Number(data.rainProbability);
    merged.set(iso, entry);
  });
  const results = Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
  res.json(results);
});

// Estatísticas agregadas (admin) para leitura/atualização manual (ex: chuva)
app.all('/api/admin/stats-daily', requireAdmin, (req, res) => {
  if (req.method === 'GET') {
    const start = normalizeDateISO(req.query.start);
    const end = normalizeDateISO(req.query.end);
    if (!start || !end) return res.status(400).json({ error: 'start and end required' });
    const appointments = readAppointments();
    const aggregated = aggregateStats(appointments, start, end);
    const persisted = readStatsStore();
    const merged = new Map(aggregated);
    Object.entries(persisted || {}).forEach(([date, data]) => {
      const iso = normalizeDateISO(date);
      if (!withinRange(iso, start, end)) return;
      const entry = merged.get(iso) || { date: iso, carsWashed: 0, totalRevenue: 0, rainProbability: null };
      if (typeof data.carsWashed === 'number' && data.carsWashed > entry.carsWashed) entry.carsWashed = data.carsWashed;
      if (typeof data.totalRevenue === 'number' && data.totalRevenue > entry.totalRevenue) entry.totalRevenue = Math.round(data.totalRevenue * 100) / 100;
      if (data.rainProbability !== undefined) entry.rainProbability = (data.rainProbability === null || data.rainProbability === '') ? null : Number(data.rainProbability);
      merged.set(iso, entry);
    });
    const results = Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
    return res.json(results);
  }

  if (req.method === 'POST') {
    const { date, carsWashed, totalRevenue, rainProbability } = req.body || {};
    const iso = normalizeDateISO(date);
    if (!iso) return res.status(400).json({ error: 'date required' });
    const store = readStatsStore();
    const current = store[iso] || {};
    current.date = iso;
    if (carsWashed !== undefined) {
      const n = Number(carsWashed);
      if (!Number.isNaN(n)) current.carsWashed = n;
    }
    if (totalRevenue !== undefined) {
      const n = Number(totalRevenue);
      if (!Number.isNaN(n)) current.totalRevenue = Math.round(n * 100) / 100;
    }
    if (rainProbability !== undefined) {
      if (rainProbability === null || rainProbability === '') current.rainProbability = null;
      else {
        const n = Number(rainProbability);
        if (!Number.isNaN(n)) current.rainProbability = n;
      }
    }
    store[iso] = current;
    writeStatsStore(store);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'method not allowed' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on http://localhost:${PORT}`));
