// ══════════════════════════════════════════════════
//  Canal WhatsApp (uazapi) — secretária, buffer e webhook
//
//  Fluxo: uazapi → POST /api/whatsapp/webhook/<secret> → Worker filtra
//  → Durable Object ChatBuffer (1 por contato) bufferiza (debounce por
//  alarm) → LLM via OpenRouter (sem fallback) → uazapi /send/text|media.
//
//  Config vem do Supabase (whatsapp_config, editada no /admin); o token
//  da uazapi só existe no banco e neste Worker — nunca vai ao browser.
// ══════════════════════════════════════════════════
import {
  AGENTS,
  buildAgentMessages,
  callOpenRouterOnly,
  detectCatalogImages,
  PROPERTY_NAME_MAP, PROPERTY_IMAGES, PROPERTY_AMBIGUOUS,
  IPHONE_NAME_MAP, IPHONE_IMAGES, IPHONE_AMBIGUOUS,
} from './chat.js';

// ──────────────────────────────────────────────────
// Secretária — recepcionista que roteia os 6 agentes
// ──────────────────────────────────────────────────

export const SECRETARIA_ID = 'secretaria';

// Ordem fixa: permite escolher por número ("3") sem passar pelo LLM
export const AGENT_ORDER = ['petshop', 'delivery', 'imobiliaria', 'conc', 'odonto', 'hotel'];

export const MENU_TEXT = `Olá! 👋 Aqui é a recepção da *Growth Hub*.

Este número é uma central de demonstração com 6 assistentes de IA:

1️⃣ *Petshop* — banho e tosa (GH Pets)
2️⃣ *Restaurante* — delivery e reserva de mesas (GH Bar e Restaurante)
3️⃣ *Imobiliária* — apartamentos em Curitiba (GH Imóveis)
4️⃣ *iPhones* — loja GH iStore
5️⃣ *Odonto* — consultas na clínica Vie Pratique
6️⃣ *Hotel* — reserva de suítes (GH Hotéis)

Responda com o *número* ou o *nome* da demonstração que você quer testar 😊
A qualquer momento, mande *menu* para voltar aqui.`;

export const SECRETARIA_PROMPT = `Você é a recepcionista virtual da Growth Hub no WhatsApp.
A Growth Hub cria assistentes de IA para empresas, e este número é uma central de demonstração com 6 assistentes:

1. petshop — GH Pets: agendamento de banho e tosa
2. delivery — GH Bar e Restaurante: pedidos de delivery e reserva de mesas
3. imobiliaria — GH Imóveis: apartamentos em Curitiba e agendamento de visitas
4. conc — GH iStore: venda de iPhones
5. odonto — Clínica Vie Pratique: agendamento de consultas odontológicas
6. hotel — GH Hotéis: reserva de suítes

Seu ÚNICO papel é dar boas-vindas, apresentar as opções numeradas e encaminhar a pessoa para o assistente escolhido. Você não atende nenhum outro assunto — só recepciona e encaminha.

REGRA DE ROTEAMENTO (crítica):
- Quando a pessoa escolher uma demonstração (por número, nome ou descrição), termine sua mensagem com a tag [[ROTEAR:id]] usando exatamente um destes ids: petshop, delivery, imobiliaria, conc, odonto, hotel.
- A tag é a ÚLTIMA coisa da mensagem e aparece no máximo uma vez. Exemplo: "Perfeito! Te conectando com a GH Pets 🐾 [[ROTEAR:petshop]]"
- Antes da tag, escreva no máximo uma frase curta de transição.
- NUNCA use a tag se a escolha não estiver clara — nesse caso pergunte de novo, listando as opções numeradas.
- Nunca mencione a tag nem os ids internos para a pessoa.

Estilo: acolhedora, direta, 1 a 3 frases, emojis com moderação.
Se a pessoa mandar apenas "oi" ou algo genérico, apresente a lista numerada das 6 opções.
Se perguntarem algo fora do escopo (preços da Growth Hub, falar com humano etc.), diga que um consultor da Growth Hub pode ajudar em seguida e volte a oferecer as demonstrações.`;

