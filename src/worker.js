// ══════════════════════════════════════════════════
//  Cloudflare Worker — entry point
// ══════════════════════════════════════════════════
import { processChatMessage } from './chat.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // POST /api/chat/:agentId
    const chatMatch = url.pathname.match(/^\/api\/chat\/([a-z0-9_-]+)$/i);
    if (chatMatch && request.method === 'POST') {
      return handleChat(request, chatMatch[1], env);
    }

    // GET /api/imoveis/img/:driveId — proxy do Google Drive (evita CORS)
    const imgMatch = url.pathname.match(/^\/api\/imoveis\/img\/([a-zA-Z0-9_-]+)$/);
    if (imgMatch && request.method === 'GET') {
      return handleImageProxy(imgMatch[1]);
    }

    // Tudo o mais cai nos assets estáticos
    return env.ASSETS.fetch(request);
  },
};

async function handleChat(request, agentId, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const userMessage = body.message;
  if (!userMessage) return json({ error: 'Mensagem nao pode estar vazia.' }, 400);

  const isInit = body.init === true;
  // História vem do cliente (stateless). Se não vier, tratamos como conversa nova.
  const history = Array.isArray(body.history) ? body.history : [];

  try {
    const result = await processChatMessage({
      agentId,
      userMessage,
      history,
      isInit,
      env,
    });
    return json(result);
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes('nao encontrado')) return json({ error: msg }, 404);
    if (msg.includes('API key')) return json({ error: msg }, 500);
    console.error('[chat error]', agentId, msg);
    return json({ error: 'Nao foi possivel alcancar o modelo de IA. Tente novamente.' }, 502);
  }
}

async function handleImageProxy(driveId) {
  const driveUrl = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
  try {
    const upstream = await fetch(driveUrl);
    if (!upstream.ok) return json({ error: 'Erro ao buscar imagem.' }, 502);

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=86400');
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return json({ error: 'Falha ao carregar imagem.' }, 502);
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
