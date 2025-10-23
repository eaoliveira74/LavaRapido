// O objeto 'bootstrap' está disponível globalmente pois foi carregado via CDN no index.html.

// Encapsula a inicialização em uma função nomeada para executar mesmo se o DOMContentLoaded já tiver ocorrido
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
    // Os agendamentos ficam como fonte de verdade no servidor; não carregue nem persista no localStorage.
    let appointments = [];
    // Horários padrão gerados a cada 30 minutos entre 08:00 e 17:00
    const AVAILABLE_TIMES = [];
    const genTimes = () => {
    const start = 8 * 60; // em minutos
    const end = 17 * 60; // hora final inclusiva
        for (let m = start; m <= end; m += 30) {
            const hh = Math.floor(m / 60).toString().padStart(2, '0');
            const mm = (m % 60).toString().padStart(2, '0');
            AVAILABLE_TIMES.push(`${hh}:${mm}`);
        }
    };
    genTimes();
  // Variável para guardar o agendamento a ser notificado
  let currentNotificationAppointment = null;
    // Token de autenticação do administrador (JWT) usado em chamadas protegidas da API
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
    // Extras do modal do WhatsApp
  const whatsAppTemplateSel = document.getElementById('whatsapp-template');
  const whatsAppIncludePrice = document.getElementById('whatsapp-include-price');
  const whatsAppIncludeReview = document.getElementById('whatsapp-include-review');
  const whatsAppIncludeLocation = document.getElementById('whatsapp-include-location');

    // URLs opcionais configuráveis via variáveis de ambiente
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

    // Monta a mensagem do WhatsApp com base nas opções escolhidas
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
    // Incluir preço
      if (whatsAppIncludePrice && whatsAppIncludePrice.checked) {
          const price = services.find(s => s.id === app.servicoId)?.preco;
          if (typeof price === 'number') parts.push(`Valor: R$ ${price.toFixed(2)}.`);
      }
    // Incluir link de avaliação
      if (whatsAppIncludeReview && whatsAppIncludeReview.checked) {
          const link = getReviewUrl();
          if (link) parts.push(`Avalie nosso atendimento: ${link}`);
      }
    // Incluir localização
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
                // Padrão para o Worker do Cloudflare quando estiver no GitHub Pages sem URL configurada
                return 'https://lava-rapido-proxy.e-a-oliveira74.workers.dev';
            }
        } catch (_) {}
        return 'http://localhost:4000';
    };

    // Converte mensagens de erro do servidor em textos amigáveis ao usuário
    const friendlyError = (serverMsg) => {
        if (!serverMsg) return 'Ocorreu um erro. Tente novamente.';
        const msg = serverMsg.toString().toLowerCase();
    if (msg.includes('invalid file type') || msg.includes('apenas pdf') || msg.includes('tipo de arquivo inválido')) return 'Formato de arquivo inválido. Envie apenas PDF.';
        if (msg.includes('file too large') || msg.includes('request entity too large') || msg.includes('payload too large') || msg.includes('exceeded')) return 'Arquivo muito grande. O limite é 1 MB.';
        if (msg.includes('password')) return 'Senha incorreta.';
        return serverMsg;
    };

        /**
         * Envia o agendamento ao backend. Quando houver comprovante, utiliza XMLHttpRequest
         * para acompanhar o progresso do upload e atualizar a interface com a porcentagem.
         */
        const sendAppointmentRequest = (url, formData, hasFile, onProgress) => {
            if (!hasFile) {
                return fetch(url, {
                    method: 'POST',
                    body: formData
                });
            }

            return new Promise((resolve, reject) => {
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', url);

                    xhr.onload = () => {
                        if (typeof onProgress === 'function') onProgress(100);
                        const responseText = xhr.responseText || '';
                        let parsedCache;
                        let parsedReady = false;
                        resolve({
                            ok: xhr.status >= 200 && xhr.status < 300,
                            status: xhr.status,
                            async json() {
                                if (parsedReady) return parsedCache;
                                if (!responseText) {
                                    parsedCache = {};
                                    parsedReady = true;
                                    return parsedCache;
                                }
                                try {
                                    parsedCache = JSON.parse(responseText);
                                    parsedReady = true;
                                    return parsedCache;
                                } catch (e) {
                                    throw new Error('Resposta inválida do servidor.');
                                }
                            },
                            async text() {
                                return responseText;
                            }
                        });
                    };

                    xhr.onerror = () => reject(new Error('Falha de rede ao enviar comprovante.'));

                    if (xhr.upload && typeof onProgress === 'function') {
                        xhr.upload.addEventListener('progress', (evt) => {
                            if (!evt.lengthComputable) {
                                onProgress(null);
                                return;
                            }
                            const percent = Math.round((evt.loaded / evt.total) * 100);
                            onProgress(percent);
                        });
                    }

                    xhr.send(formData);
                } catch (err) {
                    reject(err);
                }
            });
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
    // Atualiza os agendamentos públicos (servidor) para recalcular disponibilidade e refletir na UI
        fetchPublicAppointments().then(() => updateAvailableTimes()).catch(() => updateAvailableTimes());
    // renderClientAppointments foi removido
  };

    // (adiado) -- carregamento inicial de agendamentos públicos será feito após a definição da função
  
  const renderAdminView = (activeTab = 'appointments') => {
    // Se houver token ativo, tenta buscar os agendamentos diretamente do servidor
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

    // Busca agendamentos no backend (exige adminToken)
    const fetchAdminAppointments = async () => {
    const backend = getBackendBase();
        if (!adminToken) return;
        try {
            const res = await fetch(`${backend}/api/appointments`, { headers: { Authorization: `Bearer ${adminToken}` } });
            if (!res.ok) {
                // Se estiver não autorizado, limpa o token obsoleto e pede novo login
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

    // Busca agendamentos públicos (sem autenticação) para o admin ver reservas feitas via mobile
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
    // Bloqueia horários passados quando a data escolhida é hoje
      const now = new Date();
      const tzOffset = now.getTimezoneOffset();
      const todayStr = new Date(now.getTime() - tzOffset * 60000).toISOString().slice(0,10);
      const isToday = selectedDate === todayStr;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR');
      availableTimesTitle.textContent = `Horários para ${displayDate}`;
    // Prefere dados públicos vindos do servidor sempre que possível
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
          // Também mantém o select preenchido apenas com horários livres
          if (!unavailable) {
              const option = document.createElement('option');
              option.value = time;
              option.textContent = time;
              timeSelect.appendChild(option);
          }
      });
    // Deixa os cards de horário clicáveis para selecionar o período
      availableTimesGrid.querySelectorAll('.slot').forEach(s => s.addEventListener('click', () => {
          const t = s.dataset.time;
          if (s.classList.contains('unavailable')) return; // ignora horários indisponíveis
          if (timeSelect.querySelector(`option[value="${t}"]`)) {
              timeSelect.value = t;
              timeSelect.dispatchEvent(new Event('change'));
          }
      }));

            // Garante que a legenda exista e esteja visível
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
          // Previsão de término deve ser sempre 30 minutos após o horário escolhido
          const [hours, minutes] = time.split(':').map(Number);
          const totalMinutes = hours * 60 + minutes + 30;
          const newHours = Math.floor(totalMinutes / 60) % 24;
          const newMinutes = totalMinutes % 60;
          const completionTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
                    completionTimeAlert.textContent = `Previsão de término: ${completionTime}`;
                    try {
                        completionTimeAlert.classList.remove('alert-info');
                        completionTimeAlert.classList.add('alert-secondary');
                        // Forçar estilos inline como !important para prevalecer sobre CSS com !important
                        completionTimeAlert.style.setProperty('color', '#080808', 'important');
                        completionTimeAlert.style.setProperty('background-color', '#f1f5f9', 'important');
                        completionTimeAlert.style.setProperty('border-color', '#e2e8f0', 'important');
                    } catch(_) {}
          completionTimeAlert.classList.remove('d-none');
      });
  });

    appointmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Impede envio com horário no passado quando a data escolhida é hoje
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

    // Sempre tenta enviar primeiro ao backend (multipart/form-data); se o servidor estiver indisponível, recorre ao localStorage.
        const form = new FormData();
        form.append('nomeCliente', baseData.nomeCliente);
        form.append('telefoneCliente', baseData.telefoneCliente);
        form.append('servicoId', baseData.servicoId);
        form.append('data', baseData.data);
        form.append('horario', baseData.horario);
        form.append('observacoes', baseData.observacoes || '');
    if (file) form.append('comprovante', file, file.name);

    const backendUrl = getBackendBase() + '/api/appointments';
        const compStatusEl = document.getElementById('comprovante-status');
        const hasFile = Boolean(file);

        if (hasFile && compStatusEl) {
            compStatusEl.textContent = 'Upload do comprovante: 0%';
        }

        try {
            const res = await sendAppointmentRequest(backendUrl, form, hasFile, (percent) => {
                if (!compStatusEl) return;
                if (typeof percent === 'number') {
                    compStatusEl.textContent = `Upload do comprovante: ${percent}%`;
                } else {
                    compStatusEl.textContent = 'Enviando comprovante...';
                }
            });

            if (!res.ok) {
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

                showAnnouncement(serverMessage, 'danger');
                if (compStatusEl) compStatusEl.textContent = '';

                if (res.status >= 400 && res.status < 500) {
                    return;
                }

                throw new Error(serverMessage);
            }

            let created;
            try {
                created = await res.json();
            } catch (_) {
                const txt = await res.text().catch(() => '');
                created = txt ? { mensagem: txt } : {};
            }

            if (created.comprovantePath) created.comprovantePath = created.comprovantePath.replace(/\\/g, '/');

            await fetchPublicAppointments();
            showAnnouncement(`Agendamento para ${created.nomeCliente || baseData.nomeCliente} realizado com sucesso (enviado ao servidor).`);
            appointmentForm.reset();
            comprovanteInput.value = '';

            if (compStatusEl) {
                if (hasFile) {
                    compStatusEl.textContent = 'Upload do comprovante concluído.';
                    setTimeout(() => {
                        if (compStatusEl.textContent === 'Upload do comprovante concluído.') compStatusEl.textContent = '';
                    }, 2500);
                } else {
                    compStatusEl.textContent = '';
                }
            }

            completionTimeAlert.classList.add('d-none');
            updateAvailableTimes();
            renderAppointmentsTable();
        } catch (err) {
            console.warn('Falha ao enviar para o servidor, usando alternativa local:', err);
            try {
                const localA = { ...baseData };
                appointments.push(localA);
                showAnnouncement('Sem conexão com o servidor: agendamento salvo localmente (offline).', 'warning');
                appointmentForm.reset();
                if (comprovanteInput) comprovanteInput.value = '';
                if (compStatusEl) compStatusEl.textContent = hasFile ? 'Comprovante não foi enviado (modo offline).' : '';
                completionTimeAlert.classList.add('d-none');
                updateAvailableTimes();
                renderAppointmentsTable();
            } catch (e) {
                showAnnouncement(`Erro ao conectar ao servidor: ${err.message || 'Tente novamente mais tarde.'}`, 'danger');
                if (compStatusEl && hasFile) compStatusEl.textContent = 'Falha no upload do comprovante.';
            }
        }
  });

    // Exibe nome e status básico do arquivo escolhido ao lado do input
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

    // Ajusta o date-picker para não permitir datas anteriores ao dia atual
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
          // Prefere a URL estática de uploads, depois tenta o endpoint protegido e, por fim, usa o data URL.
          const backend = getBackendBase();
          if (app && app.comprovantePath) {
              // Primeiro tenta abrir /uploads/<path>
              try {
                  const rawUrl = `${backend.replace(/\/$/, '')}/${app.comprovantePath.replace(/^\//, '')}`;
                  // Abre em nova aba (cliques do usuário evitam bloqueadores de pop-up)
                  window.open(rawUrl, '_blank');
                  return;
              } catch (e) {
                  // Caso falhe, continua para o fetch protegido
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
    // Preenche os dados no modal e define valores padrão
          whatsAppClientName.textContent = app.nomeCliente;
        if (whatsAppTemplateSel) whatsAppTemplateSel.value = 'conclusao';
        if (whatsAppIncludePrice) whatsAppIncludePrice.checked = true;
        if (whatsAppIncludeReview) whatsAppIncludeReview.checked = true;
        if (whatsAppIncludeLocation) whatsAppIncludeLocation.checked = false;
    // Renderiza a prévia com base nos controles marcados
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
          // Confirma e abre o WhatsApp com a mensagem adequada
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
          // Alterar para 'Pendente' exige privilégios de administrador
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
      
                          // Abrir no MESMO separador/guia (não cria nova guia)
                          const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
                          window.location.assign(url);
      
      // Esconde o modal e limpa a referência do agendamento
      whatsAppModal.hide();
      currentNotificationAppointment = null;
  });

    // Atualiza a prévia sempre que os controles forem alterados
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
    let statsReady = false;
    let statsUpdateQueue = Promise.resolve();
    let statsChart = null;

    // Garante que a data padrão esteja ajustada
    if (statsDate) statsDate.value = getTodayString();

    // Restaura o último CEP utilizado do localStorage
    const STATS_LAST_CEP_KEY = 'statsLastCep_v1';
    try {
        const lastCep = localStorage.getItem(STATS_LAST_CEP_KEY);
        const cepInputEl = document.getElementById('stats-cep');
        if (lastCep && cepInputEl) cepInputEl.value = lastCep;
    } catch (e) { /* ignore */ }

    // Inicializa a visão de estatísticas: carrega Chart.js se necessário e desenha o gráfico
    async function initializeStats() {
    // Carrega Chart.js da CDN caso ainda não tenha sido carregado
        if (typeof Chart === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
        }
        statsReady = true;
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

    // Resolve o CEP para latitude/longitude utilizando a API ViaCEP
    async function resolveCepToLatLon(cep) {
        if (!cep) return null;
    // Normaliza removendo tudo que não for número
        const cleaned = (cep || '').toString().replace(/\D/g, '');
        if (cleaned.length < 8) return null;
        try {
            const url = `https://viacep.com.br/ws/${cleaned}/json/`;
            const res = await fetch(url);
            if (!res.ok) return null;
            const j = await res.json();
            if (j.erro) return null;
            // ViaCEP retorna logradouro, bairro, localidade e UF; monta consultas do mais específico ao mais amplo
            const candidatesSet = new Set();
            const logradouro = (j.logradouro || '').trim();
            const bairro = (j.bairro || '').trim();
            const localidade = (j.localidade || '').trim();
            const uf = (j.uf || '').trim();
            // Variações com endereço completo
            if (logradouro && bairro && localidade && uf) candidatesSet.add(`${logradouro} ${bairro} ${localidade} ${uf}`);
            if (logradouro && localidade && uf) candidatesSet.add(`${logradouro} ${localidade} ${uf}`);
            if (bairro && localidade && uf) candidatesSet.add(`${bairro} ${localidade} ${uf}`);
            if (logradouro && uf) candidatesSet.add(`${logradouro} ${uf}`);
            if (localidade && uf) candidatesSet.add(`${localidade} ${uf}`);
            // Tenta adicionar "Brasil" para ampliar a geocodificação
            if (localidade && uf) candidatesSet.add(`${localidade} ${uf} Brasil`);
            if (logradouro && bairro && localidade && uf) candidatesSet.add(`${logradouro} ${bairro} ${localidade} ${uf} Brasil`);
            // Tenta com o próprio CEP
            candidatesSet.add(cleaned);
            // Converte para array preservando a ordem
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
                    // Tenta o próximo candidato
                }
            }
            // Se nada casar no Open-Meteo, tenta o Nominatim (OpenStreetMap) como alternativa
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
                // Ignora entrada inválida
            }
            // Nenhuma correspondência encontrada
            return null;
        } catch (e) {
            return null;
        }
    }

    // Utilitários simples de cache de CEP usando localStorage
    const CEP_CACHE_KEY = 'cepCache_v1';
    const readCepCache = () => {
        try { return JSON.parse(localStorage.getItem(CEP_CACHE_KEY) || '{}'); } catch (e) { return {}; }
    };
    const writeCepCache = (c) => { try { localStorage.setItem(CEP_CACHE_KEY, JSON.stringify(c)); } catch (e) {} };

    // Ícones SVG usados na visão de estatísticas (pequenos e inline)
    const ICON_SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4" fill="#FFC107"/><g stroke="#FFC107" stroke-width="1.4" stroke-linecap="round"><path d="M12 1.8v2.4"/><path d="M12 19.8v2.4"/><path d="M4.4 4.4l1.7 1.7"/><path d="M17.9 17.9l1.7 1.7"/><path d="M1.8 12h2.4"/><path d="M19.8 12h2.4"/><path d="M4.4 19.6l1.7-1.7"/><path d="M17.9 6.1l1.7-1.7"/></g></svg>';
    const ICON_CLOUD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 17.58A5.59 5.59 0 0 0 14.42 12H13a4 4 0 1 0-7.9 1.56A4 4 0 0 0 6 20h14a0 0 0 0 0 0-2.42z" fill="#90A4AE"/></svg>';
    const ICON_RAIN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 17.58A5.59 5.59 0 0 0 14.42 12H13a4 4 0 1 0-7.9 1.56A4 4 0 0 0 6 20h14a0 0 0 0 0 0-2.42z" fill="#78909C"/><g stroke="#03A9F4" stroke-linecap="round" stroke-width="1.6"><path d="M8 21l0-3"/><path d="M12 21l0-3"/><path d="M16 21l0-3"/></g></svg>';

    const normalizeConditionLabel = (raw) => {
        const text = (raw || '').toString();
        const lower = text.toLowerCase();
        if (lower.includes('ensolar') || lower.includes('sun') || lower.includes('clear')) return 'Ensolarado';
        if (lower.includes('nublado') || lower.includes('cloud') || lower.includes('overcast')) return 'Nublado';
        if (lower.includes('chuv') || lower.includes('rain') || lower.includes('storm') || lower.includes('precip')) return 'Chuvoso';
        return text || 'Indeterminado';
    };

    const WEATHER_GRID_MAX_ROWS = 5;
    const WEATHER_GRID_COLUMNS = 6;
    const WEATHER_GRID_MAX_ITEMS = WEATHER_GRID_MAX_ROWS * WEATHER_GRID_COLUMNS;

    const formatDatePtBr = (iso) => {
        if (!iso) return '';
        const dt = new Date(`${iso}T00:00:00`);
        if (Number.isNaN(dt.getTime())) return iso;
        return dt.toLocaleDateString('pt-BR');
    };

    const updateHomeWeatherDates = (days) => {
        const container = document.getElementById('home-weather-dates');
        if (!container) return;
        container.innerHTML = '';
        if (!Array.isArray(days) || days.length === 0) {
            container.classList.add('d-none');
            return;
        }
        const maxItems = Math.min(days.length, WEATHER_GRID_MAX_ITEMS);
        for (let i = 0; i < maxItems; i += 1) {
            const day = days[i];
            if (!day) continue;
            const isoCandidate = (day.date || day.datetime || day.dateStr || '').toString();
            const iso = isoCandidate.slice(0, 10);
            if (!iso) continue;
            const dt = new Date(`${iso}T00:00:00`);
            const label = Number.isNaN(dt.getTime())
                ? iso
                : dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const conditionText = normalizeConditionLabel(day.conditionSimple || day.label || day.conditions || '');
            const conditionKey = conditionText.toLowerCase();
            let iconSvg = '';
            if (conditionKey.startsWith('ensolar')) iconSvg = ICON_SUN;
            else if (conditionKey.startsWith('nublado')) iconSvg = ICON_CLOUD;
            else if (conditionKey.startsWith('chuv')) iconSvg = ICON_RAIN;
            const precip = (day.precipprob != null) ? Math.round(Number(day.precipprob)) : null;
            const entry = document.createElement('div');
            entry.className = 'weather-date-entry';
            const longDate = formatDatePtBr(iso);
            const precipDetail = (precip != null && !Number.isNaN(precip)) ? `${precip}% chuva` : '';
            const safeCondition = conditionText || 'Condição não informada';
            const iconMarkup = iconSvg || '<span class="date-icon-fallback" aria-hidden="true">?</span>';
            entry.innerHTML = `<div class="date-icon">${iconMarkup}</div><div class="date-label">${label}</div>${precipDetail ? `<div class="date-extra">${precipDetail}</div>` : ''}`;
            const titleParts = [longDate, safeCondition];
            if (precipDetail) titleParts.push(precipDetail);
            const descriptor = titleParts.filter(Boolean).join(' · ');
            entry.title = descriptor;
            entry.setAttribute('aria-label', descriptor);
            container.appendChild(entry);
        }
        if (container.childElementCount === 0) {
            container.classList.add('d-none');
        } else {
            container.classList.remove('d-none');
        }
    };

    // Busca clima através do proxy do Visual Crossing rodando no servidor
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

    // Auxiliar para buscar e armazenar em cache a linha do tempo do Visual Crossing (ou alternativa) para pequenos intervalos
    async function fetchTwoDayWeatherCached(lat, lon) {
        const start = getTodayString();
        const tomorrow = (() => { const d = new Date(start + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
        const key = `${lat.toFixed(4)},${lon.toFixed(4)},${start},${tomorrow}`;
        const cache = readWeatherCache();
        const now = Date.now();
        if (cache[key] && (now - (cache[key].ts || 0) < WEATHER_CACHE_TTL)) return cache[key].data;
    // Tenta primeiro o proxy do Visual Crossing
        let data = null;
        try {
            const vc = await fetchVisualWeather(lat, lon, start, tomorrow);
            if (vc && vc.days) data = vc;
        } catch (e) { /* ignore */ }
        if (!data) {
            // Se falhar, usa resumo do Open-Meteo e adapta o formato (min/máx/sensação/previsão de chuva)
            const om = await fetchWeatherSummary(start, tomorrow, lat, lon);
            if (om && om.length) {
                data = {
                    lat,
                    lon,
                    days: om.map(d => ({
                        date: d.date,
                        conditionSimple: d.label,
                        temp: null,
                        tempmax: (d.tempmax != null ? d.tempmax : null),
                        tempmin: (d.tempmin != null ? d.tempmin : null),
                        feelslikemax: (d.feelslikemax != null ? d.feelslikemax : null),
                        feelslikemin: (d.feelslikemin != null ? d.feelslikemin : null),
                        precipprob: (d.precipprob != null ? d.precipprob : null)
                    }))
                };
            }
        }
        cache[key] = { ts: now, data };
        writeWeatherCache(cache);
        return data;
    }

    // Renderiza dois cards no topo para hoje e amanhã
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
            // Procura os dias de hoje e amanhã na resposta
            const todayISO = getTodayString();
            const tomorrowISO = (() => { const d = new Date(todayISO + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
            const dayMap = {}; data.days.forEach(d => { dayMap[d.date] = d; });
            const t0 = dayMap[todayISO] || data.days[0];
            const t1 = dayMap[tomorrowISO] || data.days[1] || null;

            const renderCard = (el, day, label) => {
                if (!el) return;
                if (!day) { el.innerHTML = `<div class="title">${label}</div><div class="cond">Indisponível</div>`; return; }
                const cond = day.conditionSimple || day.label || (day.conditions || '') || 'Indeterminado';
                const tmax = Math.round(day.tempmax != null ? day.tempmax : (day.temp != null ? day.temp : 0));
                const tmin = Math.round(day.tempmin != null ? day.tempmin : (day.temp != null ? day.temp : 0));
                const icon = (cond === 'Ensolarado') ? ICON_SUN : (cond === 'Nublado' ? ICON_CLOUD : (cond === 'Chuvoso' ? ICON_RAIN : ''));
                const feelsMax = (day.feelslikemax != null) ? Math.round(day.feelslikemax) : null;
                const feelsMin = (day.feelslikemin != null) ? Math.round(day.feelslikemin) : null;
                const precipProb = (day.precipprob != null) ? Math.round(day.precipprob) : null;
                el.innerHTML = `
                    <div class="title">${label}</div>
                    <div class="d-flex align-items-center gap-2 mt-1">
                        <div class="icon">${icon}</div>
                        <div>
                            <div class="temp"><strong>Máx ${tmax}°C</strong></div>
                            <div class="temp text-secondary">Min ${tmin}°C</div>
                            <div class="cond">${cond}${(feelsMax!=null||feelsMin!=null) ? ` · Sensação ${feelsMax!=null?feelsMax:tmax}°/${feelsMin!=null?feelsMin:tmin}°` : ''}${precipProb!=null ? ` · ${precipProb}% chuva` : ''}</div>
                        </div>
                    </div>
                `;
                el.setAttribute('title', `${label}: ${cond} — Máx ${tmax}°C · Min ${tmin}°C`);
            };

            renderCard(todayEl, t0, 'Hoje');
            renderCard(tomorrowEl, t1, 'Amanhã');
        } catch (e) {
            console.warn('Failed to render home forecast', e);
        }
    }


    // Busca um resumo simples do clima via Open-Meteo (sem necessidade de chave)
    async function fetchWeatherSummary(startDate, endDate, lat = -23.55, lon = -46.63) {
    // Resumo diário do Open-Meteo com weathercode e aproximação de sensação térmica
    // Observação: apparent_temperature_max/min do Open-Meteo já aproxima a sensação térmica
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=weathercode,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_mean&timezone=auto`;
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const j = await res.json();
            // Converte códigos meteorológicos em rótulos e ícones simples
            const codeToLabelAndIcon = (c) => {
                // 0 = clear sky, 1-3 mainly clear/partly cloudy/overcast, 51+ light-moderate precipitation
                if (c === 0) return { label: 'Ensolarado', icon: '☀️' };
                if ([1,2,3].includes(c)) return { label: 'Nublado', icon: '☁️' };
                if (c >= 51) return { label: 'Chuvoso', icon: '🌧️' };
                return { label: 'Indeterminado', icon: '❓' };
            };
            const days = (j.daily && j.daily.time) || [];
            const codes = (j.daily && j.daily.weathercode) || [];
            const tmax = (j.daily && j.daily.temperature_2m_max) || [];
            const tmin = (j.daily && j.daily.temperature_2m_min) || [];
            const appMax = (j.daily && j.daily.apparent_temperature_max) || [];
            const appMin = (j.daily && j.daily.apparent_temperature_min) || [];
            const precipProb = (j.daily && j.daily.precipitation_probability_mean) || [];
            return days.map((d, i) => ({ date: d, ...codeToLabelAndIcon(codes[i] || -1), tempmax: tmax[i] ?? null, tempmin: tmin[i] ?? null, feelslikemax: appMax[i] ?? null, feelslikemin: appMin[i] ?? null, precipprob: precipProb[i] ?? null }));
        } catch (e) {
            return null;
        }
    }

    // Busca estatísticas diárias agregadas (prefere endpoint público; usa admin se logado)
    async function fetchDailyStats(startISO, endISO) {
        const backend = getBackendBase();
        const pubUrl = `${backend}/api/stats-daily?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
        try {
            const pubRes = await fetch(pubUrl);
            if (pubRes.ok) {
                return await pubRes.json();
            }
        } catch {}
        if (adminToken) {
            try {
                const admUrl = `${backend}/api/admin/stats-daily?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`;
                const res = await fetch(admUrl, { headers: { 'Authorization': `Bearer ${adminToken}` } });
                if (!res.ok) return [];
                return await res.json();
            } catch {}
        }
        return [];
    }

    // Salva/atualiza probabilidade de chuva para datas específicas (melhor esforço, intervalos curtos)
    async function upsertRainProbabilities(days) {
        if (!adminToken || !Array.isArray(days) || days.length === 0) return;
    if (days.length > 62) return; // evita excesso de chamadas para intervalos gigantes
        const backend = getBackendBase();
        await Promise.all(days.map(async d => {
            const rp = (d.precipprob != null) ? Number(d.precipprob) : null;
            if (rp == null || isNaN(rp)) return;
            try {
                await fetch(`${backend}/api/admin/stats-daily`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
                    body: JSON.stringify({ date: d.date, rainProbability: rp })
                });
            } catch {}
        }));
    }

    async function renderStats() {
        const range = statsRange.value || 'month';
        const refDate = statsDate.value || getTodayString();
    // Limites de data usados nas consultas e na busca de clima
        let start = refDate, end = refDate;
    // Usa labels vindos do banco quando disponíveis; caso contrário agrega no cliente
    let labels = [];
    let counts = [];
    let revenue = [];
    let rainPercent = null; // null => dataset omitido; array => plotado
    // Primeiro calcula os limites de data como na lógica anterior
        const computeBounds = (range, refDate) => {
            if (range === 'day') return { start: refDate, end: refDate };
            const d = new Date(refDate + 'T00:00:00');
            if (range === 'week') {
                const day = d.getDay(); // 0-6, Sun-Sat
                const diffToMon = (day + 6) % 7; // dias contados a partir da segunda-feira
                const monday = new Date(d); monday.setDate(d.getDate() - diffToMon);
                const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
                return { start: monday.toISOString().slice(0,10), end: sunday.toISOString().slice(0,10) };
            }
            if (range === 'month') {
                const y = d.getFullYear(); const m = d.getMonth();
                const first = new Date(Date.UTC(y, m, 1));
                const last = new Date(Date.UTC(y, m + 1, 0));
                return { start: first.toISOString().slice(0,10), end: last.toISOString().slice(0,10) };
            }
            if (range === 'year') {
                const y = d.getFullYear();
                return { start: `${y}-01-01`, end: `${y}-12-31` };
            }
            return { start: refDate, end: refDate };
        };
        ({ start, end } = computeBounds(range, refDate));

        const withinBounds = (isoDate) => {
            if (!isoDate) return false;
            if (isoDate < start) return false;
            if (isoDate > end) return false;
            return true;
        };

        const sourceAppointmentsList = (adminToken && serverAppointments) ? serverAppointments : (publicAppointments || appointments || []);
        const aggregatedByDate = (() => {
            const map = new Map();
            const priceByService = (id) => {
                if (!id) return 0;
                const svc = services.find(s => s.id === id) || null;
                if (!svc) return 0;
                if (typeof svc.preco === 'number' && !Number.isNaN(svc.preco)) return svc.preco;
                const parsed = Number(svc.preco || svc.price || 0);
                return Number.isFinite(parsed) ? parsed : 0;
            };
            if (!Array.isArray(sourceAppointmentsList)) return map;
            sourceAppointmentsList.forEach(app => {
                if (!app || app.status === 'Cancelado') return;
                const iso = (app.data || '').toString().slice(0, 10);
                if (!withinBounds(iso)) return;
                // Mantém alinhado com o backend: conta apenas concluídos para métricas consolidadas
                if (app.status && app.status !== 'Concluído') return;
                const entry = map.get(iso) || { count: 0, revenue: 0 };
                entry.count += 1;
                entry.revenue += priceByService(app.servicoId);
                map.set(iso, entry);
            });
            return map;
        })();

    // Tenta estatísticas diárias vindas do banco
        const dbStats = await fetchDailyStats(start, end);
        if (Array.isArray(dbStats) && dbStats.length > 0) {
            const merged = new Map();
            dbStats.forEach(r => {
                const iso = (r.date || '').toString().slice(0, 10);
                if (!withinBounds(iso)) return;
                merged.set(iso, {
                    label: formatDatePtBr(iso),
                    count: Number(r.carsWashed || 0),
                    revenue: Number(r.totalRevenue || 0),
                    rain: (r.rainProbability == null) ? null : Math.round(Number(r.rainProbability))
                });
            });
            aggregatedByDate.forEach((agg, iso) => {
                const current = merged.get(iso) || { label: formatDatePtBr(iso), count: 0, revenue: 0, rain: null };
                if (typeof agg.count === 'number' && agg.count > current.count) current.count = agg.count;
                if (typeof agg.revenue === 'number' && agg.revenue > current.revenue) current.revenue = Math.round(agg.revenue * 100) / 100;
                merged.set(iso, current);
            });
            const sorted = Array.from(merged.entries()).sort(([a],[b]) => (a < b ? -1 : a > b ? 1 : 0));
            const rainValues = [];
            let hasRain = false;
            labels = [];
            counts = [];
            revenue = [];
            sorted.forEach(([, data]) => {
                labels.push(data.label);
                counts.push(data.count);
                revenue.push(data.revenue);
                if (data.rain != null) { rainValues.push(data.rain); hasRain = true; } else { rainValues.push(null); }
            });
            rainPercent = hasRain ? rainValues : null;
        } else {
            if (aggregatedByDate.size > 0) {
                const sorted = Array.from(aggregatedByDate.entries()).sort(([a],[b]) => (a < b ? -1 : a > b ? 1 : 0));
                labels = [];
                counts = [];
                revenue = [];
                sorted.forEach(([iso, data]) => {
                    labels.push(formatDatePtBr(iso));
                    counts.push(data.count);
                    revenue.push(Math.round(data.revenue * 100) / 100);
                });
            } else {
                labels = [];
                counts = [];
                revenue = [];
            }
            rainPercent = null;
        }

    // Destrói gráfico anterior se existir
        if (statsChart) { statsChart.destroy(); statsChart = null; }

    // Prepara datasets de quantidade e faturamento
        const ctx = statsChartEl.getContext('2d');
            const datasets = [
                { label: 'Veículos lavados', data: counts, backgroundColor: 'rgba(6,182,212,0.7)', yAxisID: 'y' },
                { label: 'Faturamento (R$)', data: revenue, type: 'line', borderColor: 'rgba(16,185,129,0.9)', backgroundColor: 'rgba(16,185,129,0.3)', yAxisID: 'y1' }
            ];
            if (Array.isArray(rainPercent)) {
                datasets.push({ label: '% Chuva', data: rainPercent, type: 'line', borderColor: 'rgba(59,130,246,0.9)', backgroundColor: 'rgba(59,130,246,0.2)', yAxisID: 'y2' });
            }
            statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets
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
                        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'R$' } },
                        y2: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, min: 0, max: 100, ticks: { callback: (v)=>`${v}%` }, title: { display: true, text: '% Chuva' }, display: Array.isArray(rainPercent) }
                    }
                }
        });

    // A busca de clima usa os limites calculados anteriormente
    // Resolve o CEP informado para lat/lon quando houver
    // Faz o mesmo usando o cache quando possível
        const cepInput = document.getElementById('stats-cep');
        const cepFeedback = document.getElementById('stats-cep-feedback');
    let lat = -23.55, lon = -46.63; // coordenadas padrão de São Paulo
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
    updateHomeWeatherDates([]);

        const createWeatherDayIcon = (day, includeLabel = true) => {
            if (!day) return null;
            const isoCandidate = (day.date || day.datetime || '').toString();
            const iso = isoCandidate.slice(0, 10);
            let label = iso;
            if (iso) {
                const parsed = new Date(iso + 'T00:00:00');
                if (!isNaN(parsed.getTime())) label = parsed.toLocaleDateString('pt-BR');
            }
            if (!label) label = day.displayDate || day.dateStr || '-';
            const baseCondition = day.conditionSimple || day.label || day.conditions || '';
            const condition = normalizeConditionLabel(baseCondition);
            const conditionKey = condition.toLowerCase();
            let iconSvg = '';
            if (conditionKey.startsWith('ensolar')) iconSvg = ICON_SUN;
            else if (conditionKey.startsWith('nublado')) iconSvg = ICON_CLOUD;
            else if (conditionKey.startsWith('chuv')) iconSvg = ICON_RAIN;
            const precip = (day.precipprob != null) ? Math.round(Number(day.precipprob)) : null;
            const tooltipDetail = (day.conditions || baseCondition || condition || '').toString();
            const dayDiv = document.createElement('div');
            dayDiv.className = 'day-icon';
            dayDiv.setAttribute('role', 'img');
            dayDiv.setAttribute('aria-label', `${label}: ${condition}`);
            const precipTxt = (precip != null && !Number.isNaN(precip)) ? ` (${precip}% precip)` : '';
            dayDiv.title = `${label}: ${tooltipDetail || condition}${precipTxt}`;
            const labelMarkup = includeLabel ? `<div class="label">${label}</div>` : '';
            dayDiv.innerHTML = `${iconSvg}${labelMarkup}`;
            return dayDiv;
        };

        const populateWeatherStrip = (days) => {
            const stripEl = document.getElementById('stats-weather-strip');
            if (!stripEl) return;
            stripEl.innerHTML = '';
            stripEl.classList.add('d-none');
        };

        try {
            // Prefere o proxy do Visual Crossing se estiver disponível
            const vc = await fetchVisualWeather(lat, lon, start, end);
            if (vc && vc.days) {
                // Visual Crossing: renderiza faixas com ícones e rótulos localizados
                const legendEl = document.getElementById('home-weather-legend');
                const infoEl = document.getElementById('stats-weather');
                if (legendEl) legendEl.innerHTML = '';
                populateWeatherStrip(vc.days);

                // Preenche a legenda
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
                // Melhor esforço: persiste probabilidade de chuva nas estatísticas para uso futuro
                await upsertRainProbabilities(vc.days);
            } else {
                // Alternativa com Open-Meteo mantendo o mesmo formato de visualização
                const days = await fetchWeatherSummary(start, end, lat, lon);
                const legendEl = document.getElementById('home-weather-legend');
                const infoEl = document.getElementById('stats-weather');
                if (legendEl) legendEl.innerHTML = '';

                populateWeatherStrip(days);

                if (days && days.length) {
                    // Legenda
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
                    await upsertRainProbabilities(days);
                } else {
                    const attempted = `Coordenadas tentadas: ${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                    const cepMsg = (cepFeedback && !cepFeedback.classList.contains('d-none')) ? (' / ' + (cepFeedback.textContent || '').trim()) : '';
                    if (infoEl) infoEl.textContent = '';
                    console.debug('Weather unavailable for', { start, end, lat, lon, cepFeedback: cepFeedback && cepFeedback.textContent });
                }
            }
        } catch (err) {
            console.error('Erro ao buscar weather:', err);
        }

        updateHomeWeatherDates(weather);

    // Calcula e exibe a distribuição percentual das condições climáticas na visão de estatísticas
        try {
            if (weather && weather.length) {
                const totalDays = weather.length;
                const counts = { Ensolarado: 0, Nublado: 0, Chuvoso: 0, Indeterminado: 0 };
                weather.forEach(d => {
                    const category = normalizeConditionLabel(d.conditionSimple || d.label || d.conditions || '');
                    const key = category.toLowerCase();
                    if (key.startsWith('ensolar')) counts.Ensolarado++;
                    else if (key.startsWith('nublado')) counts.Nublado++;
                    else if (key.startsWith('chuv')) counts.Chuvoso++;
                    else counts.Indeterminado++;
                });
                const percent = (n) => (totalDays === 0 ? 0 : Math.round((n * 1000) / totalDays) / 10); // uma casa decimal
                // Monta o resumo em HTML
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

    // Se houver dados do Visual Crossing, preenche também o cabeçalho com o clima de hoje
        try {
            const homeEl = document.getElementById('home-weather');
            if (homeEl && weather && weather.length) {
                // Localiza a data atual
                const todayISO = getTodayString();
                const today = weather.find(d => d.date === todayISO) || weather[0];
                if (today) {
                    const todayCondition = normalizeConditionLabel(today.conditionSimple || today.label || today.conditions || '');
                    const todayKey = todayCondition.toLowerCase();
                    let iconSvg = '';
                    if (todayKey.startsWith('ensolar')) iconSvg = ICON_SUN;
                    else if (todayKey.startsWith('nublado')) iconSvg = ICON_CLOUD;
                    else if (todayKey.startsWith('chuv')) iconSvg = ICON_RAIN;
                    const tmax = Math.round(today.tempmax != null ? today.tempmax : (today.temp != null ? today.temp : 0));
                    const tmin = Math.round(today.tempmin != null ? today.tempmin : (today.temp != null ? today.temp : 0));
                    const feelsMax = (today.feelslikemax != null) ? Math.round(today.feelslikemax) : null;
                    const feelsMin = (today.feelslikemin != null) ? Math.round(today.feelslikemin) : null;
                    const precipProb = (today.precipprob != null) ? Math.round(today.precipprob) : null;
                    const feelsTxt = (feelsMax!=null||feelsMin!=null) ? ` · Sensação ${feelsMax!=null?feelsMax:tmax}°/${feelsMin!=null?feelsMin:tmin}°` : '';
                    const precipTxt = precipProb!=null ? ` · ${precipProb}% chuva` : '';
                    homeEl.innerHTML = `${iconSvg} <strong style="vertical-align:middle;">${todayCondition}</strong> — Máx ${tmax}°C · Min ${tmin}°C${feelsTxt}${precipTxt}`;
                }
            }
        } catch (e) { /* ignore */ }
    }

    // (debugResolveCep removed) — production build: no debug button wired

    // Liga os eventos de atualização
        const queueStatsRender = () => {
            statsUpdateQueue = statsUpdateQueue.then(async () => {
                try {
                    if (!statsReady) {
                        await initializeStats();
                    } else {
                        await renderStats();
                    }
                } catch (err) {
                    console.error('Erro ao atualizar estatísticas:', err);
                }
            });
        };

        if (statsRefresh) statsRefresh.addEventListener('click', () => {
            try { const cepEl = document.getElementById('stats-cep'); if (cepEl && cepEl.value) localStorage.setItem(STATS_LAST_CEP_KEY, cepEl.value); } catch (e) {}
            queueStatsRender();
        });
        if (statsRange) statsRange.addEventListener('change', () => {
            try { const cepEl = document.getElementById('stats-cep'); if (cepEl && cepEl.value) localStorage.setItem(STATS_LAST_CEP_KEY, cepEl.value); } catch (e) {}
            queueStatsRender();
        });
        if (statsDate) statsDate.addEventListener('change', () => {
            queueStatsRender();
        });
    // Guarda o último CEP ao alterar o campo e atualiza gráficos automaticamente
        const cepInputEl = document.getElementById('stats-cep');
        if (cepInputEl) cepInputEl.addEventListener('change', () => {
            try { localStorage.setItem(STATS_LAST_CEP_KEY, cepInputEl.value); } catch (e) {}
            queueStatsRender();
        });
    // Exportação em CSV
        const statsExportBtn = document.getElementById('stats-export');
        if (statsExportBtn) statsExportBtn.addEventListener('click', () => {
            if (!statsChart) return showAnnouncement('Gere o gráfico antes de exportar.','warning');
            const labels = statsChart.data.labels;
            const ds = statsChart.data.datasets;
            const counts = ds.find(d => d.label === 'Veículos lavados')?.data || [];
            const revenue = ds.find(d => d.label === 'Faturamento (R$)')?.data || [];
            const rain = ds.find(d => d.label === '% Chuva')?.data || [];
            let csv = 'label,veiculos,faturamento,chuva_percent\n';
            for (let i=0;i<labels.length;i++) csv += `${labels[i]},${counts[i]||0},${revenue[i]||0},${(rain[i]??'')}\n`;
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

            // Primeiro tenta autenticar no backend
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
                // Se falhar, cai no check local abaixo
                console.warn('Backend auth failed, falling back to local check', err);
            }

            // Alternativa: validação local do hash (uso offline/demo)
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
                // Estado de colapso da barra de ferramentas
                const toolbar = document.getElementById('a11y-toolbar');
                if (toolbar) toolbar.classList.toggle('collapsed', !!prefs.collapsed);
                const toggleBtn = document.getElementById('a11y-toggle');
                if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(!prefs.collapsed));
                // Atualiza atributos aria-checked dos inputs quando existirem
                const ic = document.getElementById('a11y-contrast');
                const il = document.getElementById('a11y-large-text');
            if (ic) { ic.checked = !!prefs.contrast; ic.setAttribute('aria-checked', String(!!prefs.contrast)); }
            if (il) { il.checked = !!prefs.largeText; il.setAttribute('aria-checked', String(!!prefs.largeText)); }
            };

            // Inicializa a barra usando preferências salvas (incluindo colapso)
            try {
                const saved = readA11y();
                applyA11y(saved);
            } catch(e) { /* ignore */ }

            // Conecta os listeners dos toggles
            const elContrast = document.getElementById('a11y-contrast');
            const elLargeText = document.getElementById('a11y-large-text');
            // Controle de movimento reduzido removido do markup
            const elReset = document.getElementById('a11y-reset');

            const onChange = () => {
                const toolbar = document.getElementById('a11y-toolbar');
                const prefs = { contrast: !!(elContrast && elContrast.checked), largeText: !!(elLargeText && elLargeText.checked), collapsed: !!(toolbar && toolbar.classList.contains('collapsed')) };
                applyA11y(prefs);
                writeA11y(prefs);
            };
            if (elContrast) elContrast.addEventListener('change', onChange);
            if (elLargeText) elLargeText.addEventListener('change', onChange);
            // Sem listener de movimento reduzido (controle removido)
            if (elReset) elReset.addEventListener('click', () => { writeA11y(a11yDefaults); applyA11y(a11yDefaults); showAnnouncement('Preferências de acessibilidade restauradas.','success'); });

            // Controles climáticos da toolbar foram removidos (botões não existem mais)

            // Toggle flutuante e atalho de teclado (Alt+M)
            const toggleToolbar = () => {
                const toolbar = document.getElementById('a11y-toolbar');
                if (!toolbar) return;
                const collapsed = toolbar.classList.toggle('collapsed');
                const prefs = readA11y(); prefs.collapsed = collapsed; writeA11y(prefs);
                const btn = document.getElementById('a11y-toggle'); if (btn) btn.setAttribute('aria-expanded', String(!collapsed));
            };
            const floatBtn = document.getElementById('a11y-toggle');
            if (floatBtn) floatBtn.addEventListener('click', toggleToolbar);
            // Atalho Alt+M para alternar
            window.addEventListener('keydown', (ev) => {
                if ((ev.altKey || ev.metaKey) && (ev.key === 'm' || ev.key === 'M')) {
                    ev.preventDefault(); toggleToolbar();
                }
            });
            // Renderiza a previsão de dois dias na home usando o último CEP salvo
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

// Executa init no DOMContentLoaded ou imediatamente se o DOM já estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
