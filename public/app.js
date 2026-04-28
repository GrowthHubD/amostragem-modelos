// ══════════════════════════════════════════════════
//  SUPABASE / AUTH
// ══════════════════════════════════════════════════
const SUPABASE_URL      = 'https://buiwcxygokdbmsdhquee.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aXdjeHlnb2tkYm1zZGhxdWVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDMyMjQsImV4cCI6MjA5MjI3OTIyNH0.mBEAYhaUv6yBMnshslBN4kaU3g0x9YvGVk2U1uDy67w';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SESSION_KEY  = 'sv_session';
const REMEMBER_KEY = 'sv_login_remember';

function getRemembered() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function setRemembered(username, password) {
  localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, password }));
}
function clearRemembered() { localStorage.removeItem(REMEMBER_KEY); }

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.token || !s?.expires_at) return null;
    if (new Date(s.expires_at).getTime() <= Date.now()) { clearSession(); return null; }
    return s;
  } catch { return null; }
}
function setSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

async function loginRpc(username, password) {
  const { data, error } = await sb.rpc('fn_login', { p_username: username, p_password: password });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0]; // { token, role, expires_at, username }
}

async function validateSessionRpc(token) {
  const { data, error } = await sb.rpc('fn_validate_session', { p_token: token });
  if (error) throw error;
  return data?.[0] ?? { valid: false };
}

async function logoutRpc(token) {
  try { await sb.rpc('fn_logout', { p_token: token }); } catch {}
}

let heartbeatTimer = null;

// Retorna true se a sessão atual ainda é válida. Se não for, dispara forceLogout
// e retorna false. Usado pelo heartbeat, por visibilitychange e antes de ações
// que gastam recurso (chat) pra evitar uso com sessão revogada.
async function checkSessionOrLogout() {
  const s = getSession();
  if (!s) return false;
  try {
    const v = await validateSessionRpc(s.token);
    if (!v.valid) { await forceLogout(); return false; }
    if (v.expires_at && v.expires_at !== s.expires_at) {
      setSession({ ...s, expires_at: v.expires_at });
    }
    return true;
  } catch {
    // falha de rede — não deslogar, só deixa o próximo tick tentar
    return true;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  // Primeiro check imediato + intervalo curto pra reagir rápido a revogações
  checkSessionOrLogout();
  heartbeatTimer = setInterval(checkSessionOrLogout, 5000);
}
function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

// Revalida imediatamente ao voltar pra aba/janela — evita esperar o próximo tick
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && getSession()) checkSessionOrLogout();
});
window.addEventListener('focus', () => {
  if (getSession()) checkSessionOrLogout();
});

// Limpa todo o estado de chat do cliente. Chamado no logout pra evitar
// vazamento de histórico/memória entre contas no mesmo tab.
function resetChatState() {
  activeAgent = null;
  messages = [];
  for (const k of Object.keys(chatHistories)) delete chatHistories[k];
  const area = document.getElementById('messages-area');
  if (area) area.innerHTML = '';
  const input = document.getElementById('chat-input');
  if (input) { input.value = ''; input.style.height = 'auto'; }
}

async function forceLogout() {
  const s = getSession();
  if (s?.token) await logoutRpc(s.token);
  clearSession();
  stopHeartbeat();
  resetChatState();
  // Marca pra não auto-relogar (logout manual ou sessão expirada)
  sessionStorage.setItem('sv_skip_autologin', '1');
  history.replaceState({ view: 'login' }, '', '/login');
  renderAuthUI();
  showView('login');
}

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
  bindAuthEvents();
  await loadAgents();
  renderAuthUI();

  const path = location.pathname;
  const session = getSession();

  if (path === '/login') {
    if (session) return goTo('/');
    return showView('login');
  }

  if (!session) {
    history.replaceState({ view: 'login' }, '', '/login');
    showView('login');
    if (getRemembered() && !sessionStorage.getItem('sv_skip_autologin')) {
      sessionStorage.setItem('sv_skip_autologin', '1');
      setTimeout(() => document.getElementById('login-form').requestSubmit(), 100);
    }
    return;
  }

  startHeartbeat();

  if (path === '/admin') {
    if (session.role !== 'admin') return goTo('/');
    history.replaceState({ view: 'admin' }, '', '/admin');
    showView('admin');
    refreshAdminTable();
    return;
  }

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
    showView('orchestrator');
  }

  window.addEventListener('popstate', (e) => {
    const session = getSession();
    if (!session) { showView('login'); return; }
    const state = e.state || { view: 'orchestrator' };
    if (state.view === 'login')       { showView('login'); return; }
    if (state.view === 'admin') {
      if (session.role === 'admin') { showView('admin'); refreshAdminTable(); }
      else goTo('/');
      return;
    }
    if (state.view === 'agent' && state.id) {
      if (activeAgent?.id !== state.id) activateAgent(state.id, true);
    } else {
      if (activeAgent) goToOrchestrator(true);
      else showView('orchestrator');
    }
  });
}

