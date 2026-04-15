// ══════════════════════════════════════════════════
//  CONFIGURAÇÃO DE AGENTES
//  (metadados visuais — webhooks ficam só no server)
// ══════════════════════════════════════════════════
const AGENTS_META = {
  petshop: {
    name: 'Petshop',
    tag:  'Atendimento & Serviços',
    desc: 'Agendamentos, consultas e atendimento especializado para clientes de petshop.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"/></svg>`,
    welcome: `Olá! O agente **Petshop** está ativo. Posso ajudar com agendamentos de banho e tosa, consultas veterinárias e informações de produtos. Como posso te ajudar?`,
  },
  delivery: {
    name: 'Restaurante',
    tag:  'Pedidos & Reservas',
    desc: 'Pedidos para delivery, reservas de mesa e atendimento do GH Bar e Restaurante.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2l1.578 4.657A2 2 0 0 0 6.484 8H17.52a2 2 0 0 0 1.904-1.343L21 2"/><path d="M12 12v10"/><path d="M5 22h14"/><path d="M5 8v4a7 7 0 0 0 14 0V8"/></svg>`,
    welcome: `Olá! O agente **Restaurante** está ativo. Posso ajudar com pedidos para delivery ou reservar uma mesa no GH Bar e Restaurante. O que você prefere?`,
  },
  imobiliaria: {
    name: 'Imobiliária',
    tag:  'Imóveis & Visitas',
    desc: 'Consulta de imóveis disponíveis, agendamento de visitas e informações de contratos.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    welcome: `Olá! O agente **Imobiliária** está ativo. Posso apresentar imóveis disponíveis, agendar visitas e tirar dúvidas sobre contratos e documentação. Por onde começamos?`,
  },
  conc: {
    name: 'Concessionária',
    tag:  'Veículos & Negociação',
    desc: 'Consulta de estoque, simulação de financiamento e agendamento de test drive.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>`,
    welcome: `Olá! O agente **Concessionária** está ativo. Posso consultar nosso estoque de veículos, simular financiamentos e agendar um test drive. O que você gostaria de saber?`,
  },
};

// ══════════════════════════════════════════════════
//  ESTADO
// ══════════════════════════════════════════════════
let agents      = [];   // lista vinda da API /api/agents
let activeAgent = null; // { id, name, tag, desc, icon, welcome }
let messages    = [];
let isTyping    = false;
const chatHistories = {}; // histórico separado por agente { agentId: [] }

// ══════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════
async function init() {
  bindEvents();
  await loadAgents();
}

async function loadAgents() {
  try {
    const res  = await fetch('/api/agents');
    const data = await res.json(); // [{ id, name }]
    agents = data.map(a => ({ id: a.id, ...AGENTS_META[a.id] })).filter(a => a.name);
    renderSidebar();
    renderGrid();
    document.getElementById('agent-count').textContent = agents.length;
  } catch (err) {
    console.error('[loadAgents]', err);
  }
}

// ══════════════════════════════════════════════════
//  BIND EVENTS
// ══════════════════════════════════════════════════
function bindEvents() {
  document.getElementById('orch-pill').addEventListener('click', goToOrchestrator);
  document.getElementById('bc-home').addEventListener('click', goToOrchestrator);
  document.getElementById('end-btn').addEventListener('click', endSession);
  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('hamburger-btn').addEventListener('click', openSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  const input = document.getElementById('chat-input');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
  });
}

// ══════════════════════════════════════════════════
//  SIDEBAR MOBILE
// ══════════════════════════════════════════════════
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  const overlay = document.getElementById('sidebar-overlay');
  overlay.style.display = 'block';
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  overlay.classList.remove('open');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

