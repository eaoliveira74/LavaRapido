// O objeto 'bootstrap' está disponível globalmente pois foi carregado via CDN no index.html.

// Espera o DOM estar completamente carregado para executar o script
document.addEventListener('DOMContentLoaded', () => {

  // --- 1. ESTADO DA APLICAÇÃO ---
  // Aqui guardamos todos os dados que a aplicação utiliza.
  // Usamos o localStorage para que os dados não se percam ao recarregar a página.

  let services = JSON.parse(localStorage.getItem('services')) || [
    { id: 'lavagem-simples', nome: 'Lavagem Simples', preco: 15.00, duration: 30 },
    { id: 'lavagem-completa', nome: 'Lavagem Completa', preco: 25.00, duration: 60 },
    { id: 'enceramento', nome: 'Enceramento', preco: 40.00, duration: 90 },
    { id: 'lavagem-motor', nome: 'Lavagem do Motor', preco: 30.00, duration: 45 }
  ];
  let appointments = JSON.parse(localStorage.getItem('appointments')) || [];
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


  // --- 3. FUNÇÕES DE UTILIDADE E LÓGICA DE NEGÓCIO ---
  
  /**
   * Salva os dados de serviços e agendamentos no localStorage.
   */
  const saveData = () => {
    localStorage.setItem('services', JSON.stringify(services));
    localStorage.setItem('appointments', JSON.stringify(appointments));
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

    // Map server-side error messages to user-friendly text
    const friendlyError = (serverMsg) => {
        if (!serverMsg) return 'Ocorreu um erro. Tente novamente.';
        const msg = serverMsg.toString().toLowerCase();
        if (msg.includes('invalid file type')) return 'Formato de arquivo inválido. Use JPG, PNG ou PDF.';
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
    updateAvailableTimes();
    // renderClientAppointments foi removido
  };
  
  const renderAdminView = (activeTab = 'appointments') => {
      // If we have a token, try fetching server-side appointments
      if (adminToken) fetchAdminAppointments().catch(() => {});
      renderAppointmentsTable();
      renderServicesList();
      document.getElementById('admin-appointments-section').classList.toggle('d-none', activeTab !== 'appointments');
      document.getElementById('admin-services-section').classList.toggle('d-none', activeTab !== 'services');
      document.getElementById('show-appointments-btn').classList.toggle('btn-cyan', activeTab === 'appointments');
      document.getElementById('show-appointments-btn').classList.toggle('btn-secondary', activeTab !== 'appointments');
      document.getElementById('show-services-btn').classList.toggle('btn-cyan', activeTab === 'services');
      document.getElementById('show-services-btn').classList.toggle('btn-secondary', activeTab !== 'services');
  };

    // Fetch appointments from backend (requires adminToken)
    const fetchAdminAppointments = async () => {
        const backend = (window.__BACKEND_URL__ || 'http://localhost:4000');
        if (!adminToken) return;
        try {
            const res = await fetch(`${backend}/api/appointments`, { headers: { Authorization: `Bearer ${adminToken}` } });
            if (!res.ok) {
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
      const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR');
      availableTimesTitle.textContent = `Horários para ${displayDate}`;
      const bookedSlots = new Set(
          appointments.filter(a => a.data === selectedDate && a.status !== 'Cancelado').map(a => a.horario)
      );
      availableTimesGrid.innerHTML = '';
      timeSelect.innerHTML = '<option value="">Selecione um horário</option>';
      AVAILABLE_TIMES.forEach(time => {
          const isBooked = bookedSlots.has(time);
          const slot = document.createElement('div');
          slot.className = `slot p-2 rounded text-center small ${isBooked ? 'reserved' : 'free'}`;
          slot.dataset.time = time;
          slot.innerHTML = `<div class="slot-label fw-bold">${time}</div>`;
          availableTimesGrid.appendChild(slot);
          // also populate the select with only free slots
          if (!isBooked) {
              const option = document.createElement('option');
              option.value = time;
              option.textContent = time;
              timeSelect.appendChild(option);
          }
      });
      // Make slots clickable to select time
      availableTimesGrid.querySelectorAll('.slot').forEach(s => s.addEventListener('click', () => {
          const t = s.dataset.time;
          if (timeSelect.querySelector(`option[value="${t}"]`)) {
              timeSelect.value = t;
              timeSelect.dispatchEvent(new Event('change'));
          }
      }));
  };
  
  const renderAppointmentsTable = () => {
      appointmentsTableBody.innerHTML = '';
      const list = (adminToken && serverAppointments) ? serverAppointments : appointments;
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

  appointmentForm.addEventListener('submit', (e) => {
    e.preventDefault();
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

        const backendUrl = (window.__BACKEND_URL__ || 'http://localhost:4000') + '/api/appointments';

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

                // For server errors (5xx) treat as transient and throw to trigger fallback below
                throw new Error(serverMessage);
            }
            return res.json();
        }).then(created => {
            if (!created) return; // handled earlier (client error)
            // Server returns the created appointment metadata (id, comprovantePath, status...)
            appointments.push(created);
            saveData();
            showAnnouncement(`Agendamento para ${created.nomeCliente} realizado com sucesso (enviado ao servidor).`);
            appointmentForm.reset();
            comprovanteInput.value = '';
            completionTimeAlert.classList.add('d-none');
            updateAvailableTimes();
            renderAppointmentsTable();
        }).catch(err => {
            // Network/server error: fallback to localStorage (previous behavior)
            console.warn('Falha ao enviar para o servidor, salvando localmente:', err);
            showAnnouncement(`Servidor indisponível: ${err.message || 'Tente novamente mais tarde.'}`, 'warning');
            if (file) {
                const reader = new FileReader();
                reader.onload = () => {
                    const newAppointment = { ...baseData, comprovanteDataUrl: reader.result, status: 'Reservado' };
                    appointments.push(newAppointment);
                    saveData();
                    showAnnouncement(`Agendamento salvo localmente (servidor indisponível).`,'warning');
                    appointmentForm.reset();
                    comprovanteInput.value = '';
                    completionTimeAlert.classList.add('d-none');
                    updateAvailableTimes();
                    renderAppointmentsTable();
                };
                reader.readAsDataURL(file);
            } else {
                appointments.push(baseData);
                saveData();
                showAnnouncement(`Agendamento salvo localmente (servidor indisponível).`,'warning');
                appointmentForm.reset();
                completionTimeAlert.classList.add('d-none');
                updateAvailableTimes();
                renderAppointmentsTable();
            }
        });
  });
  
  appointmentsTableBody.addEventListener('click', async (e) => {
      const target = e.target;
      const action = target.dataset.action;
      const id = target.dataset.id;
      if (!action) return;
      const list = (adminToken && serverAppointments) ? serverAppointments : appointments;
      const app = list.find(a => String(a.id) === String(id));

      if (action === 'view-proof') {
          // If server-backed and comprovaPath exists, fetch the file via protected endpoint
          if (adminToken && app && app.comprovantePath) {
              try {
                  const backend = (window.__BACKEND_URL__ || 'http://localhost:4000');
                  const res = await fetch(`${backend}/api/appointments/${id}/comprovante`, { headers: { Authorization: `Bearer ${adminToken}` } });
                  if (!res.ok) { showAnnouncement('Falha ao baixar comprovante.','danger'); return; }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  window.open(url, '_blank');
                  // release after some time
                  setTimeout(() => URL.revokeObjectURL(url), 60_000);
              } catch (err) {
                  showAnnouncement('Erro ao baixar comprovante.','danger');
              }
          } else if (app && app.comprovanteDataUrl) {
              window.open(app.comprovanteDataUrl, '_blank');
          }
      } else if (action === 'notify') {
          // Guarda o agendamento atual e prepara a mensagem padrão
          currentNotificationAppointment = app;
          const serviceName = services.find(s => s.id === app.servicoId)?.nome || 'serviço';
          const message = `Olá ${app.nomeCliente}, passando para confirmar seu agendamento de ${serviceName} para o dia ${new Date(app.data + 'T00:00:00').toLocaleDateString('pt-BR')} às ${app.horario}.`;
          
          // Preenche os dados no modal e o exibe
          whatsAppClientName.textContent = app.nomeCliente;
          whatsAppMessageTextarea.value = message;
          whatsAppModal.show();

      } else if (action === 'complete') {
          if (adminToken && app && app.id) {
              // mark locally for serverless entries, or call server to update if desired
              app.status = 'Concluído';
              showAnnouncement('Agendamento marcado como Concluído.');
          } else if (app) {
              app.status = 'Concluído';
              showAnnouncement('Agendamento marcado como Concluído.');
          }
      } else if (action === 'keep') {
          if (adminToken) {
              // call confirm endpoint
              try {
                  const backend = (window.__BACKEND_URL__ || 'http://localhost:4000');
                  const res = await fetch(`${backend}/api/appointments/${id}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` } });
                  if (!res.ok) { showAnnouncement('Falha ao confirmar agendamento.','danger'); return; }
                  showAnnouncement('Agendamento confirmado no servidor.');
                  await fetchAdminAppointments();
              } catch (err) {
                  showAnnouncement('Erro ao confirmar agendamento.','danger');
              }
          } else if (app) {
              app.status = 'Confirmado';
              showAnnouncement('Agendamento mantido/confirmado.');
          }
      } else if (action === 'pendent') {
          if (app) { app.status = 'Pendente'; showAnnouncement('Agendamento marcado como Pendente.'); }
      } else if (action === 'delete') {
          if (confirm(`Tem certeza que deseja excluir o agendamento de ${app.nomeCliente}?`)) {
              if (adminToken) {
                  try {
                      const backend = (window.__BACKEND_URL__ || 'http://localhost:4000');
                      const res = await fetch(`${backend}/api/appointments/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
                      if (!res.ok) { showAnnouncement('Falha ao excluir agendamento no servidor.','danger'); return; }
                      showAnnouncement('Agendamento excluído no servidor.','success');
                      await fetchAdminAppointments();
                  } catch (err) {
                      showAnnouncement('Erro ao excluir agendamento.','danger');
                  }
              } else {
                  appointments = appointments.filter(a => a.id !== id);
                  showAnnouncement('Agendamento excluído com sucesso.', 'danger');
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

      const message = whatsAppMessageTextarea.value;
      const phone = currentNotificationAppointment.telefoneCliente.replace(/\D/g, '');
      
      // Abre o WhatsApp em uma nova aba com a mensagem preenchida
      const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
      
      // Esconde o modal e limpa a referência do agendamento
      whatsAppModal.hide();
      currentNotificationAppointment = null;
  });

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
            const backend = (window.__BACKEND_URL__ || 'http://localhost:4000');
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
});