function parsePathAgent() {
  const m = location.pathname.match(/^\/([a-z0-9_-]+)$/i);
  if (!m) return null;
  if (m[1] === 'login' || m[1] === 'admin') return null;
  return m[1];
}

function goTo(path) {
  history.pushState({ view: path === '/admin' ? 'admin' : path === '/login' ? 'login' : 'orchestrator' }, '', path);
  // Dispara reavaliação
  if (path === '/login') { showView('login'); return; }
  if (path === '/admin') {
    const s = getSession();
    if (s?.role === 'admin') { showView('admin'); refreshAdminTable(); }
    else showView('orchestrator');
    return;
  }
  if (activeAgent) goToOrchestrator(true);
  else showView('orchestrator');
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
        const s = getSession();
        const res = await fetch(`/api/chat/${initAgentId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(s?.token ? { 'x-session-id': s.token } : {}),
          },
          body: JSON.stringify({ message: 'olá', init: true, history: [] }),
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
// Converte o formato interno (messages[]) pro formato que o worker/server espera
function buildHistoryForApi(msgs) {
  return msgs.map(m => ({
    role: m.role === 'ai' ? 'assistant' : 'user',
    content: m.text,
  }));
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text || isTyping) return;

  // Revalida sessão antes de consumir token — se foi revogada, boot imediato
  const stillValid = await checkSessionOrLogout();
  if (!stillValid) return;

  const sendAgentId = activeAgent.id;
  // Captura histórico ANTES de adicionar a msg atual (worker adiciona user msg do campo message)
  const historySnapshot = buildHistoryForApi(messages);
  addMessage('user', text);
  input.value = '';
  input.style.height = 'auto';

  showTyping();
  try {
    const s = getSession();
    const res  = await fetch(`/api/chat/${sendAgentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(s?.token ? { 'x-session-id': s.token } : {}),
      },
      body: JSON.stringify({ message: text, history: historySnapshot }),
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
  document.body.classList.toggle('is-login', name === 'login');
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

// ══════════════════════════════════════════════════
//  AUTH UI — eventos e handlers
// ══════════════════════════════════════════════════
function bindAuthEvents() {
  document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
  document.getElementById('footer-logout').addEventListener('click', handleLogoutClick);
  document.getElementById('sidebar-admin-link').addEventListener('click', (e) => {
    e.preventDefault();
    goTo('/admin');
  });
  document.getElementById('admin-create-form').addEventListener('submit', handleCreateTempSubmit);
  document.getElementById('admin-refresh').addEventListener('click', refreshAdminTable);
  prefillLoginFromRemembered();
}

function prefillLoginFromRemembered() {
  const r = getRemembered();
  if (!r) return;
  document.getElementById('login-username').value = r.username || '';
  document.getElementById('login-password').value = r.password || '';
  document.getElementById('login-remember').checked = true;
}

function renderAuthUI() {
  const s = getSession();
  const logoutBtn = document.getElementById('footer-logout');
  const adminLink = document.getElementById('sidebar-admin-link');
  const footerText = document.getElementById('footer-text');

  if (!s) {
    logoutBtn.style.display = 'none';
    adminLink.style.display = 'none';
    footerText.textContent = '';
    return;
  }

  logoutBtn.style.display = 'inline-flex';
  adminLink.style.display = (s.role === 'admin') ? 'flex' : 'none';
  const who = s.role === 'admin' ? 'admin' : 'convidado';
  footerText.innerHTML = `<span style="opacity:.7">${who} ·</span> <span id="agent-count">${agents.length || '—'}</span> agentes`;
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');
  const submit   = document.getElementById('login-submit');
  const submitTx = document.getElementById('login-submit-text');

  errorEl.style.display = 'none';
  submit.disabled = true;
  submitTx.textContent = 'Entrando…';

  try {
    const session = await loginRpc(username, password);
    if (!session) {
      errorEl.textContent = 'Usuário ou senha inválidos.';
      errorEl.style.display = 'block';
      return;
    }
    setSession(session);
    if (document.getElementById('login-remember').checked) {
      setRemembered(username, password);
    } else {
      clearRemembered();
    }
    document.getElementById('login-password').value = '';
    // Garante isolamento de histórico/memória entre contas no mesmo tab
    resetChatState();
    startHeartbeat();
    renderAuthUI();

    if (session.role === 'admin') goTo('/admin');
    else goTo('/');
  } catch (err) {
    errorEl.textContent = 'Erro ao autenticar. Tente novamente.';
    errorEl.style.display = 'block';
    console.error('[login]', err);
  } finally {
    submit.disabled = false;
    submitTx.textContent = 'Entrar';
  }
}

async function handleLogoutClick() {
  await forceLogout();
}

async function refreshAdminTable() {
  const s = getSession();
  const tbl = document.getElementById('admin-table');
  if (!s || s.role !== 'admin') { tbl.innerHTML = ''; return; }
  tbl.innerHTML = '<div class="admin-empty">Carregando…</div>';
  try {
    const { data, error } = await sb.rpc('fn_list_temp_logins', { p_token: s.token });
    if (error) throw error;
    if (!data || data.length === 0) {
      tbl.innerHTML = '<div class="admin-empty">Nenhuma credencial ativa no momento.</div>';
      return;
    }
    tbl.innerHTML = data.map(t => {
      const expDate = new Date(t.expires_at);
      const msLeft = expDate.getTime() - Date.now();
      const left = formatDurationLeft(msLeft);
      const when = (msLeft > 24 * 3600 * 1000)
        ? expDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + expDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : expDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="admin-row" data-id="${t.id}">
          <div class="admin-row-main">
            <div class="admin-row-user">${escapeHtml(t.username)}</div>
            <div class="admin-row-meta">expira em ${left} · ${when}</div>
          </div>
          <button class="admin-row-del" data-id="${t.id}" title="Revogar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>`;
    }).join('');
    tbl.querySelectorAll('.admin-row-del').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteTemp(btn.dataset.id));
    });
  } catch (err) {
    console.error('[admin list]', err);
    tbl.innerHTML = '<div class="admin-empty">Erro ao carregar. Faça login novamente.</div>';
  }
}

