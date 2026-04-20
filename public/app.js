// ══════════════════════════════════════════════════
//  CONFIGURAÇÃO DE AGENTES
//  (metadados visuais — webhooks ficam só no server)
// ══════════════════════════════════════════════════
const AGENTS_META = {
  petshop: {
    name: 'Petshop',
    tag:  'Atendimento & Serviços',
    desc: 'Agendamentos, consultas e atendimento especializado para clientes de petshop.',
    features: ['Agenda banho e tosa', 'Valida vacinas e raças', 'Atendimento carinhoso'],
    pitchTitle: 'Alice, a recepcionista que cuida do seu pet',
    pitchBody: 'Reconhece raças de pelagem dupla, confirma vacinas e fecha banho + tosa em poucos turnos. Atende com o carinho de uma humana e a precisão de um sistema.',
    pitchCta: 'Agende um banho para um Golden e veja a diferença.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"/><path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"/><path d="M8 14v.5"/><path d="M16 14v.5"/><path d="M11.25 16.25h1.5L12 17l-.75-.75z"/><path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"/></svg>`,
    welcome: `Olá! O agente **Petshop** está ativo. Posso ajudar com agendamentos de banho e tosa, consultas veterinárias e informações de produtos. Como posso te ajudar?`,
  },
  delivery: {
    name: 'Restaurante',
    tag:  'Pedidos & Reservas',
    desc: 'Pedidos para delivery, reservas de mesa e atendimento do GH Bar e Restaurante.',
    features: ['Cardápio com preços', 'Delivery e reserva', 'Promoções e rodízio'],
    pitchTitle: 'Atendimento completo do GH Bar e Restaurante',
    pitchBody: 'Conhece o cardápio inteiro, informa preços na hora, fecha pedidos de delivery e reserva mesas sem precisar de ligação. Ágil como um atendente experiente no horário de pico.',
    pitchCta: 'Pergunte o valor do rodízio ou peça uma calabresa.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2l1.578 4.657A2 2 0 0 0 6.484 8H17.52a2 2 0 0 0 1.904-1.343L21 2"/><path d="M12 12v10"/><path d="M5 22h14"/><path d="M5 8v4a7 7 0 0 0 14 0V8"/></svg>`,
    welcome: `Olá! O agente **Restaurante** está ativo. Posso ajudar com pedidos para delivery ou reservar uma mesa no GH Bar e Restaurante. O que você prefere?`,
  },
  imobiliaria: {
    name: 'Imobiliária',
    tag:  'Imóveis & Visitas',
    desc: 'Consulta de imóveis disponíveis, agendamento de visitas e informações de contratos.',
    features: ['Catálogo real de imóveis', 'Envia fotos dos ambientes', 'Agenda visita guiada'],
    pitchTitle: 'Vitor, o corretor que nunca dorme',
    pitchBody: 'Apresenta imóveis do catálogo real, envia fotos de cada ambiente e agenda a visita no mesmo fluxo. Conduz o lead com a leveza de um corretor top line no WhatsApp.',
    pitchCta: 'Peça fotos do Audace Rebouças e agende uma visita.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    welcome: `Olá! O agente **Imobiliária** está ativo. Posso apresentar imóveis disponíveis, agendar visitas e tirar dúvidas sobre contratos e documentação. Por onde começamos?`,
  },
  conc: {
    name: 'GH iStore',
    tag:  'iPhones & Acessórios',
    desc: 'Consultoria personalizada para escolha de iPhone e agendamento na loja.',
    features: ['Consultoria por perfil de uso', 'Fotos reais dos modelos', 'Agendamento na loja'],
    pitchTitle: 'Nina encontra o iPhone certo. Você só vai buscar.',
    pitchBody: 'Ela entende seu perfil, apresenta as melhores opções com especificações reais, tira todas as dúvidas e agenda seu horário na loja. Tudo numa conversa de WhatsApp.',
    pitchCta: 'Me diz qual modelo você tem interesse e veja a Nina em ação.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    welcome: `Olá! O agente **GH iStore** está ativo. Posso ajudar na escolha do iPhone ideal, apresentar especificações, preços e agendar seu horário na loja. Por onde começamos?`,
  },
  odonto: {
    name: 'Odonto',
    tag:  'Consultas & Procedimentos',
    desc: 'Agendamento de consultas, avaliações e procedimentos odontológicos.',
    features: ['Clareamento e aparelho', 'Cadastro sem burocracia', 'Tom acolhedor e humano'],
    pitchTitle: 'Jéssica, a secretária que acolhe antes de agendar',
    pitchBody: 'Coleta os dados sem pressão, conversa com empatia e fecha o agendamento de clareamento, extração ou manutenção de aparelho. Atendimento humanizado de uma clínica premium.',
    pitchCta: 'Marque uma consulta de clareamento e sinta o acolhimento.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5c-1.5-2-4-2.5-5.5-1S4 7 5.5 9c1.5 2 3 4.5 3 7.5 0 2 1 3 1.5 3s1-1 1-3v0c0 2 .5 3 1 3s1.5-1 1.5-3c0-3 1.5-5.5 3-7.5S19 5 17.5 4.5 13.5 3.5 12 5.5z"/></svg>`,
    welcome: `Olá! O agente **Odonto** está ativo. Posso ajudar com agendamento de consultas, avaliações e informações sobre procedimentos odontológicos. Como posso te ajudar?`,
  },
  hotel: {
    name: 'Hotel',
    tag:  'Reservas & Suítes',
    desc: 'Reserva de suítes, consulta de disponibilidade e pacotes especiais do GH Hotéis.',
    features: ['Suítes premium', 'Adicionais e combos', 'Closer que fecha rápido'],
    pitchTitle: 'Lucas não atende. Lucas vende.',
    pitchBody: 'Closer de verdade: conduz cada conversa até o fechamento com suítes premium, adicionais e combos. Cria urgência, contorna objeções e fecha em poucas mensagens.',
    pitchCta: 'Diga que quer uma suíte pra hoje e veja um closer em ação.',
    icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
    welcome: `Olá! O agente **Hotel** está ativo. Posso ajudar com reservas de suítes, disponibilidade e pacotes especiais do GH Hotéis. Vamos encontrar a suíte perfeita?`,
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
  initHistory();
}

// Browser history — voltar/avançar com botões do browser
function initHistory() {
  // Estado inicial
  const initialId = parsePathAgent();
  if (initialId && agents.find(a => a.id === initialId)) {
    history.replaceState({ view: 'agent', id: initialId }, '', `/${initialId}`);
    activateAgent(initialId, true);
  } else {
    history.replaceState({ view: 'orchestrator' }, '', '/');
  }

  window.addEventListener('popstate', (e) => {
    const state = e.state || { view: 'orchestrator' };
    if (state.view === 'agent' && state.id) {
      if (activeAgent?.id !== state.id) activateAgent(state.id, true);
    } else {
      if (activeAgent) goToOrchestrator(true);
    }
  });
}

function parsePathAgent() {
  const m = location.pathname.match(/^\/([a-z0-9_-]+)$/i);
  return m ? m[1] : null;
}

async function loadAgents() {
  const ACTIVE_IDS = ['petshop', 'delivery', 'imobiliaria', 'conc', 'odonto', 'hotel'];
  agents = ACTIVE_IDS.map(id => ({ id, ...AGENTS_META[id] })).filter(a => a.name);
  renderSidebar();
  renderGrid();
  document.getElementById('agent-count').textContent = agents.length;
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
      <div class="gc-inner">
        <div class="gc-face gc-front">
          <div class="gc-head">
            <div class="gc-icon">${a.icon}</div>
            <span class="gc-tag-pill">${a.tag}</span>
          </div>
          <div class="gc-name">${a.name}</div>
          <div class="gc-desc">${a.desc}</div>
          <ul class="gc-features">
            ${(a.features || []).map(f => `
              <li>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span>${f}</span>
              </li>
            `).join('')}
          </ul>
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
        <div class="gc-face gc-back">
          <div class="gc-back-eyebrow">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
            Por que testar?
          </div>
          <div class="gc-back-title">${a.pitchTitle || a.name}</div>
          <div class="gc-back-body">${a.pitchBody || a.desc}</div>
          <div class="gc-back-cta">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            <span>${a.pitchCta || 'Clique para conversar'}</span>
          </div>
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
function activateAgent(id, fromPopState = false) {
  // Ignorar se já é o agente ativo
  if (activeAgent?.id === id) return;

  const agent = agents.find(a => a.id === id);
  if (!agent) return;

  // Salvar histórico do agente anterior
  if (activeAgent) {
    chatHistories[activeAgent.id] = messages;
  }

  activeAgent = agent;

  // Atualizar URL (se não foi o próprio popstate que disparou)
  if (!fromPopState) {
    history.pushState({ view: 'agent', id }, '', `/${id}`);
  }

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
function goToOrchestrator(fromPopState = false) {
  // Salvar histórico do agente atual antes de sair
  if (activeAgent) {
    chatHistories[activeAgent.id] = messages;
  }
  activeAgent = null;
  messages = [];

  // Atualizar URL (se não foi popstate que disparou)
  if (!fromPopState) {
    history.pushState({ view: 'orchestrator' }, '', '/');
  }

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

// ══════════════════════════════════════════════════
//  GALERIA DE IMAGENS (modular — reutilizável para qualquer agente)
// ══════════════════════════════════════════════════
const _galleryData = {};

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
          ${preview.map((img, idx) => `
            <div class="gallery-thumb" data-img-url="${encodeURIComponent(img.url)}" data-img-title="${encodeURIComponent(img.label + ' — ' + property.name)}">
              <img src="${img.url}" alt="${img.label}" loading="lazy" />
              <span class="gallery-thumb-label">${img.label}</span>
            </div>
          `).join('')}
          ${hasMore ? `<div class="gallery-more" data-expand-ref="${property.ref}" data-expand-gallery="${galleryId}">+${property.images.length - 3} fotos</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function expandGallery(ref, galleryId) {
  const data = _galleryData[ref];
  const el = document.getElementById(galleryId);
  if (!el || !data) return;

  el.innerHTML = `
    <div class="gallery-header">${data.name}</div>
    <div class="gallery-grid">
      ${data.images.map(img => `
        <div class="gallery-thumb" data-img-url="${encodeURIComponent(img.url)}" data-img-title="${encodeURIComponent(img.label + ' — ' + data.name)}">
          <img src="${img.url}" alt="${img.label}" loading="lazy" />
          <span class="gallery-thumb-label">${img.label}</span>
        </div>
      `).join('')}
    </div>
    <div class="gallery-collapse" data-collapse-ref="${ref}" data-collapse-gallery="${galleryId}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      Minimizar
    </div>`;

  scrollBottom();
}

function collapseGallery(ref, galleryId) {
  const data = _galleryData[ref];
  const el = document.getElementById(galleryId);
  if (!el || !data) return;

  const preview = data.images.slice(0, 3);
  const hasMore = data.images.length > 3;

  el.innerHTML = `
    <div class="gallery-header">${data.name}</div>
    <div class="gallery-strip">
      ${preview.map(img => `
        <div class="gallery-thumb" data-img-url="${encodeURIComponent(img.url)}" data-img-title="${encodeURIComponent(img.label + ' — ' + data.name)}">
          <img src="${img.url}" alt="${img.label}" loading="lazy" />
          <span class="gallery-thumb-label">${img.label}</span>
        </div>
      `).join('')}
      ${hasMore ? `<div class="gallery-more" data-expand-ref="${ref}" data-expand-gallery="${galleryId}">+${data.images.length - 3} fotos</div>` : ''}
    </div>`;
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

// Event delegation — um único listener para toda a galeria
document.addEventListener('click', (e) => {
  // Click em thumbnail → abrir modal
  const thumb = e.target.closest('.gallery-thumb');
  if (thumb && thumb.dataset.imgUrl) {
    e.preventDefault();
    openImageModal(decodeURIComponent(thumb.dataset.imgUrl), decodeURIComponent(thumb.dataset.imgTitle));
    return;
  }

  // Click em "+N fotos" → expandir galeria
  const more = e.target.closest('.gallery-more');
  if (more && more.dataset.expandRef) {
    e.preventDefault();
    expandGallery(more.dataset.expandRef, more.dataset.expandGallery);
    return;
  }

  // Click em "Minimizar" → colapsar galeria
  const collapse = e.target.closest('.gallery-collapse');
  if (collapse && collapse.dataset.collapseRef) {
    e.preventDefault();
    collapseGallery(collapse.dataset.collapseRef, collapse.dataset.collapseGallery);
    return;
  }
});

function iconAI() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`;
}
function iconUser() {
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
}

// ── Start ──
init();
