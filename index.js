// O objeto 'bootstrap' está disponível globalmente pois foi carregado via CDN no index.html.

// Wrap initialization in a named function so it runs whether DOMContentLoaded already fired
function init() {

  // --- 1. ESTADO DA APLICAÇÃO ---
  // Aqui guardamos todos os dados que a aplicação utiliza.
  // Usamos o localStorage para que os dados não se percam ao recarregar a página.

  let services = JSON.parse(localStorage.getItem('services')) || [
    { id: 'lavagem-simples', nome: 'Lavagem Simples', preco: 15.00, duration: 30 },
    { id: 'lavagem-completa', nome: 'Lavagem Completa', preco: 25.00, duration: 60 },
    { id: 'enceramento', nome: 'Enceramento', preco: 40.00, duration: 90 },
    { id: 'lavagem-motor', nome: 'Lavagem do Motor', preco: 30.00, duration: 45 }
  ];
    // Appointments are authoritative on the server. Do not load or persist them in localStorage.
    let appointments = [];
    // default available times are generated every 30 minutes between 08:00 and 17:00
    const AVAILABLE_TIMES = [];
    const genTimes = () => {
        const start = 8 * 60; // in minutes
        const end = 17 * 60; // inclusive end hour
        for (let m = start; m <= end; m += 30) {
            const hh = Math.floor(m / 60).toString().padStart(2, '0');
            const mm = (m % 60).toString().padStart(2, '0');
            AVAILABLE_TIMES.push(`${hh}:${mm}`);
        }
    };
    genTimes();
  // Variável para guardar o agendamento a ser notificado
  let currentNotificationAppointment = null;
    // Admin auth token (JWT) for protected API calls
    let adminToken = localStorage.getItem('adminToken') || null;
    const setAdminToken = (t) => {
        adminToken = t;
        if (t) localStorage.setItem('adminToken', t);
        else localStorage.removeItem('adminToken');
    };
    let serverAppointments = null;
    let publicAppointments = null;


  // --- 2. REFERÊNCIAS AOS ELEMENTOS DO DOM ---
  const roleSelectionView = document.getElementById('role-selection-view');
  const clientView = document.getElementById('client-view');
  const adminView = document.getElementById('admin-view');
  const logoutButton = document.getElementById('logout-button');
  const announcementContainer = document.getElementById('announcement-container');
  
  // Elementos da visão do cliente
  const datePicker = document.getElementById('date-picker');
  const availableTimesGrid = document.getElementById('available-times-grid');
  const availableTimesTitle = document.getElementById('available-times-title');
  const appointmentForm = document.getElementById('appointment-form');
  const serviceSelect = document.getElementById('servicoId');
  const timeSelect = document.getElementById('horario');
  const completionTimeAlert = document.getElementById('completion-time-alert');

  // Elementos da visão do admin
  const adminAppointmentsSection = document.getElementById('admin-appointments-section');
  const adminServicesSection = document.getElementById('admin-services-section');
  const appointmentsTableBody = document.getElementById('appointments-table-body');
  const servicesList = document.getElementById('services-list');
  const serviceForm = document.getElementById('service-form');

  // Elementos do Modal de Notificação do WhatsApp
  const whatsAppModalElement = document.getElementById('whatsapp-modal');
  const whatsAppModal = new bootstrap.Modal(whatsAppModalElement);
  const whatsAppClientName = document.getElementById('whatsapp-client-name');
  const whatsAppMessageTextarea = document.getElementById('whatsapp-message');
  const sendWhatsAppBtn = document.getElementById('send-whatsapp-btn');
  // WhatsApp modal extras
  const whatsAppTemplateSel = document.getElementById('whatsapp-template');
  const whatsAppIncludePrice = document.getElementById('whatsapp-include-price');
  const whatsAppIncludeReview = document.getElementById('whatsapp-include-review');
  const whatsAppIncludeLocation = document.getElementById('whatsapp-include-location');

  // Optional env-configurable URLs
  const getReviewUrl = () => {
      try {
          if (typeof window !== 'undefined' && window.__REVIEW_URL__) return window.__REVIEW_URL__;
      } catch(_) {}
      try {
          if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_REVIEW_URL) return import.meta.env.VITE_REVIEW_URL;
      } catch(_) {}
      return '';
  };
  const getLocationUrl = () => {
      try {
          if (typeof window !== 'undefined' && window.__LOCATION_URL__) return window.__LOCATION_URL__;
      } catch(_) {}
      try {
          if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_LOCATION_URL) return import.meta.env.VITE_LOCATION_URL;
      } catch(_) {}
      return '';
  };

  // Build WhatsApp message from controls
  function buildWhatsappMessage(app) {
      if (!app) return '';
      const serviceName = services.find(s => s.id === app.servicoId)?.nome || 'lavagem';
      const dateStr = new Date(app.data + 'T00:00:00').toLocaleDateString('pt-BR');
      const hour = app.horario;
      const template = (whatsAppTemplateSel && whatsAppTemplateSel.value) || 'conclusao';
      let parts = [];
      if (template === 'confirmacao') {
          parts.push(`Olá ${app.nomeCliente}, seu agendamento de ${serviceName} foi CONFIRMADO para ${dateStr} às ${hour}.`);
      } else { // conclusao
          parts.push(`Olá ${app.nomeCliente}, informamos que a ${serviceName} do seu veículo foi CONCLUÍDA em ${dateStr} às ${hour}.`);
      }
      // Include price
      if (whatsAppIncludePrice && whatsAppIncludePrice.checked) {
          const price = services.find(s => s.id === app.servicoId)?.preco;
          if (typeof price === 'number') parts.push(`Valor: R$ ${price.toFixed(2)}.`);
      }
      // Include review link
      if (whatsAppIncludeReview && whatsAppIncludeReview.checked) {
          const link = getReviewUrl();
          if (link) parts.push(`Avalie nosso atendimento: ${link}`);
      }
      // Include location
      if (whatsAppIncludeLocation && whatsAppIncludeLocation.checked) {
          const link = getLocationUrl();
          if (link) parts.push(`Nossa localização: ${link}`);
      }
      parts.push('Agradecemos a preferência! Qualquer dúvida, estamos à disposição.');
      return parts.join(' ');
  }

  function refreshWhatsappPreview() {
      if (!currentNotificationAppointment) return;
      const msg = buildWhatsappMessage(currentNotificationAppointment);
      if (whatsAppMessageTextarea) whatsAppMessageTextarea.value = msg;
  }


  // --- 3. FUNÇÕES DE UTILIDADE E LÓGICA DE NEGÓCIO ---
  
    /**
     * Persiste apenas os serviços no localStorage.
     * Observação: os agendamentos agora são mantidos no servidor (fonte de verdade).
     */
    const saveData = () => {
        localStorage.setItem('services', JSON.stringify(services));
        // Intencional: não persistir 'appointments' localmente para forçar uso do servidor
    };
  
   /**
   * Exibe uma mensagem de feedback (alerta) para o usuário.
   */
  const showAnnouncement = (message, type = 'success') => {
      announcementContainer.innerHTML = `<div class="alert alert-${type}" role="alert">${message}</div>`;
      setTimeout(() => {
          announcementContainer.innerHTML = '';
      }, 5000);
  };

    // Resolve base URL do backend a partir de window.__BACKEND_URL__ ou Vite env
    const getBackendBase = () => {
        try {
            if (typeof window !== 'undefined' && window.__BACKEND_URL__) return window.__BACKEND_URL__;
        } catch (_) {}
        try {
            if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL) {
                return import.meta.env.VITE_BACKEND_URL;
            }
        } catch (_) {}
        try {
            if (typeof window !== 'undefined' && /\.github\.io$/.test(window.location.hostname)) {
                // Default to Cloudflare Worker in GitHub Pages if not provided by env
                return 'https://lava-rapido-proxy.e-a-oliveira74.workers.dev';
            }
        } catch (_) {}
        return 'http://localhost:4000';
    };

    // Map server-side error messages to user-friendly text
    const friendlyError = (serverMsg) => {
        if (!serverMsg) return 'Ocorreu um erro. Tente novamente.';
        const msg = serverMsg.toString().toLowerCase();
    if (msg.includes('invalid file type') || msg.includes('apenas pdf') || msg.includes('tipo de arquivo inválido')) return 'Formato de arquivo inválido. Envie apenas PDF.';
        if (msg.includes('file too large') || msg.includes('request entity too large') || msg.includes('payload too large') || msg.includes('exceeded')) return 'Arquivo muito grande. O limite é 1 MB.';
        if (msg.includes('password')) return 'Senha incorreta.';
        return serverMsg;
    };

  /**
   * Retorna a data de hoje no formato YYYY-MM-DD.
   */
  const getTodayString = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  };

  /**
   * Troca a visualização entre cliente, admin e seleção de perfil.
   */
  const switchView = (role) => {
    roleSelectionView.classList.add('d-none');
    clientView.classList.add('d-none');
    adminView.classList.add('d-none');
    logoutButton.classList.add('d-none');

    if (role === 'client') {
      clientView.classList.remove('d-none');
      logoutButton.classList.remove('d-none');
      renderClientView();
    } else if (role === 'admin') {
      adminView.classList.remove('d-none');
      logoutButton.classList.remove('d-none');
      renderAdminView();
    } else {
      roleSelectionView.classList.remove('d-none');
    }
  };
  
  // --- 4. FUNÇÕES DE RENDERIZAÇÃO (ATUALIZAÇÃO DA INTERFACE) ---

  const renderClientView = () => {
        populateServiceSelect();
        // Refresh public appointments (server) to compute availability, then update UI
        fetchPublicAppointments().then(() => updateAvailableTimes()).catch(() => updateAvailableTimes());
    // renderClientAppointments foi removido
  };

    // (adiado) -- carregamento inicial de agendamentos públicos será feito após a definição da função
  
  const renderAdminView = (activeTab = 'appointments') => {
      // If we have a token, try fetching server-side appointments
      if (adminToken) fetchAdminAppointments().catch(() => {});
      renderAppointmentsTable();
      renderServicesList();
      document.getElementById('admin-appointments-section').classList.toggle('d-none', activeTab !== 'appointments');
      document.getElementById('admin-services-section').classList.toggle('d-none', activeTab !== 'services');
            document.getElementById('admin-stats-section').classList.toggle('d-none', activeTab !== 'stats');
      document.getElementById('show-appointments-btn').classList.toggle('btn-cyan', activeTab === 'appointments');
      document.getElementById('show-appointments-btn').classList.toggle('btn-secondary', activeTab !== 'appointments');
      document.getElementById('show-services-btn').classList.toggle('btn-cyan', activeTab === 'services');
      document.getElementById('show-services-btn').classList.toggle('btn-secondary', activeTab !== 'services');
            const showStatsBtn = document.getElementById('show-stats-btn');
            if (showStatsBtn) {
                showStatsBtn.classList.toggle('btn-cyan', activeTab === 'stats');
                showStatsBtn.classList.toggle('btn-outline-light', activeTab !== 'stats');
            }
            if (activeTab === 'stats') initializeStats();
  };

    // Fetch appointments from backend (requires adminToken)
    const fetchAdminAppointments = async () => {
    const backend = getBackendBase();
        if (!adminToken) return;
        try {
            const res = await fetch(`${backend}/api/appointments`, { headers: { Authorization: `Bearer ${adminToken}` } });
            if (!res.ok) {
                // If unauthorized, clear stale token and prompt re-login
                if (res.status === 401 || res.status === 403) {
                    setAdminToken(null);
                    serverAppointments = null;
                    showAnnouncement('Sessão de administrador expirada ou inválida. Faça login novamente.', 'warning');
                    return;
                }
                serverAppointments = null;
                const txt = await res.text().catch(()=>'');
                showAnnouncement(`Falha ao carregar agendamentos: ${txt || res.status}`,'danger');
                return;
            }
            serverAppointments = await res.json();
            renderAppointmentsTable();
        } catch (err) {
            serverAppointments = null;
            showAnnouncement('Não foi possível conectar ao servidor para listar agendamentos.','warning');
        }
    };

    // Fetch public appointments (no auth) so admin on desktop can see server-saved appointments made from mobile
    const fetchPublicAppointments = async () => {
        try {
            const backend = getBackendBase();
            const res = await fetch(`${backend}/api/appointments/public`);
            if (!res.ok) {
                publicAppointments = null;
                return;
            }
            publicAppointments = await res.json();
            renderAppointmentsTable();
        } catch (e) {
            publicAppointments = null;
        }
    };
  
  const populateServiceSelect = () => {
    serviceSelect.innerHTML = '<option value="">Selecione um serviço</option>';
    services.forEach(s => {
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = `${s.nome} - R$ ${s.preco.toFixed(2)} (${s.duration} min)`;
      serviceSelect.appendChild(option);
    });
  };
  
  const updateAvailableTimes = () => {
      const selectedDate = datePicker.value;
      // block past times when selected date is today
      const now = new Date();
      const tzOffset = now.getTimezoneOffset();
      const todayStr = new Date(now.getTime() - tzOffset * 60000).toISOString().slice(0,10);
      const isToday = selectedDate === todayStr;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR');
      availableTimesTitle.textContent = `Horários para ${displayDate}`;
      // Prefer server-side public appointments when available
      const sourceAppointments = publicAppointments ? publicAppointments : appointments;
      const bookedSlots = new Set(
          (sourceAppointments || []).filter(a => a.data === selectedDate && a.status !== 'Cancelado').map(a => a.horario)
      );
      availableTimesGrid.innerHTML = '';
      timeSelect.innerHTML = '<option value="">Selecione um horário</option>';
      AVAILABLE_TIMES.forEach(time => {
          const isBooked = bookedSlots.has(time);
          const [hh, mm] = time.split(':').map(Number);
          const minutes = hh * 60 + mm;
          const isPastToday = isToday && minutes <= nowMinutes; // não permitir horários passados no dia atual
          const unavailable = isBooked || isPastToday;
          const slot = document.createElement('div');
          slot.className = `slot p-2 rounded text-center small ${unavailable ? (isBooked ? 'reserved unavailable' : 'unavailable') : 'free'}`;
          slot.dataset.time = time;
          slot.innerHTML = `<div class="slot-label fw-bold">${time}</div>`;
          availableTimesGrid.appendChild(slot);
          // also populate the select with only free slots
          if (!unavailable) {
              const option = document.createElement('option');
              option.value = time;
              option.textContent = time;
              timeSelect.appendChild(option);
          }
      });
      // Make slots clickable to select time
      availableTimesGrid.querySelectorAll('.slot').forEach(s => s.addEventListener('click', () => {
          const t = s.dataset.time;
          if (s.classList.contains('unavailable')) return; // ignore unavailable
          if (timeSelect.querySelector(`option[value="${t}"]`)) {
              timeSelect.value = t;
              timeSelect.dispatchEvent(new Event('change'));
          }
      }));

            // Ensure legend exists and is visible
            try {
                    const legendHTML = `
                            <div class="d-flex align-items-center gap-3 flex-wrap">
                                <div class="d-inline-flex align-items-center gap-2">
                                    <span class="legend-box" style="display:inline-block;width:18px;height:18px;background:#ffffff;border:1px solid rgba(0,0,0,0.12);border-radius:4px;"></span>
                                    <span>Disponível</span>
                                </div>
                                <div class="d-inline-flex align-items-center gap-2">
                                    <span class="legend-box" style="display:inline-block;width:18px;height:18px;background:#ffedd5;border:2px solid #f97316;border-radius:4px;"></span>
                                    <span>Passado (indisponível)</span>
                                </div>
                                <div class="d-inline-flex align-items-center gap-2">
                                    <span class="legend-box" style="display:inline-block;width:18px;height:18px;background:#fecaca;border:2px solid #ef4444;border-radius:4px;"></span>
                                    <span>Reservado</span>
                                </div>
                            </div>`;
                    const grid = document.getElementById('available-times-grid');
                    if (grid) {
                            let legend = document.getElementById('available-times-legend');
                            if (!legend) {
                                    legend = document.createElement('div');
                                    legend.id = 'available-times-legend';
                                    legend.className = 'mt-3 small';
                                    legend.innerHTML = legendHTML;
                                    grid.insertAdjacentElement('afterend', legend);
                            } else {
                                    legend.innerHTML = legendHTML;
                                    legend.classList.remove('d-none');
                                    legend.style.display = 'block';
                            }
                    }
            } catch { /* noop */ }
  };
  
  const renderAppointmentsTable = () => {
      appointmentsTableBody.innerHTML = '';
      const list = (adminToken && serverAppointments) ? serverAppointments : (publicAppointments ? publicAppointments : appointments);
      if (!list || list.length === 0) {
          appointmentsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">Nenhum agendamento encontrado.</td></tr>';
          return;
      }
      const sortedAppointments = [...list].sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime() || (a.horario||'').localeCompare(b.horario||''));
      sortedAppointments.forEach(app => {
          const service = services.find(s => s.id === app.servicoId);
          const statusColors = {
              Pendente: 'text-warning',
              Confirmado: 'text-primary',
              Cancelado: 'text-danger',
              Concluído: 'text-success fw-bold',
          };
          const row = document.createElement('tr');
          row.innerHTML = `
              <td>${new Date(app.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
              <td>${app.horario}</td>
              <td>${app.nomeCliente}</td>
              <td>${service ? service.nome : 'N/A'}</td>
              <td>${app.observacoes || 'Nenhuma'}</td>
              <td class="${statusColors[app.status] || ''}">${app.status}</td>
              <td>
                  ${(app.comprovanteDataUrl || app.comprovantePath) ? `<button class="btn btn-sm btn-outline-info me-1" data-action="view-proof" data-id="${app.id}">Ver Comprovante</button>` : ''}
                  <div class="d-inline-flex flex-wrap gap-1">
                      <button class="btn btn-sm btn-info" data-action="notify" data-id="${app.id}">Notificar</button>
                      <button class="btn btn-sm ${app.status === 'Concluído' ? 'btn-success' : 'btn-outline-success'}" data-action="complete" data-id="${app.id}">Concluído</button>
                      <button class="btn btn-sm btn-outline-primary" data-action="keep" data-id="${app.id}">Manter</button>
                      <button class="btn btn-sm btn-outline-warning" data-action="pendent" data-id="${app.id}">Pendente</button>
                      <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${app.id}">Excluir</button>
                  </div>
              </td>
          `;
          appointmentsTableBody.appendChild(row);
      });
  };
  
  const renderServicesList = () => {
      servicesList.innerHTML = '';
      services.forEach(s => {
          const listItem = document.createElement('li');
          listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
          listItem.innerHTML = `
              <div>
                  ${s.nome} (${s.duration} min)
                  <small class="d-block text-secondary">R$ ${s.preco.toFixed(2)}</small>
              </div>
              <div>
                  <button class="btn btn-sm btn-outline-primary me-1" data-action="edit-service" data-id="${s.id}">Editar</button>
                  <button class="btn btn-sm btn-outline-danger" data-action="delete-service" data-id="${s.id}">Excluir</button>
              </div>
          `;
          servicesList.appendChild(listItem);
      });
  };
  
  // --- 5. EVENT LISTENERS (INTERAÇÕES DO USUÁRIO) ---

    document.getElementById('select-client-role').addEventListener('click', () => switchView('client'));
    // Quando o usuário clicar em 'Sou Administrador' iremos abrir um modal solicitando a senha
    document.getElementById('select-admin-role').addEventListener('click', () => {
            // mostra o modal de senha (Bootstrap Modal)
            const adminPasswordModalEl = document.getElementById('admin-password-modal');
            const adminPasswordModal = new bootstrap.Modal(adminPasswordModalEl);
            document.getElementById('admin-password-input').value = '';
            document.getElementById('admin-password-feedback').classList.add('d-none');
            adminPasswordModal.show();
    });
  logoutButton.addEventListener('click', () => switchView(null));
  document.getElementById('show-appointments-btn').addEventListener('click', () => renderAdminView('appointments'));
  document.getElementById('show-services-btn').addEventListener('click', () => renderAdminView('services'));
    const showStatsBtn = document.getElementById('show-stats-btn');
    if (showStatsBtn) showStatsBtn.addEventListener('click', () => renderAdminView('stats'));
  datePicker.addEventListener('change', updateAvailableTimes);
  
  [serviceSelect, timeSelect].forEach(el => {
      el.addEventListener('change', () => {
          const serviceId = serviceSelect.value;
          const time = timeSelect.value;
          if (!serviceId || !time) {
              completionTimeAlert.classList.add('d-none');
              return;
          }
          const service = services.find(s => s.id === serviceId);
          const [hours, minutes] = time.split(':').map(Number);
          const totalMinutes = hours * 60 + minutes + service.duration;
          const newHours = Math.floor(totalMinutes / 60) % 24;
          const newMinutes = totalMinutes % 60;
          const completionTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
          completionTimeAlert.textContent = `Previsão de término: ${completionTime}`;
          completionTimeAlert.classList.remove('d-none');
      });
  });

    appointmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
        // block past time submission if selected date is today
        const selectedDate = datePicker.value;
        const now = new Date();
        const tzOffset = now.getTimezoneOffset();
        const todayStr = new Date(now.getTime() - tzOffset * 60000).toISOString().slice(0,10);
        const isToday = selectedDate === todayStr;
        if (isToday) {
            const tVal = document.getElementById('horario').value || '00:00';
            const [hh, mm] = tVal.split(':').map(Number);
            const selectedMinutes = hh * 60 + mm;
            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            if (selectedMinutes <= nowMinutes) {
                showAnnouncement('Não é permitido agendar para um horário já passado de hoje.', 'warning');
                return;
            }
        }
        const comprovanteInput = document.getElementById('comprovante');
        const file = comprovanteInput && comprovanteInput.files && comprovanteInput.files[0];

        const baseData = {
            id: Date.now(),
            nomeCliente: document.getElementById('nomeCliente').value,
            telefoneCliente: document.getElementById('telefoneCliente').value,
            servicoId: document.getElementById('servicoId').value,
            data: datePicker.value,
            horario: document.getElementById('horario').value,
            observacoes: document.getElementById('observacoes').value,
            status: 'Pendente'
        };

        // Always attempt to send to backend first (multipart/form-data). If the server is unavailable, fall back to localStorage.
        const form = new FormData();
        form.append('nomeCliente', baseData.nomeCliente);
        form.append('telefoneCliente', baseData.telefoneCliente);
        form.append('servicoId', baseData.servicoId);
        form.append('data', baseData.data);
        form.append('horario', baseData.horario);
        form.append('observacoes', baseData.observacoes || '');
    if (file) form.append('comprovante', file, file.name);

    const backendUrl = getBackendBase() + '/api/appointments';

        fetch(backendUrl, {
            method: 'POST',
            body: form
        }).then(async res => {
            if (!res.ok) {
                // Prefer JSON { error: 'msg' } but fall back to plain text
                let serverMessage = `Erro ao enviar (HTTP ${res.status})`;
                try {
                    const data = await res.json();
                    if (data && data.error) serverMessage = data.error;
                    else if (typeof data === 'string') serverMessage = data;
                } catch (e) {
                    try {
                        const txt = await res.text();
                        if (txt) serverMessage = txt;
                    } catch (e2) { /* noop */ }
                }
                // Show server-provided message to the user
                showAnnouncement(serverMessage, 'danger');

                // Do NOT fallback to localStorage for client errors (4xx) such as invalid file type or too large.
                if (res.status >= 400 && res.status < 500) {
                    // Keep form as-is so user can correct file/inputs.
                    return null;
                }

                // For server errors (5xx) treat as transient and show error to user.
                throw new Error(serverMessage);
            }
            return res.json();
    }).then(async created => {
            if (!created) return; // handled earlier (client error)
            // Server returns the created appointment metadata (id, comprovantePath, status...)
            // If server returned comprovantePath, normalize to use that; otherwise fallback to data URL
            if (created.comprovantePath) created.comprovantePath = created.comprovantePath.replace(/\\/g, '/');
            // Refresh public appointments from server so availability reflects server state
            await fetchPublicAppointments();
            showAnnouncement(`Agendamento para ${created.nomeCliente} realizado com sucesso (enviado ao servidor).`);
            appointmentForm.reset();
            comprovanteInput.value = '';
            // clear comprovante status UI
            const compStatusEl = document.getElementById('comprovante-status');
            if (compStatusEl) compStatusEl.textContent = '';
            completionTimeAlert.classList.add('d-none');
            updateAvailableTimes();
            renderAppointmentsTable();
        }).catch(async err => {
            // Network/server error: fallback local (modo offline) para não travar o fluxo do usuário
            console.warn('Falha ao enviar para o servidor, aplicando fallback local:', err);
            try {
                const localA = { ...baseData };
                // Se quiser preservar um rastro do arquivo, poderíamos ler como DataURL (cuidado com tamanho)
                // Neste fallback, não vamos armazenar arquivo para evitar exceder memória/localStorage.
                appointments.push(localA);
                showAnnouncement('Sem conexão com o servidor: agendamento salvo localmente (offline).', 'warning');
                appointmentForm.reset();
                if (comprovanteInput) comprovanteInput.value = '';
                const compStatusEl = document.getElementById('comprovante-status');
                if (compStatusEl) compStatusEl.textContent = '';
                completionTimeAlert.classList.add('d-none');
                updateAvailableTimes();
                renderAppointmentsTable();
            } catch (e) {
                showAnnouncement(`Erro ao conectar ao servidor: ${err.message || 'Tente novamente mais tarde.'}`, 'danger');
            }
        });
  });

  // show selected file name and basic status next to the file input
  const comprovanteInputEl = document.getElementById('comprovante');
  if (comprovanteInputEl) {
      comprovanteInputEl.addEventListener('change', () => {
          const statusEl = document.getElementById('comprovante-status');
          const f = comprovanteInputEl.files && comprovanteInputEl.files[0];
          if (!statusEl) return;
          if (f) {
              if (!/\.pdf$/i.test(f.name)) {
                  statusEl.textContent = 'Apenas PDF é permitido.';
                  comprovanteInputEl.value = '';
                  return;
              }
              statusEl.textContent = `${f.name} — PDF selecionado`;
          } else {
              statusEl.textContent = '';
          }
      });
  }

  // Set date-picker min to today to avoid selecting past dates
  (function ensureMinDate() {
      if (!datePicker) return;
      try {
          const now = new Date();
          const tzOffset = now.getTimezoneOffset();
          const todayStr = new Date(now.getTime() - tzOffset * 60000).toISOString().slice(0,10);
          datePicker.setAttribute('min', todayStr);
          if (!datePicker.value) datePicker.value = todayStr;
      } catch {}
  })();
  
  appointmentsTableBody.addEventListener('click', async (e) => {
      const target = e.target;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action) return;
    const list = (adminToken && serverAppointments) ? serverAppointments : (publicAppointments ? publicAppointments : appointments);
      const app = list.find(a => String(a.id) === String(id));

    if (action === 'view-proof') {
          // Prefer direct uploads static URL when available (convenience), then try protected endpoint, then fallback to data URL.
          const backend = getBackendBase();
          if (app && app.comprovantePath) {
              // try opening /uploads/<path> first
              try {
                  const rawUrl = `${backend.replace(/\/$/, '')}/${app.comprovantePath.replace(/^\//, '')}`;
                  // open in new tab (may be blocked by popup blockers if not user-initiated, but this is a click handler so should be OK)
                  window.open(rawUrl, '_blank');
                  return;
              } catch (e) {
                  // fallthrough to protected fetch
              }
          }
          if (adminToken && app && app.comprovantePath) {
              try {
                  const res = await fetch(`${backend}/api/appointments/${id}/comprovante`, { headers: { Authorization: `Bearer ${adminToken}` } });
                  if (!res.ok) { showAnnouncement('Falha ao baixar comprovante.','danger'); return; }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                  setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  return;
              } catch (err) {
                  showAnnouncement('Erro ao baixar comprovante.','danger');
              }
          }
          if (app && app.comprovanteDataUrl) {
              window.open(app.comprovanteDataUrl, '_blank');
          } else {
              showAnnouncement('Não há comprovante disponível para este agendamento.','warning');
          }
    } else if (action === 'notify') {
          // Guarda o agendamento atual e prepara a mensagem padrão
          currentNotificationAppointment = app;
        // Preenche os dados no modal e define defaults
          whatsAppClientName.textContent = app.nomeCliente;
        if (whatsAppTemplateSel) whatsAppTemplateSel.value = 'conclusao';
        if (whatsAppIncludePrice) whatsAppIncludePrice.checked = true;
        if (whatsAppIncludeReview) whatsAppIncludeReview.checked = true;
        if (whatsAppIncludeLocation) whatsAppIncludeLocation.checked = false;
        // Render preview based on controls
        refreshWhatsappPreview();
          whatsAppModal.show();

      } else if (action === 'complete') {
          // Marcar como Concluído
          if (!adminToken) { showAnnouncement('Ação disponível apenas para administradores. Faça login.','warning'); return; }
          try {
              const backend = getBackendBase();
              const res = await fetch(`${backend}/api/appointments/${id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
              if (!res.ok) { showAnnouncement('Falha ao marcar como Concluído.','danger'); return; }
              showAnnouncement('Status alterado para Concluído.');
              await fetchAdminAppointments();
          } catch (err) {
              showAnnouncement('Erro ao comunicar com o servidor.','danger');
          }
          
      } else if (action === 'keep') {
          // Confirmar e abrir WhatsApp com mensagem de confirmação
          if (!adminToken) { showAnnouncement('Ação disponível apenas para administradores. Faça login.','warning'); return; }
          try {
              const backend = getBackendBase();
              const res = await fetch(`${backend}/api/appointments/${id}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
              if (!res.ok) { showAnnouncement('Falha ao confirmar agendamento.','danger'); return; }
              showAnnouncement('Agendamento confirmado no servidor.');
              await fetchAdminAppointments();
              // Abrir o modal do WhatsApp já no modelo de confirmação
              const confirmed = (adminToken && serverAppointments) ? serverAppointments.find(a => String(a.id) === String(id)) : app;
              currentNotificationAppointment = confirmed || app;
              if (whatsAppTemplateSel) whatsAppTemplateSel.value = 'confirmacao';
              if (whatsAppIncludePrice) whatsAppIncludePrice.checked = true;
              if (whatsAppIncludeReview) whatsAppIncludeReview.checked = true;
              if (whatsAppIncludeLocation) whatsAppIncludeLocation.checked = false;
              if (whatsAppClientName) whatsAppClientName.textContent = currentNotificationAppointment.nomeCliente || '';
              refreshWhatsappPreview();
              whatsAppModal.show();
          } catch (err) {
              showAnnouncement('Erro ao confirmar agendamento.','danger');
          }
      } else if (action === 'pendent') {
          // Setting to 'Pendente' requires admin privileges
          if (!adminToken) { showAnnouncement('Ação disponível apenas para administradores. Faça login.','warning'); return; }
          showAnnouncement('Para marcar como Pendente, use o painel do administrador.');
      } else if (action === 'delete') {
          if (confirm(`Tem certeza que deseja excluir o agendamento de ${app.nomeCliente}?`)) {
              if (adminToken) {
                  try {
                      const backend = getBackendBase();
                      const res = await fetch(`${backend}/api/appointments/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
                      if (!res.ok) { showAnnouncement('Falha ao excluir agendamento no servidor.','danger'); return; }
                      showAnnouncement('Agendamento excluído no servidor.','success');
                      await fetchAdminAppointments();
                  } catch (err) {
                      showAnnouncement('Erro ao excluir agendamento.','danger');
                  }
              } else {
                  showAnnouncement('Ação disponível apenas para administradores. Faça login.','warning');
                  return;
              }
          }
      }
      saveData();
      renderAppointmentsTable();
      try { renderClientAppointments(); } catch(e) { /* ignored (function removed earlier) */ }
  });
  
  /**
   * Event listener para o botão de enviar no modal do WhatsApp.
   */
  sendWhatsAppBtn.addEventListener('click', () => {
      if (!currentNotificationAppointment) return;

      const message = whatsAppMessageTextarea.value || buildWhatsappMessage(currentNotificationAppointment);
      const phone = currentNotificationAppointment.telefoneCliente.replace(/\D/g, '');
      
      // Abre o WhatsApp em uma nova aba com a mensagem preenchida
      const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      
      // Esconde o modal e limpa a referência do agendamento
      whatsAppModal.hide();
      currentNotificationAppointment = null;
  });

    // Update preview when controls change
    if (whatsAppTemplateSel) whatsAppTemplateSel.addEventListener('change', refreshWhatsappPreview);
    if (whatsAppIncludePrice) whatsAppIncludePrice.addEventListener('change', refreshWhatsappPreview);
    if (whatsAppIncludeReview) whatsAppIncludeReview.addEventListener('change', refreshWhatsappPreview);
    if (whatsAppIncludeLocation) whatsAppIncludeLocation.addEventListener('change', refreshWhatsappPreview);

  servicesList.addEventListener('click', (e) => {
      const target = e.target;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action) return;
      const service = services.find(s => s.id === id);
      
      if (action === 'edit-service') {
          document.getElementById('service-id-hidden').value = service.id;
          document.getElementById('serviceName').value = service.nome;
          document.getElementById('servicePrice').value = service.preco.toString();
          document.getElementById('serviceDuration').value = service.duration.toString();
          document.getElementById('service-form-title').textContent = 'Editar Serviço';
          document.getElementById('service-form-submit-btn').textContent = 'Salvar';
          document.getElementById('service-form-cancel-btn').classList.remove('d-none');
      } else if (action === 'delete-service') {
          if (confirm(`Tem certeza que deseja excluir o serviço "${service.nome}"?`)) {
              services = services.filter(s => s.id !== id);
              saveData();
              showAnnouncement(`Serviço "${service.nome}" excluído.`, 'danger');
              renderAdminView('services');
          }
      }
  });

    // --- Estatísticas (admin) ---
    const statsSection = document.getElementById('admin-stats-section');
    const statsRange = document.getElementById('stats-range');
    const statsDate = document.getElementById('stats-date');
    const statsRefresh = document.getElementById('stats-refresh');
    const statsChartEl = document.getElementById('stats-chart');
    const statsWeatherEl = document.getElementById('stats-weather');
    let statsChart = null;

    // Ensure default date
    if (statsDate) statsDate.value = getTodayString();

    // Restore last used CEP from localStorage
    const STATS_LAST_CEP_KEY = 'statsLastCep_v1';
    try {
        const lastCep = localStorage.getItem(STATS_LAST_CEP_KEY);
        const cepInputEl = document.getElementById('stats-cep');
        if (lastCep && cepInputEl) cepInputEl.value = lastCep;
    } catch (e) { /* ignore */ }

    // Initialize stats view: load Chart.js if needed and draw
    async function initializeStats() {
        // load Chart.js from CDN if not present
        if (typeof Chart === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
        }
        await renderStats();
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // Aggregate appointments for the given range and reference date
        function aggregateAppointments(range, referenceDateStr, sourceAppointments) {
            const ref = new Date(referenceDateStr + 'T00:00:00');
        const map = new Map();
        const revenueMap = new Map();
        const labels = [];

        // Helper to push label and init maps
        const pushLabel = (label) => { labels.push(label); map.set(label, 0); revenueMap.set(label, 0); };

            if (range === 'day') {
            const dayLabel = ref.toLocaleDateString('pt-BR');
            pushLabel(dayLabel);
                (sourceAppointments || []).forEach(a => {
                    if (a.data === referenceDateStr && a.status !== 'Cancelado') {
                        map.set(dayLabel, map.get(dayLabel) + 1);
                        const price = (services.find(s => s.id === a.servicoId)?.preco) || 0;
                        revenueMap.set(dayLabel, revenueMap.get(dayLabel) + price);
                    }
                });
        } else if (range === 'week') {
            // compute week start (Monday) and labels for 7 days
            const start = new Date(ref);
            const day = start.getDay();
            const diff = (day + 6) % 7; // make Monday = 0
            start.setDate(start.getDate() - diff);
            for (let i = 0; i < 7; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const label = d.toLocaleDateString('pt-BR');
                pushLabel(label);
            }
                    (sourceAppointments || []).forEach(a => {
                        if (a.status === 'Cancelado') return;
                        const idx = labels.indexOf(new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR'));
                        if (idx >= 0) {
                            const l = labels[idx];
                            map.set(l, map.get(l) + 1);
                            const price = (services.find(s => s.id === a.servicoId)?.preco) || 0;
                            revenueMap.set(l, revenueMap.get(l) + price);
                        }
                    });
        } else if (range === 'month') {
            const year = ref.getFullYear();
            const month = ref.getMonth();
            const days = new Date(year, month + 1, 0).getDate();
            for (let d = 1; d <= days; d++) {
                const date = new Date(year, month, d);
                const label = date.toLocaleDateString('pt-BR');
                pushLabel(label);
            }
                    (sourceAppointments || []).forEach(a => {
                        if (a.status === 'Cancelado') return;
                        const idx = labels.indexOf(new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR'));
                        if (idx >= 0) {
                            const l = labels[idx];
                            map.set(l, map.get(l) + 1);
                            const price = (services.find(s => s.id === a.servicoId)?.preco) || 0;
                            revenueMap.set(l, revenueMap.get(l) + price);
                        }
                    });
        } else if (range === 'year') {
            const year = ref.getFullYear();
            for (let m = 0; m < 12; m++) {
                const d = new Date(year, m, 1);
                const label = d.toLocaleString('pt-BR', { month: 'short' });
                pushLabel(label);
            }
                    (sourceAppointments || []).forEach(a => {
                        if (a.status === 'Cancelado') return;
                        const dt = new Date(a.data + 'T00:00:00');
                        if (dt.getFullYear() === year) {
                            const label = new Date(dt.getFullYear(), dt.getMonth(), 1).toLocaleString('pt-BR', { month: 'short' });
                            map.set(label, (map.get(label) || 0) + 1);
                            const price = (services.find(s => s.id === a.servicoId)?.preco) || 0;
                            revenueMap.set(label, (revenueMap.get(label) || 0) + price);
                        }
                    });
        }

        return { labels, counts: labels.map(l => map.get(l) || 0), revenue: labels.map(l => revenueMap.get(l) || 0) };
    }

    // Resolve CEP (Brazil postal code) to latitude/longitude using ViaCEP
    async function resolveCepToLatLon(cep) {
        if (!cep) return null;
        // normalize: remove non-digits
        const cleaned = (cep || '').toString().replace(/\D/g, '');
        if (cleaned.length < 8) return null;
        try {
            const url = `https://viacep.com.br/ws/${cleaned}/json/`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const j = await res.json();
            if (j.erro) return null;
            // ViaCEP returns logradouro, bairro, localidade and uf. Build richer candidate queries (most specific first)
            const candidatesSet = new Set();
            const logradouro = (j.logradouro || '').trim();
            const bairro = (j.bairro || '').trim();
            const localidade = (j.localidade || '').trim();
            const uf = (j.uf || '').trim();
            // Full address variants
            if (logradouro && bairro && localidade && uf) candidatesSet.add(`${logradouro} ${bairro} ${localidade} ${uf}`);
            if (logradouro && localidade && uf) candidatesSet.add(`${logradouro} ${localidade} ${uf}`);
            if (bairro && localidade && uf) candidatesSet.add(`${bairro} ${localidade} ${uf}`);
            if (logradouro && uf) candidatesSet.add(`${logradouro} ${uf}`);
            if (localidade && uf) candidatesSet.add(`${localidade} ${uf}`);
            // Try with Brasil appended for broader geocoding
            if (localidade && uf) candidatesSet.add(`${localidade} ${uf} Brasil`);
            if (logradouro && bairro && localidade && uf) candidatesSet.add(`${logradouro} ${bairro} ${localidade} ${uf} Brasil`);
            // Try CEP itself
            candidatesSet.add(cleaned);
            // Turn into array and keep order
            const candidates = Array.from(candidatesSet);
            for (const cand of candidates) {
                const q = encodeURIComponent(cand);
                const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=pt`;
                try {
                    const gres = await fetch(geoUrl);
                    if (!gres.ok) continue;
                    const gj = await gres.json();
                    if (gj.results && gj.results.length > 0) {
                        const r = gj.results[0];
                        return { lat: r.latitude, lon: r.longitude };
                    }
                } catch (e) {
                    // try next candidate
                }
            }
            // nothing matched in Open-Meteo geocoding — try Nominatim (OpenStreetMap) as a fallback
            try {
                const nomq = encodeURIComponent(`${j.localidade || ''} ${j.uf || ''} Brasil`.trim());
                const nomUrl = `https://nominatim.openstreetmap.org/search.php?q=${nomq}&format=jsonv2&limit=1`;
                const nres = await fetch(nomUrl, { headers: { 'User-Agent': 'LavaRapido-App/1.0 (+https://example.local)' } });
                if (nres.ok) {
                    const nj = await nres.json();
                    if (nj && nj.length > 0 && nj[0].lat && nj[0].lon) {
                        return { lat: parseFloat(nj[0].lat), lon: parseFloat(nj[0].lon) };
                    }
                }
            } catch (e) {
                // ignore
            }
            // nothing matched
            return null;
        } catch (e) {
            return null;
        }
    }

    // Simple CEP cache helpers (localStorage)
    const CEP_CACHE_KEY = 'cepCache_v1';
    const readCepCache = () => {
        try { return JSON.parse(localStorage.getItem(CEP_CACHE_KEY) || '{}'); } catch (e) { return {}; }
    };
    const writeCepCache = (c) => { try { localStorage.setItem(CEP_CACHE_KEY, JSON.stringify(c)); } catch (e) {} };

    // SVG icons used in the stats view (small, inline)
    const ICON_SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4" fill="#FFD54A"/><g stroke="#FFD54A" stroke-width="1.2" stroke-linecap="round"><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/></g></svg>';
    const ICON_CLOUD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 17.58A5.59 5.59 0 0 0 14.42 12H13a4 4 0 1 0-7.9 1.56A4 4 0 0 0 6 20h14a0 0 0 0 0 0-2.42z" fill="#B0BEC5"/></svg>';
    const ICON_RAIN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 17.58A5.59 5.59 0 0 0 14.42 12H13a4 4 0 1 0-7.9 1.56A4 4 0 0 0 6 20h14a0 0 0 0 0 0-2.42z" fill="#90A4AE"/><g stroke="#4FC3F7" stroke-linecap="round" stroke-width="1.5"><path d="M8 21l0-3"/><path d="M12 21l0-3"/><path d="M16 21l0-3"/></g></svg>';

    // Fetch weather from the server-side Visual Crossing proxy
    async function fetchVisualWeather(lat, lon, startDate, endDate) {
        try {
            const backend = getBackendBase();
            const url = new URL(`${backend}/api/visual-weather`);
            url.searchParams.set('lat', lat);
            url.searchParams.set('lon', lon);
            if (startDate) url.searchParams.set('start', startDate);
            if (endDate) url.searchParams.set('end', endDate);
            const res = await fetch(url.toString());
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { console.warn('visual weather fetch failed', e); return null; }
    }

    // --- Weather client-side cache (localStorage) ---
    const WEATHER_CACHE_KEY = 'weatherCache_v1';
    const WEATHER_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    const readWeatherCache = () => { try { return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || '{}'); } catch (e) { return {}; } };
    const writeWeatherCache = (c) => { try { localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(c)); } catch (e) {} };

    // Helper to fetch and cache a Visual Crossing (or fallback) timeline for a small range
    async function fetchTwoDayWeatherCached(lat, lon) {
        const start = getTodayString();
        const tomorrow = (() => { const d = new Date(start + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
        const key = `${lat.toFixed(4)},${lon.toFixed(4)},${start},${tomorrow}`;
        const cache = readWeatherCache();
        const now = Date.now();
        if (cache[key] && (now - (cache[key].ts || 0) < WEATHER_CACHE_TTL)) return cache[key].data;
        // try Visual Crossing proxy first
        let data = null;
        try {
            const vc = await fetchVisualWeather(lat, lon, start, tomorrow);
            if (vc && vc.days) data = vc;
        } catch (e) { /* ignore */ }
        if (!data) {
            // fallback to open-meteo summary (we'll massage it into same shape)
            const om = await fetchWeatherSummary(start, tomorrow, lat, lon);
            if (om && om.length) {
                data = { lat, lon, days: om.map(d => ({ date: d.date, conditionSimple: d.label, temp: d.temp || d.tempmax || null })) };
            }
        }
        cache[key] = { ts: now, data };
        writeWeatherCache(cache);
        return data;
    }

    // Render two small cards in header for today and tomorrow
    async function renderHomeTwoDayForecast(lat = -23.55, lon = -46.63) {
        try {
            const cardsContainer = document.getElementById('home-weather-cards');
            const todayEl = document.getElementById('weather-card-today');
            const tomorrowEl = document.getElementById('weather-card-tomorrow');
            if (todayEl) todayEl.innerHTML = '<div class="title">Hoje</div><div class="cond">Carregando...</div>';
            if (tomorrowEl) tomorrowEl.innerHTML = '<div class="title">Amanhã</div><div class="cond">Carregando...</div>';

            const data = await fetchTwoDayWeatherCached(lat, lon);
            if (!data || !data.days || data.days.length === 0) {
                if (todayEl) todayEl.innerHTML = '<div class="title">Hoje</div><div class="cond">Indisponível</div>';
                if (tomorrowEl) tomorrowEl.innerHTML = '<div class="title">Amanhã</div><div class="cond">Indisponível</div>';
                return;
            }
            // find today and tomorrow in returned days
            const todayISO = getTodayString();
            const tomorrowISO = (() => { const d = new Date(todayISO + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
            const dayMap = {}; data.days.forEach(d => { dayMap[d.date] = d; });
            const t0 = dayMap[todayISO] || data.days[0];
            const t1 = dayMap[tomorrowISO] || data.days[1] || null;

            const renderCard = (el, day, label) => {
                if (!el) return;
                if (!day) { el.innerHTML = `<div class="title">${label}</div><div class="cond">Indisponível</div>`; return; }
                const cond = day.conditionSimple || day.label || (day.conditions || '') || 'Indeterminado';
                const temp = Math.round(day.temp || day.tempmax || 0);
                const icon = (cond === 'Ensolarado') ? ICON_SUN : (cond === 'Nublado' ? ICON_CLOUD : (cond === 'Chuvoso' ? ICON_RAIN : ''));
                el.innerHTML = `
                    <div class="title">${label}</div>
                    <div class="d-flex align-items-center gap-2 mt-1">
                        <div class="icon">${icon}</div>
                        <div>
                            <div class="temp">${temp}°C</div>
                            <div class="cond">${cond}</div>
                        </div>
                    </div>
                `;
                el.setAttribute('title', `${label}: ${cond} — ${temp}°C`);
            };

            renderCard(todayEl, t0, 'Hoje');
            renderCard(tomorrowEl, t1, 'Amanhã');
        } catch (e) {
            console.warn('Failed to render home forecast', e);
        }
    }


    // Fetch simple weather summary via Open-Meteo (no key required)
    async function fetchWeatherSummary(startDate, endDate, lat = -23.55, lon = -46.63) {
        // Open-Meteo daily summary for weathercode
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=weathercode&timezone=auto`;
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const j = await res.json();
            // map weather codes to simple labels and icons
            const codeToLabelAndIcon = (c) => {
                // 0 = clear sky, 1-3 mainly clear/partly cloudy/overcast, 51+ light-moderate precipitation
                if (c === 0) return { label: 'Ensolarado', icon: '☀️' };
                if ([1,2,3].includes(c)) return { label: 'Nublado', icon: '☁️' };
                if (c >= 51) return { label: 'Chuvoso', icon: '🌧️' };
                return { label: 'Indeterminado', icon: '❓' };
            };
            const days = (j.daily && j.daily.time) || [];
            const codes = (j.daily && j.daily.weathercode) || [];
            return days.map((d, i) => ({ date: d, ...codeToLabelAndIcon(codes[i] || -1) }));
        } catch (e) {
            return null;
        }
    }

    async function renderStats() {
        const range = statsRange.value || 'month';
        const refDate = statsDate.value || getTodayString();
            // prefer serverAppointments when available (admin)
            const sourceAppointments = (adminToken && serverAppointments) ? serverAppointments : appointments;
            const data = aggregateAppointments(range, refDate, sourceAppointments);

        // destroy previous chart if exists
        if (statsChart) { statsChart.destroy(); statsChart = null; }

        // prepare datasets: counts and revenue
        const ctx = statsChartEl.getContext('2d');
            statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    { label: 'Veículos lavados', data: data.counts, backgroundColor: 'rgba(6,182,212,0.7)', yAxisID: 'y' },
                    { label: 'Faturamento (R$)', data: data.revenue, type: 'line', borderColor: 'rgba(16,185,129,0.9)', backgroundColor: 'rgba(16,185,129,0.3)', yAxisID: 'y1' }
                ]
            },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        tooltip: { mode: 'index', intersect: false },
                        legend: { position: 'top' }
                    },
                    scales: {
                        x: { ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 20 } },
                        y: { type: 'linear', position: 'left', title: { display: true, text: 'Veículos' } },
                        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'R$' } }
                    }
                }
        });

        // fetch weather for date range (simple bounding: use first and last label dates when possible)
        // Open-Meteo expects dates in YYYY-MM-DD. Our labels are localized (pt-BR) so convert when needed.
        let start = refDate, end = refDate;
        if (data.labels && data.labels.length > 1) {
            const toISO = (lbl) => {
                if (!lbl) return refDate;
                // most labels are in 'dd/mm/yyyy'
                const parts = lbl.split('/');
                if (parts.length === 3) {
                    const [d, m, y] = parts;
                    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
                // fallback to Date parse
                const dt = new Date(lbl + 'T00:00:00');
                return isNaN(dt.getTime()) ? refDate : dt.toISOString().split('T')[0];
            };
            // For most ranges, convert the first/last label to ISO dates.
            // Special-case the 'year' range because labels are month names (e.g., 'jan', 'fev')
            if (range === 'year') {
                // Use the reference date's year and query the full year
                const year = new Date(refDate + 'T00:00:00').getFullYear();
                start = `${year}-01-01`;
                end = `${year}-12-31`;
            } else {
                start = toISO(data.labels[0]);
                end = toISO(data.labels[data.labels.length - 1]);
            }
        }
        // resolve CEP input to lat/lon if provided
        // resolve CEP input to lat/lon if provided, using cache when possible
        const cepInput = document.getElementById('stats-cep');
        const cepFeedback = document.getElementById('stats-cep-feedback');
        let lat = -23.55, lon = -46.63; // default São Paulo
        if (cepFeedback) { cepFeedback.classList.add('d-none'); cepFeedback.textContent = ''; }
        if (cepInput && cepInput.value) {
            const cleanedCep = (cepInput.value || '').toString().replace(/\D/g, '');
            const cache = readCepCache();
            if (cache[cleanedCep]) {
                lat = cache[cleanedCep].lat; lon = cache[cleanedCep].lon;
            } else {
                const resolved = await resolveCepToLatLon(cepInput.value);
                if (resolved) {
                    lat = resolved.lat; lon = resolved.lon;
                    cache[cleanedCep] = { lat, lon, ts: Date.now() };
                    writeCepCache(cache);
                } else {
                    if (cepFeedback) { cepFeedback.classList.remove('d-none'); cepFeedback.textContent = 'Não foi possível resolver este CEP para coordenadas. Usando local padrão.'; }
                }
            }
        }
        let weather = null;
        try {
            // Prefer Visual Crossing proxy if available
            const vc = await fetchVisualWeather(lat, lon, start, end);
            if (vc && vc.days) {
                // Visual Crossing: render a visual strip of day icons + localized labels
                const stripEl = document.getElementById('stats-weather-strip');
                const legendEl = document.getElementById('stats-weather-legend');
                const infoEl = document.getElementById('stats-weather');
                if (stripEl) stripEl.innerHTML = '';
                if (legendEl) legendEl.innerHTML = 'Legenda:';

                vc.days.forEach(w => {
                    const d = new Date(w.date + 'T00:00:00');
                    const lbl = isNaN(d.getTime()) ? w.date : d.toLocaleDateString('pt-BR');
                    const condition = w.conditionSimple || '';
                    const iconSvg = (condition === 'Ensolarado') ? ICON_SUN : (condition === 'Nublado' ? ICON_CLOUD : (condition === 'Chuvoso' ? ICON_RAIN : ''));
                    if (stripEl) {
                        const dayDiv = document.createElement('div');
                        dayDiv.className = 'day-icon';
                        dayDiv.setAttribute('role', 'img');
                        dayDiv.setAttribute('aria-label', `${lbl}: ${condition}`);
                        dayDiv.title = `${lbl}: ${w.conditions || condition} ${w.precipprob ? `(${w.precipprob}% precip)` : ''}`;
                        dayDiv.innerHTML = `${iconSvg}<div class="label">${lbl}</div>`;
                        stripEl.appendChild(dayDiv);
                    }
                });

                // populate legend
                if (legendEl) {
                    legendEl.innerHTML = '';
                    const makeSpan = (icon, text) => {
                        const sp = document.createElement('span');
                        sp.innerHTML = `${icon}<strong style="margin-left:6px;">${text}</strong>`;
                        return sp;
                    };
                    legendEl.appendChild(makeSpan(ICON_SUN, 'Ensolarado'));
                    legendEl.appendChild(makeSpan(ICON_CLOUD, 'Nublado'));
                    legendEl.appendChild(makeSpan(ICON_RAIN, 'Chuvoso'));
                }

                if (infoEl) infoEl.textContent = 'Previsão meteorológica (Visual Crossing).';
                weather = vc.days;
            } else {
                // Fallback to Open-Meteo: use same strip rendering but normalize fields
                const days = await fetchWeatherSummary(start, end, lat, lon);
                const stripEl = document.getElementById('stats-weather-strip');
                const legendEl = document.getElementById('stats-weather-legend');
                const infoEl = document.getElementById('stats-weather');
                if (stripEl) stripEl.innerHTML = '';
                if (legendEl) legendEl.innerHTML = 'Legenda:';

                if (days && days.length) {
                    days.forEach(w => {
                        const d = new Date(w.date + 'T00:00:00');
                        const lbl = isNaN(d.getTime()) ? w.date : d.toLocaleDateString('pt-BR');
                        const condition = w.conditionSimple || w.label || '';
                        const iconSvg = (condition === 'Ensolarado') ? ICON_SUN : (condition === 'Nublado' ? ICON_CLOUD : (condition === 'Chuvoso' ? ICON_RAIN : ''));
                        if (stripEl) {
                            const dayDiv = document.createElement('div');
                            dayDiv.className = 'day-icon';
                            dayDiv.setAttribute('role', 'img');
                            dayDiv.setAttribute('aria-label', `${lbl}: ${condition}`);
                            dayDiv.title = `${lbl}: ${condition}`;
                            dayDiv.innerHTML = `${iconSvg}<div class="label">${lbl}</div>`;
                            stripEl.appendChild(dayDiv);
                        }
                    });
                    // legend
                    if (legendEl) {
                        legendEl.innerHTML = '';
                        const makeSpan = (icon, text) => {
                            const sp = document.createElement('span');
                            sp.innerHTML = `${icon}<strong style="margin-left:6px;">${text}</strong>`;
                            return sp;
                        };
                        legendEl.appendChild(makeSpan(ICON_SUN, 'Ensolarado'));
                        legendEl.appendChild(makeSpan(ICON_CLOUD, 'Nublado'));
                        legendEl.appendChild(makeSpan(ICON_RAIN, 'Chuvoso'));
                    }
                    if (infoEl) infoEl.textContent = 'Previsão meteorológica.';
                    weather = days;
                } else {
                    const attempted = `Coordenadas tentadas: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                    const cepMsg = (cepFeedback && !cepFeedback.classList.contains('d-none')) ? (' / ' + (cepFeedback.textContent || '').trim()) : '';
                    const infoEl = document.getElementById('stats-weather');
                    if (infoEl) infoEl.textContent = `Dados meteorológicos indisponíveis. ${attempted}${cepMsg}`;
                    console.debug('Weather unavailable for', { start, end, lat, lon, cepFeedback: cepFeedback && cepFeedback.textContent });
                }
            }
        } catch (err) {
            console.error('Erro ao buscar weather:', err);
        }

        // Compute and display percentage breakdown for weather conditions in the stats view
        try {
            if (weather && weather.length) {
                const totalDays = weather.length;
                const counts = { Ensolarado: 0, Nublado: 0, Chuvoso: 0, Indeterminado: 0 };
                weather.forEach(d => {
                    const raw = (d.conditionSimple || d.label || d.conditions || '').toString().toLowerCase();
                    if (raw.includes('ensolar') || raw.includes('sun') || raw.includes('clear')) counts.Ensolarado++;
                    else if (raw.includes('nublado') || raw.includes('cloud')) counts.Nublado++;
                    else if (raw.includes('chuv') || raw.includes('rain') || raw.includes('storm') || raw.includes('showers')) counts.Chuvoso++;
                    else counts.Indeterminado++;
                });
                const percent = (n) => (totalDays === 0 ? 0 : Math.round((n * 1000) / totalDays) / 10); // one decimal
                // build HTML summary
                const parts = [];
                parts.push(`<div class="me-3">${ICON_SUN} <strong>Ensolarado</strong> ${percent(counts.Ensolarado)}% (${counts.Ensolarado}/${totalDays})</div>`);
                parts.push(`<div class="me-3">${ICON_CLOUD} <strong>Nublado</strong> ${percent(counts.Nublado)}% (${counts.Nublado}/${totalDays})</div>`);
                parts.push(`<div class="me-3">${ICON_RAIN} <strong>Chuvoso</strong> ${percent(counts.Chuvoso)}% (${counts.Chuvoso}/${totalDays})</div>`);
                if (counts.Indeterminado > 0) parts.push(`<div class="me-3">❓ <strong>Indeterminado</strong> ${percent(counts.Indeterminado)}% (${counts.Indeterminado}/${totalDays})</div>`);
                if (statsWeatherEl) statsWeatherEl.innerHTML = `<div class="small text-secondary">Distribuição meteorológica (${totalDays} dias):</div><div class="mt-1 d-flex flex-wrap gap-2">${parts.join('')}</div>`;
            }
        } catch (e) {
            console.warn('Failed to compute weather percentages', e);
        }

        // If we have Visual Crossing data, also populate the home header with today's weather
        try {
            const homeEl = document.getElementById('home-weather');
            if (homeEl && weather && weather.length) {
                // find today's date
                const todayISO = getTodayString();
                const today = weather.find(d => d.date === todayISO) || weather[0];
                if (today) {
                    const iconSvg = (today.conditionSimple === 'Ensolarado') ? ICON_SUN : (today.conditionSimple === 'Nublado' ? ICON_CLOUD : (today.conditionSimple === 'Chuvoso' ? ICON_RAIN : ''));
                    homeEl.innerHTML = `${iconSvg} <strong style="vertical-align:middle;">${today.conditionSimple}</strong> — ${Math.round(today.temp || today.tempmax || 0)}°C`;
                }
            }
        } catch (e) { /* ignore */ }
    }

    // (debugResolveCep removed) — production build: no debug button wired

    // wire refresh
        if (statsRefresh) statsRefresh.addEventListener('click', async () => {
            // save CEP when user refreshes stats
            try { const cepEl = document.getElementById('stats-cep'); if (cepEl && cepEl.value) localStorage.setItem(STATS_LAST_CEP_KEY, cepEl.value); } catch (e) {}
            await renderStats();
        });
        // save last CEP on change
        const cepInputEl = document.getElementById('stats-cep');
        if (cepInputEl) cepInputEl.addEventListener('change', () => { try { localStorage.setItem(STATS_LAST_CEP_KEY, cepInputEl.value); } catch (e) {} });
        // CSV export
        const statsExportBtn = document.getElementById('stats-export');
        if (statsExportBtn) statsExportBtn.addEventListener('click', () => {
            if (!statsChart) return showAnnouncement('Gere o gráfico antes de exportar.','warning');
            const labels = statsChart.data.labels;
            const counts = statsChart.data.datasets[0].data;
            const revenue = statsChart.data.datasets[1].data;
            let csv = 'label,veiculos,faturamento\n';
            for (let i=0;i<labels.length;i++) csv += `${labels[i]},${counts[i]||0},${revenue[i]||0}\n`;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'estatisticas.csv'; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(()=>URL.revokeObjectURL(url), 1000);
        });

  
  serviceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('service-id-hidden').value;
      const serviceData = {
          nome: document.getElementById('serviceName').value,
          preco: parseFloat(document.getElementById('servicePrice').value),
          duration: parseInt(document.getElementById('serviceDuration').value)
      };
      
      if (id) { // Editando
          const index = services.findIndex(s => s.id === id);
          services[index] = { ...services[index], ...serviceData };
          showAnnouncement(`Serviço "${serviceData.nome}" atualizado.`);
      } else { // Adicionando
          const newService = {
              ...serviceData,
              id: serviceData.nome.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
          };
          services.push(newService);
          showAnnouncement(`Serviço "${serviceData.nome}" adicionado.`);
      }
      
      saveData();
      serviceForm.reset();
      document.getElementById('service-id-hidden').value = '';
      document.getElementById('service-form-title').textContent = 'Adicionar Novo Serviço';
      document.getElementById('service-form-submit-btn').textContent = 'Adicionar';
      document.getElementById('service-form-cancel-btn').classList.add('d-none');
      renderAdminView('services');
  });
  
  document.getElementById('service-form-cancel-btn').addEventListener('click', () => {
      serviceForm.reset();
      document.getElementById('service-id-hidden').value = '';
      document.getElementById('service-form-title').textContent = 'Adicionar Novo Serviço';
      document.getElementById('service-form-submit-btn').textContent = 'Adicionar';
      document.getElementById('service-form-cancel-btn').classList.add('d-none');
  });
  

  // --- 6. INICIALIZAÇÃO DA APLICAÇÃO ---
  datePicker.value = getTodayString();
  datePicker.min = getTodayString();
  switchView(null); // Começa na tela de seleção de perfil

  // --- 7. LÓGICA DE AUTENTICAÇÃO SIMPLES (SENHA ADMIN LOCAL) ---
  // Nota: a senha é verificada localmente usando hash; isso é suficiente para uso local, mas
  // não é seguro para produção porque o hash e a lógica ficam no cliente.

  // Hash SHA-256 da senha 'admin@2025' gerado durante a sessão de desenvolvimento
  const ADMIN_PASSWORD_HASH = 'e7ec9cbf3dc1a42562a5e500d5768001933624ea8d8f3ea0602092c42d4bc857';

  // Calcula SHA-256 de uma string no browser e retorna hex string
  const sha256Hex = async (str) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

    // Evento do botão de submissão do modal de senha
    document.getElementById('admin-password-submit').addEventListener('click', async () => {
            const input = document.getElementById('admin-password-input').value || '';
            const feedback = document.getElementById('admin-password-feedback');
            feedback.classList.add('d-none');
            const adminPasswordModalEl = document.getElementById('admin-password-modal');
            const adminPasswordModal = bootstrap.Modal.getInstance(adminPasswordModalEl);

            // Try backend login first
            const backend = getBackendBase();
            try {
                const res = await fetch(`${backend}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: input }) });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.token) {
                        setAdminToken(data.token);
                        adminPasswordModal.hide();
                        switchView('admin');
                        return;
                    }
                }
            } catch (err) {
                // fallback to local check below
                console.warn('Backend auth failed, falling back to local check', err);
            }

            // Fallback: local hash check (for offline/demo)
            const hashed = await sha256Hex(input);
            if (hashed === ADMIN_PASSWORD_HASH) {
                    feedback.classList.add('d-none');
                    adminPasswordModal.hide();
                    switchView('admin');
            } else {
                    feedback.classList.remove('d-none');
            }
    });

            // --- Accessibility toolbar wiring ---
            const A11Y_KEY = 'a11yPreferences_v1';
            const a11yDefaults = { contrast: false, largeText: false, collapsed: true };
            const readA11y = () => { try { return JSON.parse(localStorage.getItem(A11Y_KEY) || JSON.stringify(a11yDefaults)); } catch(e){ return a11yDefaults; } };
            const writeA11y = (o) => { try { localStorage.setItem(A11Y_KEY, JSON.stringify(o)); } catch(e){} };
            const applyA11y = (prefs) => {
                const b = document.body;
                b.classList.toggle('a11y-high-contrast', !!prefs.contrast);
                b.classList.toggle('a11y-large-text', !!prefs.largeText);
            b.classList.toggle('a11y-reduced-motion', false);
                // toolbar collapsed state
                const toolbar = document.getElementById('a11y-toolbar');
                if (toolbar) toolbar.classList.toggle('collapsed', !!prefs.collapsed);
                const toggleBtn = document.getElementById('a11y-toggle');
                if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(!prefs.collapsed));
                // update aria-checked attributes on inputs if present
                const ic = document.getElementById('a11y-contrast');
                const il = document.getElementById('a11y-large-text');
            if (ic) { ic.checked = !!prefs.contrast; ic.setAttribute('aria-checked', String(!!prefs.contrast)); }
            if (il) { il.checked = !!prefs.largeText; il.setAttribute('aria-checked', String(!!prefs.largeText)); }
            };

            // Initialize toolbar from saved prefs (including collapsed)
            try {
                const saved = readA11y();
                applyA11y(saved);
            } catch(e) { /* ignore */ }

            // Wire toggle listeners
            const elContrast = document.getElementById('a11y-contrast');
            const elLargeText = document.getElementById('a11y-large-text');
            // reduced-motion control removed from markup
            const elReset = document.getElementById('a11y-reset');

            const onChange = () => {
                const toolbar = document.getElementById('a11y-toolbar');
                const prefs = { contrast: !!(elContrast && elContrast.checked), largeText: !!(elLargeText && elLargeText.checked), collapsed: !!(toolbar && toolbar.classList.contains('collapsed')) };
                applyA11y(prefs);
                writeA11y(prefs);
            };
            if (elContrast) elContrast.addEventListener('change', onChange);
            if (elLargeText) elLargeText.addEventListener('change', onChange);
            // no reduced-motion listener (control removed)
            if (elReset) elReset.addEventListener('click', () => { writeA11y(a11yDefaults); applyA11y(a11yDefaults); showAnnouncement('Preferências de acessibilidade restauradas.','success'); });

            // Weather toolbar controls
            const weatherClearBtn = document.getElementById('weather-clear-cache');
            const weatherTestBtn = document.getElementById('weather-test-conn');
            if (weatherClearBtn) weatherClearBtn.addEventListener('click', () => {
                try { localStorage.removeItem('weatherCache_v1'); showAnnouncement('Cache meteorológico limpo.','success'); } catch (e) { showAnnouncement('Falha ao limpar cache.','danger'); }
            });
            if (weatherTestBtn) weatherTestBtn.addEventListener('click', async () => {
                try {
                    showAnnouncement('Testando serviço meteorológico...','info');
                    const test = await fetchVisualWeather(-23.55, -46.63, getTodayString(), getTodayString());
                    if (test && test.days) showAnnouncement('Serviço meteorológico acessível.','success');
                    else showAnnouncement('Serviço meteorológico indisponível (fallback).','warning');
                } catch (e) { showAnnouncement('Erro ao testar serviço meteorológico.','danger'); }
            });

            // Floating toggle and keyboard shortcut (Alt+M)
            const toggleToolbar = () => {
                const toolbar = document.getElementById('a11y-toolbar');
                if (!toolbar) return;
                const collapsed = toolbar.classList.toggle('collapsed');
                const prefs = readA11y(); prefs.collapsed = collapsed; writeA11y(prefs);
                const btn = document.getElementById('a11y-toggle'); if (btn) btn.setAttribute('aria-expanded', String(!collapsed));
            };
            const floatBtn = document.getElementById('a11y-toggle');
            if (floatBtn) floatBtn.addEventListener('click', toggleToolbar);
            // Alt+M to toggle
            window.addEventListener('keydown', (ev) => {
                if ((ev.altKey || ev.metaKey) && (ev.key === 'm' || ev.key === 'M')) {
                    ev.preventDefault(); toggleToolbar();
                }
            });
            // Render home two-day forecast on load using last CEP if present
            try {
                (async () => {
                    const lastCep = localStorage.getItem(STATS_LAST_CEP_KEY);
                    if (lastCep) {
                        const resolved = await resolveCepToLatLon(lastCep).catch(()=>null);
                        if (resolved) await renderHomeTwoDayForecast(resolved.lat, resolved.lon);
                        else await renderHomeTwoDayForecast();
                    } else {
                        await renderHomeTwoDayForecast();
                    }
                })();
            } catch (e) { console.warn('home forecast init failed', e); }

            // Expor funções após todas as dependências estarem definidas
            try {
                window.switchView = switchView;
                window.fetchPublicAppointments = fetchPublicAppointments;
            } catch (e) { /* ignore if not allowed in some contexts */ }
            // Carregar agendamentos públicos inicialmente para refletir estado do servidor
            try { (async () => { try { await fetchPublicAppointments(); } catch(_){} })(); } catch (e) { /* ignore network errors */ }
            // Sinalizar que a app está pronta (para testes)
            try { window.__APP_READY__ = true; } catch (e) {}
}

// Run init on DOMContentLoaded or immediately if already ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