// ══════════════════════════════════════════════════
//  RENDER SIDEBAR
// ══════════════════════════════════════════════════
function renderSidebar() {
  document.getElementById('agents-list').innerHTML = agents.map(a => `
    <div class="agent-card ${activeAgent?.id === a.id ? 'active' : ''}"
         data-id="${a.id}" role="button" tabindex="0">
      <div class="ac-top">
        <div class="ac-icon">${a.icon}</div>
        <div class="ac-info">
          <div class="ac-name">${a.name}</div>
          <div class="ac-tag">${a.tag}</div>
        </div>
        <span class="ac-badge ${activeAgent?.id === a.id ? 'running' : 'available'}">
          ${activeAgent?.id === a.id ? 'Ativo' : 'Livre'}
        </span>
      </div>
      <div class="ac-desc">${a.desc}</div>
    </div>
  `).join('');

  document.querySelectorAll('.agent-card').forEach(card => {
    card.addEventListener('click', () => activateAgent(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') activateAgent(card.dataset.id); });
  });
}

// ══════════════════════════════════════════════════
//  RENDER GRID
// ══════════════════════════════════════════════════
function renderGrid() {
  document.getElementById('agents-grid').innerHTML = agents.map(a => `
    <div class="grid-card" data-id="${a.id}" role="button" tabindex="0">
      <div class="gc-icon">${a.icon}</div>
      <div class="gc-name">${a.name}</div>
      <div class="gc-desc">${a.desc}</div>
      <div class="gc-footer">
        <span class="gc-avail">
          <div style="width:5px;height:5px;border-radius:50%;background:#22c55e;"></div>
          Disponível
        </span>
        <div class="gc-arrow">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.grid-card').forEach(card => {
    card.addEventListener('click', () => activateAgent(card.dataset.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') activateAgent(card.dataset.id); });
  });
}

// ══════════════════════════════════════════════════
//  ATIVAR AGENTE
// ══════════════════════════════════════════════════
function activateAgent(id) {
  // Ignorar se já é o agente ativo
  if (activeAgent?.id === id) return;

  const agent = agents.find(a => a.id === id);
  if (!agent) return;

  // Salvar histórico do agente anterior
  if (activeAgent) {
    chatHistories[activeAgent.id] = messages;
  }

  activeAgent = agent;

  // Carregar histórico existente ou iniciar novo
  if (chatHistories[agent.id]) {
    messages = chatHistories[agent.id];
  } else {
    messages = [];
  }

  if (window.innerWidth <= 900) closeSidebar();

  // Breadcrumb
  document.getElementById('bc-sep').style.display   = 'inline';
  document.getElementById('bc-agent').style.display = 'inline';
  document.getElementById('bc-agent').textContent   = agent.name;

  // Chip + botão encerrar
  document.getElementById('chip-name').textContent = agent.name;
  document.getElementById('active-chip').classList.add('show');
  document.getElementById('end-btn').classList.add('show');

  // Orquestrador → inativo
  document.getElementById('orch-pill').classList.remove('active');
  document.getElementById('orch-dot').classList.remove('pulse');

  // Banner do chat
  document.getElementById('cb-icon').innerHTML        = agent.icon;
  document.getElementById('cb-name-text').textContent = agent.name;
  document.getElementById('cb-desc-text').textContent = agent.desc;

  renderSidebar();
  showView('chat');

  // Cancelar typing anterior e limpar área imediatamente
  hideTyping();
  document.getElementById('messages-area').innerHTML = '';
  renderMessages();

  // Se não tem histórico, pedir apresentação à IA
  if (messages.length === 0) {
    const initAgentId = agent.id;
    setTimeout(async () => {
      showTyping();
      try {
        const res = await fetch(`/api/chat/${initAgentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'olá', init: true }),
        });
        const data = await res.json();
        const reply = data.reply || 'Olá! Como posso ajudar?';
        await typingDelay(reply);

        // Se o agente mudou enquanto esperava, salvar no histórico correto sem renderizar
        if (activeAgent?.id !== initAgentId) {
          const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          if (!chatHistories[initAgentId]) chatHistories[initAgentId] = [];
          chatHistories[initAgentId].push({ role: 'ai', text: reply, time });
          hideTyping();
          return;
        }

        hideTyping();
        addMessage('ai', reply);
      } catch {
        if (activeAgent?.id !== initAgentId) { hideTyping(); return; }
        hideTyping();
        addMessage('ai', agent.welcome);
      }
    }, 200);
  }

  setTimeout(() => document.getElementById('chat-input').focus(), 350);
}

// ══════════════════════════════════════════════════
//  ENCERRAR
// ══════════════════════════════════════════════════
function endSession()      { goToOrchestrator(); }
function goToOrchestrator() {
  // Salvar histórico do agente atual antes de sair
  if (activeAgent) {
    chatHistories[activeAgent.id] = messages;
  }
  activeAgent = null;
  messages = [];

  document.getElementById('bc-sep').style.display   = 'none';
  document.getElementById('bc-agent').style.display = 'none';
  document.getElementById('active-chip').classList.remove('show');
  document.getElementById('end-btn').classList.remove('show');

  document.getElementById('orch-pill').classList.add('active');
  document.getElementById('orch-dot').classList.add('pulse');

  renderSidebar();
  showView('orchestrator');
}