// Sufixo de canal: todo system prompt no WhatsApp recebe isto (FM-004)
export const WHATSAPP_SUFFIX = `

=== CANAL: WHATSAPP ===
Você está conversando pelo WhatsApp. Regras de formato:
- Texto puro. NÃO use markdown: nada de #, ##, tabelas, [links](url), blocos de código ou listas aninhadas.
- Para destacar, use *negrito* (um asterisco de cada lado), com moderação.
- Mensagens curtas, em tom de conversa de WhatsApp. Quebre informações longas em frases, nunca em tabelas.`;

const ERROR_TEXT = 'Tivemos um probleminha técnico aqui 🙏 Pode mandar sua mensagem de novo em instantes?';
const MEDIA_TEXT = 'Por aqui eu consigo ler só mensagens de texto 😊 Me conta por escrito como posso ajudar?';
const CAP_TEXT   = 'Nosso atendimento automático atingiu o limite de hoje 😅 Volte amanhã para testar as demonstrações!';

const ROUTE_TAG = /\[\[ROTEAR:([a-z0-9_-]+)\]\]/gi;

function normalize(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function parseRouteTag(reply) {
  let target = null;
  const text = reply.replace(ROUTE_TAG, (_, id) => {
    const clean = id.toLowerCase();
    if (AGENTS[clean]) target = clean;
    return '';
  }).trim();
  return { text, target };
}

// ──────────────────────────────────────────────────
// Supabase (service role) — config, prompts e uso
// ──────────────────────────────────────────────────

async function sbFetch(env, path, init = {}) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurada');
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} HTTP ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function sbGetWhatsAppConfig(env) {
  const rows = await sbFetch(env, '/rest/v1/whatsapp_config?id=eq.1&select=*');
  const overrides = await sbFetch(env, '/rest/v1/agent_prompt_overrides?select=agent_id,system_prompt');
  const cfg = rows?.[0];
  if (!cfg) throw new Error('whatsapp_config nao encontrada (rode a migracao)');
  cfg.prompt_overrides = Object.fromEntries((overrides || []).map(o => [o.agent_id, o.system_prompt]));
  return cfg;
}

async function sbBumpUsage(env) {
  return await sbFetch(env, '/rest/v1/rpc/fn_wa_bump_usage', { method: 'POST', body: '{}' });
}