async function handleCreateTempSubmit(e) {
  e.preventDefault();
  const s = getSession();
  if (!s || s.role !== 'admin') return;

  const username = document.getElementById('admin-new-username').value.trim();
  const password = document.getElementById('admin-new-password').value;
  const amount   = parseInt(document.getElementById('admin-new-amount').value, 10) || 10;
  const unit     = document.getElementById('admin-new-unit').value;
  const unitMul  = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1;
  const minutes  = amount * unitMul;
  const unitLabel = unit === 'days' ? (amount === 1 ? 'dia' : 'dias')
                  : unit === 'hours' ? (amount === 1 ? 'hora' : 'horas')
                  : (amount === 1 ? 'minuto' : 'minutos');

  const errorEl = document.getElementById('admin-error');
  const toastEl = document.getElementById('admin-toast');
  const btn     = document.getElementById('admin-create-btn');

  errorEl.style.display = 'none';
  toastEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Criando…';

  try {
    const { error } = await sb.rpc('fn_create_temp_login', {
      p_token: s.token, p_username: username, p_password: password, p_minutes: minutes,
    });
    if (error) throw error;
    toastEl.innerHTML = `
      <div class="toast-title">Credencial criada ✓</div>
      <div class="toast-body">
        <div><strong>Usuário:</strong> ${escapeHtml(username)}</div>
        <div><strong>Senha:</strong> <code>${escapeHtml(password)}</code></div>
        <div><strong>Expira em:</strong> ${amount} ${unitLabel}</div>
      </div>`;
    toastEl.style.display = 'block';
    document.getElementById('admin-create-form').reset();
    document.getElementById('admin-new-amount').value = '10';
    document.getElementById('admin-new-unit').value = 'minutes';
    refreshAdminTable();
  } catch (err) {
    errorEl.textContent = (err?.message || 'Erro ao criar').replace(/^.*Nao autorizado.*$/i, 'Sessão expirada — faça login de novo.');
    errorEl.style.display = 'block';
    console.error('[create temp]', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar credencial';
  }
}

async function handleDeleteTemp(id) {
  const s = getSession();
  if (!s || s.role !== 'admin') return;
  if (!confirm('Revogar esta credencial agora?')) return;
  try {
    const { error } = await sb.rpc('fn_delete_temp_login', { p_token: s.token, p_temp_id: id });
    if (error) throw error;
    refreshAdminTable();
  } catch (err) {
    alert('Erro ao revogar: ' + (err?.message || 'desconhecido'));
  }
}

function formatDurationLeft(ms) {
  if (ms <= 0) return 'expirado';
  const min = Math.round(ms / 60000);
  if (min < 60)        return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48)          return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} dias`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Start ──
init();