// ══════════════════════════════════════════════════
//  DELAY DE DIGITAÇÃO (proporcional ao texto)
// ══════════════════════════════════════════════════
function typingDelay(text) {
  // ~30ms por caractere, mínimo 800ms, máximo 3000ms
  const ms = Math.min(3000, Math.max(800, text.length * 30));
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ══════════════════════════════════════════════════
//  ENVIAR MENSAGEM
// ══════════════════════════════════════════════════
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text || isTyping) return;

  const sendAgentId = activeAgent.id;
  addMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  showTyping();
  try {
    const res  = await fetch(`/api/chat/${sendAgentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    const reply = data.reply || data.error || 'Sem resposta.';
    await typingDelay(reply);

    if (activeAgent?.id !== sendAgentId) {
      const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (!chatHistories[sendAgentId]) chatHistories[sendAgentId] = [];
      chatHistories[sendAgentId].push({ role: 'ai', text: reply, time });
      hideTyping();
      return;
    }

    hideTyping();
    addMessage('ai', reply, data.images || null);
  } catch {
    if (activeAgent?.id !== sendAgentId) { hideTyping(); return; }
    hideTyping();
    addMessage('ai', 'Erro de conexão. Tente novamente.');
  }
}

// ══════════════════════════════════════════════════
//  MENSAGENS
// ══════════════════════════════════════════════════
function addMessage(role, text, images) {
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  messages.push({ role, text, time, images: images || null });
  // Salvar dados para expand
  if (images) images.forEach(p => { _galleryData[p.ref] = p; });
  renderMessages();
}

function renderMessages() {
  const area  = document.getElementById('messages-area');
  const aName = activeAgent?.name ?? 'Agente';

  area.innerHTML = messages.map((m, i) => {
    const ai    = m.role === 'ai';
    const isNew = i === messages.length - 1;
    return `
      <div class="msg-row ${ai ? '' : 'user-row'} ${isNew ? 'fade-in' : ''}">
        <div class="msg-av ${ai ? 'ai' : 'hu'}">
          ${ai ? iconAI() : iconUser()}
        </div>
        <div class="msg-body">
          <div class="msg-sender">${ai ? aName : 'Você'}</div>
          <div class="msg-bubble ${ai ? 'ai-msg' : 'usr-msg'}">${fmt(m.text)}</div>
          ${ai && m.images ? renderImageGallery(m.images) : ''}
          <div class="msg-time">${m.time}</div>
        </div>
      </div>`;
  }).join('');

  scrollBottom();
}

function showTyping() {
  isTyping = true;
  const area = document.getElementById('messages-area');
  const row  = document.createElement('div');
  row.id = 'typing-row';
  row.className = 'msg-row fade-in';
  row.innerHTML = `
    <div class="msg-av ai">${iconAI()}</div>
    <div class="typing-bub"><div class="td"></div><div class="td"></div><div class="td"></div></div>`;
  area.appendChild(row);
  scrollBottom();
}

function hideTyping() {
  isTyping = false;
  document.getElementById('typing-row')?.remove();
}

function scrollBottom() {
  const a = document.getElementById('messages-area');
  setTimeout(() => a.scrollTo({ top: a.scrollHeight, behavior: 'smooth' }), 40);
}

// ══════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
}

function fmt(t) {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[IMG:[^\]]*\]/gi, '')
    .replace(/REF-\d+/gi, '')
    .replace(/\n/g, '<br/>');
}

// Renderizar galeria de imagens quando o servidor envia
function renderImageGallery(imagesData) {
  if (!imagesData || imagesData.length === 0) return '';

  return imagesData.map(property => {
    const preview = property.images.slice(0, 3);
    const hasMore = property.images.length > 3;
    const galleryId = `gallery-${property.ref}-${Date.now()}`;

    return `
      <div class="chat-gallery" id="${galleryId}">
        <div class="gallery-header">${property.name}</div>
        <div class="gallery-strip">
          ${preview.map(img => `
            <div class="gallery-thumb" onclick="openImageModal('${img.url}', '${img.label} — ${property.name}')">
              <img src="${img.url}" alt="${img.label}" loading="lazy" />
              <span class="gallery-thumb-label">${img.label}</span>
            </div>
          `).join('')}
          ${hasMore ? `<div class="gallery-more" data-ref="${property.ref}" data-gallery="${galleryId}" onclick="expandGallery(this)">+${property.images.length - 3} fotos</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// Cache para expand
const _galleryData = {};

function expandGallery(btn) {
  const ref = btn.dataset.ref;
  const galleryId = btn.dataset.gallery;
  const data = _galleryData[ref];
  const el = document.getElementById(galleryId);
  if (!el || !data) return;

  el.innerHTML = `
    <div class="gallery-header">${data.name}</div>
    <div class="gallery-grid">
      ${data.images.map(img => `
        <div class="gallery-thumb" onclick="openImageModal('${img.url}', '${img.label} — ${data.name}')">
          <img src="${img.url}" alt="${img.label}" loading="lazy" />
          <span class="gallery-thumb-label">${img.label}</span>
        </div>
      `).join('')}
    </div>`;

  scrollBottom();
}

function openImageModal(url, title) {
  const existing = document.getElementById('img-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'img-modal';
  modal.className = 'img-modal';
  modal.onclick = () => modal.remove();
  modal.innerHTML = `
    <div class="img-modal-content" onclick="event.stopPropagation()">
      <img src="${url}" alt="${title}" />
      <div class="img-modal-title">${title}</div>
      <button class="img-modal-close" onclick="document.getElementById('img-modal').remove()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  document.body.appendChild(modal);
}

function iconAI() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`;
}
function iconUser() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
}

// ── Start ──
init();
