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
  const AVAILABLE_TIMES = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
  // Variável para guardar o agendamento a ser notificado
  let currentNotificationAppointment = null;


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
    renderClientAppointments();
  };
  
  const renderAdminView = (activeTab = 'appointments') => {
      renderAppointmentsTable();
      renderServicesList();
      document.getElementById('admin-appointments-section').classList.toggle('d-none', activeTab !== 'appointments');
      document.getElementById('admin-services-section').classList.toggle('d-none', activeTab !== 'services');
      document.getElementById('show-appointments-btn').classList.toggle('btn-cyan', activeTab === 'appointments');
      document.getElementById('show-appointments-btn').classList.toggle('btn-secondary', activeTab !== 'appointments');
      document.getElementById('show-services-btn').classList.toggle('btn-cyan', activeTab === 'services');
      document.getElementById('show-services-btn').classList.toggle('btn-secondary', activeTab !== 'services');
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
          const timeDiv = document.createElement('div');
          timeDiv.className = `p-2 rounded text-center small ${isBooked ? 'bg-danger-subtle text-danger-emphasis' : 'bg-success-subtle text-success-emphasis'}`;
          timeDiv.innerHTML = `<span class="fw-bold">${time}</span><br>${isBooked ? 'Ocupado' : 'Disponível'}`;
          availableTimesGrid.appendChild(timeDiv);
          if (!isBooked) {
              const option = document.createElement('option');
              option.value = time;
              option.textContent = time;
              timeSelect.appendChild(option);
          }
      });
  };
  
  const renderAppointmentsTable = () => {
      appointmentsTableBody.innerHTML = '';
      if (appointments.length === 0) {
          appointmentsTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">Nenhum agendamento encontrado.</td></tr>';
          return;
      }
      const sortedAppointments = [...appointments].sort((a,b) => new Date(a.data).getTime() - new Date(b.data).getTime() || a.horario.localeCompare(b.horario));
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
                  ${app.comprovanteDataUrl ? `<button class="btn btn-sm btn-outline-info" data-action="view-proof" data-id="${app.id}">Ver Comprovante</button>` : ''}
              </td>
              <td>
                  <div class="d-flex flex-wrap gap-1">
                      <button class="btn btn-sm btn-info" data-action="notify" data-id="${app.id}">Notificar</button>
                      <button class="btn btn-sm ${app.status === 'Concluído' ? 'btn-success' : 'btn-outline-success'}" data-action="complete" data-id="${app.id}">Concluído</button>
                      <button class="btn btn-sm btn-outline-warning" data-action="pendent" data-id="${app.id}">Pendente</button>
                      <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${app.id}">Excluir</button>
                  </div>
              </td>
          `;
          appointmentsTableBody.appendChild(row);
      });
  };

      // Renderiza os agendamentos do cliente atual na view do cliente
      const clientAppointmentsList = document.getElementById('client-appointments-list');
      const renderClientAppointments = () => {
          clientAppointmentsList.innerHTML = '';
          const clientNameField = document.getElementById('nomeCliente');
          const clientName = clientNameField ? clientNameField.value.trim() : '';
          const myAppointments = appointments.filter(a => !clientName || a.nomeCliente === clientName);
          if (myAppointments.length === 0) {
              clientAppointmentsList.innerHTML = '<p class="text-secondary">Nenhum agendamento encontrado para seu nome.</p>';
              return;
          }
          myAppointments.sort((a,b) => new Date(a.data) - new Date(b.data));
          myAppointments.forEach(app => {
              const div = document.createElement('div');
              div.className = 'd-flex align-items-center justify-content-between gap-2 mb-2';
              div.innerHTML = `
                  <div>
                      <div><strong>${new Date(app.data + 'T00:00:00').toLocaleDateString('pt-BR')} ${app.horario}</strong></div>
                      <div class="text-secondary small">${(services.find(s=>s.id===app.servicoId)?.nome)||'N/A'}</div>
                  </div>
                  <div class="d-flex gap-2">
                      ${app.comprovanteDataUrl ? `<a href="${app.comprovanteDataUrl}" target="_blank" class="btn btn-sm btn-outline-info">Comprovante</a>` : `<label class="btn btn-sm btn-outline-primary mb-0">Enviar
                          <input type="file" accept="image/*,application/pdf" data-id="${app.id}" class="d-none proof-file-input">
                      </label>`}
                  </div>
              `;
              clientAppointmentsList.appendChild(div);
          });
          // attach listeners for file inputs
          document.querySelectorAll('.proof-file-input').forEach(input => {
              input.addEventListener('change', async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const id = parseInt(e.target.dataset.id);
                  const reader = new FileReader();
                  reader.onload = () => {
                      const dataUrl = reader.result;
                      const idx = appointments.findIndex(a => a.id === id);
                      if (idx === -1) return;
                      appointments[idx].comprovanteDataUrl = dataUrl;
                      appointments[idx].status = 'Aguardando Verificação';
                      saveData();
                      renderClientAppointments();
                      showAnnouncement('Comprovante enviado com sucesso. Aguardando verificação.');
                  };
                  reader.readAsDataURL(file);
              });
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
    const newAppointment = {
      id: Date.now(),
      nomeCliente: document.getElementById('nomeCliente').value,
      telefoneCliente: document.getElementById('telefoneCliente').value,
      servicoId: document.getElementById('servicoId').value,
      data: datePicker.value,
      horario: document.getElementById('horario').value,
      observacoes: document.getElementById('observacoes').value,
      status: 'Pendente'
    };
    appointments.push(newAppointment);
    saveData();
    showAnnouncement(`Agendamento para ${newAppointment.nomeCliente} realizado com sucesso!`);
    appointmentForm.reset();
    completionTimeAlert.classList.add('d-none');
    updateAvailableTimes();
        renderClientAppointments();
  });
  
  appointmentsTableBody.addEventListener('click', (e) => {
      const target = e.target;
      const action = target.dataset.action;
      const id = parseInt(target.dataset.id);
      if (!action) return;
      const app = appointments.find(a => a.id === id);

      if (action === 'view-proof') {
          if (app && app.comprovanteDataUrl) window.open(app.comprovanteDataUrl, '_blank');
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
          app.status = 'Concluído';
          showAnnouncement('Agendamento marcado como Concluído.');
      } else if (action === 'pendent') {
          app.status = 'Pendente';
          showAnnouncement('Agendamento marcado como Pendente.');
      } else if (action === 'delete') {
          if (confirm(`Tem certeza que deseja excluir o agendamento de ${app.nomeCliente}?`)) {
              appointments = appointments.filter(a => a.id !== id);
              showAnnouncement('Agendamento excluído com sucesso.', 'danger');
          }
      }
      saveData();
      renderAppointmentsTable();
      renderClientAppointments();
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
      const adminPasswordModalEl = document.getElementById('admin-password-modal');
      const adminPasswordModal = bootstrap.Modal.getInstance(adminPasswordModalEl);
      const hashed = await sha256Hex(input);
      if (hashed === ADMIN_PASSWORD_HASH) {
          // senha correta
          feedback.classList.add('d-none');
          adminPasswordModal.hide();
          switchView('admin');
      } else {
          // senha incorreta
          feedback.classList.remove('d-none');
      }
  });
});