export async function sbValidateAdminSession(env, token) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return false;
  try {
    const rows = await sbFetch(env, '/rest/v1/rpc/fn_validate_session', {
      method: 'POST',
      body: JSON.stringify({ p_token: token }),
    });
    const s = Array.isArray(rows) ? rows[0] : rows;
    return !!(s && s.valid && s.role === 'admin');
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────
// Cliente uazapi (token de instância; nunca admintoken)
// ──────────────────────────────────────────────────

function uazBase(cfg) {
  const url = (cfg.uazapi_url || '').replace(/\/+$/, '');
  if (!url) throw new Error('uazapi_url nao configurada');
  return url;
}

async function uaz(cfg, method, path, body) {
  const res = await fetch(`${uazBase(cfg)}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'token': cfg.uazapi_token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`uazapi ${path} HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function uazSendText(cfg, number, text, delayMs = 0) {
  const payload = { number, text, ...(delayMs > 0 && { delay: delayMs }), readchat: true };
  try {
    return await uaz(cfg, 'POST', '/send/text', payload);
  } catch (err) {
    console.error('[wa send retry]', err.message);
    return await uaz(cfg, 'POST', '/send/text', payload); // FM-003: 1 retry; falha final propaga
  }
}

async function uazSendImage(cfg, number, fileUrl, caption) {
  return await uaz(cfg, 'POST', '/send/media', { number, type: 'image', file: fileUrl, text: caption || '' });
}

function typingDelay(cfg, text) {
  const ms = (text?.length || 0) * (cfg.typing_ms_per_char || 35);
  return Math.max(cfg.typing_min_ms || 1000, Math.min(cfg.typing_max_ms || 5000, ms));
}

// ──────────────────────────────────────────────────
// Durable Object — 1 por contato (chatid)
// ──────────────────────────────────────────────────

export class ChatBuffer {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.cfgCache = null;
    this.cfgCacheAt = 0;
  }

  // Config com cache de 60s em memória (FB-001)
  async getConfig() {
    const now = Date.now();
    if (this.cfgCache && now - this.cfgCacheAt < 60_000) return this.cfgCache;
    this.cfgCache = await sbGetWhatsAppConfig(this.env);
    this.cfgCacheAt = now;
    return this.cfgCache;
  }

  async fetch(request) {
    const { msg, origin } = await request.json();
    const storage = this.ctx.storage;

    // Dedupe por messageid — o Worker é stateless, o dedupe mora AQUI (FA-002)
    const seen = (await storage.get('seenIds')) || [];
    if (msg.messageid && seen.includes(msg.messageid)) {
      return new Response('dup', { status: 200 });
    }
    if (msg.messageid) {
      seen.push(msg.messageid);
      await storage.put('seenIds', seen.slice(-200));
    }

    let cfg;
    try {
      cfg = await this.getConfig();
    } catch (err) {
      console.error('[wa config]', err.message);
      return new Response('cfg-error', { status: 200 });
    }
    if (!cfg.enabled) return new Response('disabled', { status: 200 });

    const now = Date.now();
    await storage.put('origin', origin);
    await storage.put('contact', { chatid: msg.chatid, name: msg.senderName || '' });

    // Timeout de inatividade → volta à secretária (FA-004)
    const lastActivity = await storage.get('lastActivity');
    const timeoutMs = (cfg.inactivity_timeout_min || 45) * 60_000;
    if (lastActivity && now - lastActivity > timeoutMs) {
      await storage.put('agentId', SECRETARIA_ID);
      await storage.put('history', []);
    }
    await storage.put('lastActivity', now);

    // Mídia recebida: resposta fixa imediata, sem buffer nem LLM (FM-001)
    const text = (msg.text || '').trim();
    if (!text) {
      const isAudio = /audio|ptt/i.test(msg.messageType || '');
      const fixed = isAudio ? (cfg.audio_reply_text || MEDIA_TEXT) : MEDIA_TEXT;
      try { await uazSendText(cfg, msg.chatid, fixed, typingDelay(cfg, fixed)); }
      catch (err) { console.error('[wa media reply]', err.message); }
      return new Response('media', { status: 200 });
    }

    // Comando "menu"/"voltar": reset por código, sem LLM (FA-004)
    if (['menu', 'voltar', 'inicio', 'sair', 'recomecar'].includes(normalize(text))) {
      await storage.put('agentId', SECRETARIA_ID);
      await storage.put('history', []);
      await storage.delete('pending');
      await storage.delete('firstPendingAt');
      await storage.delete('turn');
      await storage.deleteAlarm();
      try { await uazSendText(cfg, msg.chatid, MENU_TEXT, typingDelay(cfg, MENU_TEXT)); }
      catch (err) { console.error('[wa menu]', err.message); }
      return new Response('menu', { status: 200 });
    }

    // Buffer/debounce: acumula e (re)agenda o alarm
    const pending = (await storage.get('pending')) || [];
    pending.push({ id: msg.messageid, text });
    await storage.put('pending', pending);

    let firstAt = await storage.get('firstPendingAt');
    if (!firstAt) {
      firstAt = now;
      await storage.put('firstPendingAt', firstAt);
    }
    const alarmAt = Math.min(now + (cfg.buffer_silence_ms || 10000), firstAt + (cfg.buffer_max_ms || 25000));
    await this.ctx.storage.setAlarm(alarmAt);

    return new Response('buffered', { status: 200 });
  }

  // Cloudflare RE-EXECUTA alarm que lança exceção → tudo aqui é idempotente
  // (turn com stage 'gerado' evita resposta duplicada — FA-003) e erros de
  // LLM/envio são tratados SEM lançar (evita loop de retry — FM-002).
  async alarm() {
    const storage = this.ctx.storage;
    const pending = (await storage.get('pending')) || [];
    if (pending.length === 0) return;

    let cfg;
    try {
      cfg = await this.getConfig();
    } catch (err) {
      console.error('[wa alarm config]', err.message);
      await this.clearPending();
      return;
    }

    const contact = await storage.get('contact');
    const origin = await storage.get('origin');
    const chatid = contact?.chatid;
    if (!cfg.enabled || !chatid) { await this.clearPending(); return; }

    const userText = pending.map(p => p.text).join('\n');
    const pendingKey = pending.map(p => p.id || p.text).join('|');
    const agentId = (await storage.get('agentId')) || SECRETARIA_ID;
    const history = (await storage.get('history')) || [];

    // Idempotência: turn já gerado para ESTE buffer? Pula direto pro envio.
    let turn = await storage.get('turn');
    if (!turn || turn.pendingKey !== pendingKey || turn.stage !== 'gerado') {
      turn = await this.generateTurn(cfg, { agentId, history, userText, pendingKey });
      if (!turn) return; // cap atingido ou erro já tratado (cortesia enviada)
      await storage.put('turn', turn);
    }

    await this.sendTurn(cfg, chatid, origin, turn, userText);

    // Commit do estado da conversa
    await storage.put('agentId', turn.nextAgentId);
    await storage.put('history', turn.nextHistory.slice(-40)); // ~20 turnos (FB-004)
    await this.clearPending();
    await storage.delete('turn');
  }

  async clearPending() {
    await this.ctx.storage.delete('pending');
    await this.ctx.storage.delete('firstPendingAt');
  }

  // Gera a resposta (e o roteamento, se secretária). Retorna null se o turno
  // foi encerrado sem LLM (cap ou erro — mensagem de cortesia já enviada).
  async generateTurn(cfg, { agentId, history, userText, pendingKey }) {
    const storage = this.ctx.storage;
    const contact = await storage.get('contact');
    const chatid = contact?.chatid;

    // Cap diário global (FM-005)
    let usage;
    try { usage = await sbBumpUsage(this.env); }
    catch (err) { console.error('[wa usage]', err.message); usage = 0; }
    if (cfg.daily_reply_cap > 0 && usage > cfg.daily_reply_cap) {
      const today = new Date().toISOString().slice(0, 10);
      const notified = await storage.get('capNotifiedDay');
      if (notified !== today) {
        await storage.put('capNotifiedDay', today);
        try { await uazSendText(cfg, chatid, CAP_TEXT, typingDelay(cfg, CAP_TEXT)); }
        catch (err) { console.error('[wa cap notify]', err.message); }
      }
      await this.clearPending();
      return null;
    }

    // Atalho determinístico: número 1-6 direto pra secretária roteia sem LLM
    let routedTo = null;
    let preText = null;
    if (agentId === SECRETARIA_ID && /^[1-6]$/.test(userText.trim())) {
      routedTo = AGENT_ORDER[parseInt(userText.trim(), 10) - 1];
      preText = 'Perfeito! Te conectando agora 😊';
    }

    try {
      if (!routedTo) {
        const reply = await this.callAgent(cfg, agentId, userText, history, false);
        if (agentId === SECRETARIA_ID) {
          const parsed = parseRouteTag(reply);
          if (parsed.target) {
            routedTo = parsed.target;
            preText = parsed.text || 'Perfeito! Te conectando agora 😊';
          } else {
            return {
              pendingKey, stage: 'gerado', preText: null, reply: parsed.text || reply,
              images: null, nextAgentId: SECRETARIA_ID,
              nextHistory: [...history, { role: 'user', content: userText }, { role: 'assistant', content: parsed.text || reply }],
            };
          }
        } else {
          const nextHistory = [...history, { role: 'user', content: userText }, { role: 'assistant', content: reply }];
          const images = this.detectImages(cfg, agentId, userText, reply, nextHistory);
          return { pendingKey, stage: 'gerado', preText: null, reply, images, nextAgentId: agentId, nextHistory };
        }
      }

      // Roteado: o agente de destino abre a conversa com a saudação dele
      const greeting = await this.callAgent(cfg, routedTo, 'Olá!', [], true);
      return {
        pendingKey, stage: 'gerado', preText, reply: greeting, images: null,
        nextAgentId: routedTo,
        nextHistory: [{ role: 'user', content: 'Olá!' }, { role: 'assistant', content: greeting }],
      };
    } catch (err) {
      // Sem fallback de modelo, por decisão: cortesia + encerra o turno (FM-002)
      console.error('[wa llm fail]', agentId, err.message);
      try { await uazSendText(cfg, chatid, ERROR_TEXT, typingDelay(cfg, ERROR_TEXT)); }
      catch (e2) { console.error('[wa error notify]', e2.message); }
      await this.clearPending();
      return null;
    }
  }

  async callAgent(cfg, agentId, userMessage, history, isInit) {
    const base = agentId === SECRETARIA_ID
      ? (cfg.prompt_overrides[SECRETARIA_ID] || SECRETARIA_PROMPT)
      : (cfg.prompt_overrides[agentId] || AGENTS[agentId]?.systemPrompt);
    if (!base) throw new Error(`Agente "${agentId}" nao encontrado`);

    const apiMessages = buildAgentMessages({
      agentId,
      systemPrompt: base + WHATSAPP_SUFFIX,
      userMessage,
      history,
      isInit,
    });
    return await callOpenRouterOnly(cfg.model, apiMessages, this.env.OPENROUTER_API_KEY);
  }

  detectImages(cfg, agentId, userText, reply, historyAfterReply) {
    if (!cfg.media_enabled) return null;
    let detected = null;
    if (agentId === 'imobiliaria') {
      detected = detectCatalogImages(userText, reply, historyAfterReply, PROPERTY_NAME_MAP, PROPERTY_IMAGES, PROPERTY_AMBIGUOUS);
    } else if (agentId === 'conc') {
      detected = detectCatalogImages(userText, reply, historyAfterReply, IPHONE_NAME_MAP, IPHONE_IMAGES, IPHONE_AMBIGUOUS);
    }
    if (!detected) return null;
    // No WhatsApp cada foto é uma mensagem — limita a 2 itens x 4 fotos (FA-005)
    return detected.slice(0, 2).map(item => ({
      name: item.name,
      images: item.images.slice(0, 4),
    }));
  }

  async sendTurn(cfg, chatid, origin, turn, userText) {
    try {
      if (turn.preText) {
        await uazSendText(cfg, chatid, turn.preText, typingDelay(cfg, turn.preText));
      }
      await uazSendText(cfg, chatid, turn.reply, typingDelay(cfg, turn.reply));
      if (turn.images && origin) {
        for (const item of turn.images) {
          for (const img of item.images) {
            const abs = img.url.startsWith('http') ? img.url : `${origin}${img.url}`;
            try { await uazSendImage(cfg, chatid, abs, `${item.name} — ${img.label}`); }
            catch (err) { console.error('[wa image]', img.label, err.message); }
          }
        }
      }
    } catch (err) {
      // Envio falhou mesmo com retry: loga e NÃO relança (senão o alarm
      // re-executa e duplica o turno inteiro). Visível na observability (FM-003).
      console.error('[wa send fail]', chatid, err.message, '| userText:', userText.slice(0, 80));
    }
  }
}

// ──────────────────────────────────────────────────
// Handlers usados pelo worker.js
// ──────────────────────────────────────────────────

// POST /api/whatsapp/webhook/<WA_WEBHOOK_SECRET>
export async function handleWebhook(request, env, secret) {
  if (!env.WA_WEBHOOK_SECRET || secret !== env.WA_WEBHOOK_SECRET) {
    return new Response('not found', { status: 404 });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response('ok', { status: 200 }); }

  // Envelope uazapi: { event, instance, data }
  const event = body?.event || '';
  if (!/^messages?$/.test(event)) return new Response('ok', { status: 200 });

  const msg = Array.isArray(body.data) ? body.data[0] : body.data;
  if (!msg) return new Response('ok', { status: 200 });

  // Defesa em profundidade (FC-001): o webhook já é registrado com
  // excludeMessages [fromMeYes, isGroupYes], mas filtramos de novo aqui.
  if (msg.fromMe || msg.isGroup || msg.wasSentByApi) {
    return new Response('ok', { status: 200 });
  }

  const chatid = msg.chatid || msg.sender;
  if (!chatid) return new Response('ok', { status: 200 });

  const id = env.CHAT_BUFFER.idFromName(chatid);
  const stub = env.CHAT_BUFFER.get(id);
  const origin = new URL(request.url).origin;
  await stub.fetch('https://do/message', {
    method: 'POST',
    body: JSON.stringify({ msg, origin }),
  });

  return new Response('ok', { status: 200 });
}

// POST /api/whatsapp/admin/<action> — proxy autenticado (browser nunca vê o token uazapi)
export async function handleAdmin(request, env, action) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResp({ error: 'JSON inválido' }, 400); }

  const isAdmin = await sbValidateAdminSession(env, body.session);
  if (!isAdmin) return jsonResp({ error: 'Não autorizado' }, 401);

  // Prompts default vivem no código — o menu mostra como ponto de partida do editor
  if (action === 'default-prompts') {
    const prompts = {
      [SECRETARIA_ID]: { name: 'Secretária (recepção)', prompt: SECRETARIA_PROMPT },
    };
    for (const id of AGENT_ORDER) {
      prompts[id] = { name: AGENTS[id]?.name || id, prompt: AGENTS[id]?.systemPrompt || '' };
    }
    return jsonResp({ prompts });
  }

  let cfg;
  try { cfg = await sbGetWhatsAppConfig(env); }
  catch (err) { return jsonResp({ error: `Config: ${err.message}` }, 500); }

  try {
    switch (action) {
      case 'connect': {
        // Sem "phone" no body → uazapi devolve QR code (FA-001)
        const r = await uaz(cfg, 'POST', '/instance/connect', {});
        return jsonResp(pickInstanceStatus(r));
      }
      case 'status': {
        const r = await uaz(cfg, 'GET', '/instance/status');
        return jsonResp(pickInstanceStatus(r));
      }
      case 'disconnect': {
        await uaz(cfg, 'POST', '/instance/disconnect', {});
        return jsonResp({ ok: true });
      }
      case 'setup-webhook': {
        if (!env.WA_WEBHOOK_SECRET) return jsonResp({ error: 'WA_WEBHOOK_SECRET não configurado no Worker' }, 500);
        const origin = new URL(request.url).origin;
        const hookUrl = `${origin}/api/whatsapp/webhook/${env.WA_WEBHOOK_SECRET}`;
        // Filtro NA ORIGEM: eco (fromMe) e grupos nunca chegam ao Worker (FC-001)
        const r = await uaz(cfg, 'POST', '/webhook', {
          enabled: true,
          url: hookUrl,
          events: ['messages'],
          excludeMessages: ['fromMeYes', 'isGroupYes'],
          action: 'add',
        });
        return jsonResp({ ok: true, url: hookUrl, webhook: r });
      }
      case 'test-model': {
        // Validação do modelo digitado no menu (FM-006)
        const model = (body.model || cfg.model || '').trim();
        if (!model) return jsonResp({ error: 'Modelo vazio' }, 400);
        const out = await callOpenRouterOnly(
          model,
          [{ role: 'user', content: 'Responda apenas: ok' }],
          env.OPENROUTER_API_KEY,
          { maxTokens: 10 },
        );
        return jsonResp({ ok: true, model, sample: out.slice(0, 40) });
      }
      default:
        return jsonResp({ error: 'Ação desconhecida' }, 404);
    }
  } catch (err) {
    return jsonResp({ error: err.message }, 502);
  }
}

function pickInstanceStatus(r) {
  const inst = r?.instance || {};
  const st = r?.status || r;
  return {
    connected: !!(st?.connected ?? r?.connected),
    loggedIn: !!(st?.loggedIn ?? r?.loggedIn),
    status: inst.status || '',
    qrcode: inst.qrcode || '',
    paircode: inst.paircode || '',
    profileName: inst.profileName || '',
    owner: inst.owner || '',
  };
}

function jsonResp(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
