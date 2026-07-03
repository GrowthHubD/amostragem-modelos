# Secretaria Visual — Central de Agentes IA (amostragem_modelos)

## O que é este projeto

Demo comercial da Growth Hub: um site onde clientes testam 6 agentes de IA de
atendimento (petshop, restaurante, imobiliária, loja de iPhones, odonto, hotel),
com login temporário controlado por admin, e uma **integração WhatsApp** onde os
mesmos agentes atendem de verdade via uazapi.

Roda 100% em **Cloudflare Worker** (plano free) + **Supabase** (auth e config).
Não há n8n nem servidor Node em produção — `server.js`, `index.html` (raiz) e o
`package.json` com express são **legado** da versão antiga e não são usados.

## Stack e arquitetura

- **Cloudflare Worker** (`src/worker.js`) — serve os assets estáticos de `public/`
  (SPA fallback ativo) e as rotas `/api/*`.
- **Chat web** (`src/chat.js`) — 6 agentes com prompts no código, modelo
  `openai/gpt-4.1-mini` via OpenRouter, catálogos de imóveis/iPhones com fotos
  (proxy do Google Drive em `/api/imoveis/img/:driveId`).
- **WhatsApp** (`src/whatsapp.js`) — webhook uazapi → Durable Object `ChatBuffer`
  (1 por contato, buffer/debounce via alarm) → OpenRouter (modelo único
  configurável, default `google/gemini-3.5-flash`, SEM fallback) → uazapi
  send/text|media. Secretária roteia os 6 agentes por tag `[[ROTEAR:id]]` ou
  número 1–6. Config e prompts editáveis em `/admin` (seção WhatsApp), gravados
  no Supabase.
- **Supabase** — login temporário (RPCs `fn_*`), config WhatsApp (RPCs `fn_wa_*`,
  token uazapi mascarado no browser), cap diário de respostas.
- **Front** (`public/`) — HTML + CSS + vanilla JS, sem build. Dark mode fixo.

Documentação detalhada: `docs/decisao-de-stack.md` (por quê de cada escolha) e
`docs/dev-handoff.md` (checklist de deploy/operação).

## Comandos

```bash
npx wrangler dev          # dev local (copie .dev.vars.example → .dev.vars antes)
npx wrangler deploy       # deploy manual (normalmente desnecessário: push na
                          # main deploya via Workers Builds/GitHub)
npx wrangler secret put X # secrets: OPENAI_API_KEY, OPENROUTER_API_KEY,
                          #          SUPABASE_SERVICE_ROLE_KEY, WA_WEBHOOK_SECRET
node --check src/*.js     # sanity de sintaxe
```

Migrações SQL: rodar `supabase/schema.sql` (uma vez, já rodado) e
`supabase/migration_whatsapp.sql` (uma vez) no SQL Editor do Supabase.

## Identidade visual (brand tokens)

| Token | Valor |
|---|---|
| Purple primário | `#694de2` |
| Purple light | `#8b72f0` |
| Background base | `#161616` |
| Background raised | `#1c1c1c` |
| Texto primário | `#ededed` |
| Texto muted | `#7a7a7a` |

## Regras para modificações

- **Nunca** commitar secrets — eles vivem em `.dev.vars` (local) e `wrangler secret`
  (produção). O token da uazapi só existe no Supabase e no Worker, nunca no front.
- Chat web e canal WhatsApp são caminhos separados de propósito: mudanças no
  WhatsApp (modelo, prompts, sufixo de formato) NÃO podem afetar o chat do site.
- O alarm do `ChatBuffer` precisa continuar idempotente e sem `throw` em erro de
  LLM/envio (Cloudflare re-executa alarm que lança — vira loop de retry).
- Sem frameworks/build no front; ícones em SVG inline (estilo Lucide), nunca emoji.
- Para mexer nos agentes: metadados visuais em `AGENTS_META` (`public/app.js`),
  prompts/modelo em `AGENTS` (`src/chat.js`), ordem do menu WhatsApp em
  `AGENT_ORDER` (`src/whatsapp.js`).

## Gotchas conhecidos

- `supabase/schema.sql` contém a senha admin em texto plano e o front expõe a anon
  key (por design do Supabase, mas a senha não deveria estar no git — trocar a
  senha e limpar em algum momento).
- O webhook da uazapi não é assinado; a segurança é o segredo na URL
  (`WA_WEBHOOK_SECRET`). Se vazar, gere outro e clique "Registrar webhook" de novo.
- Respostas do WhatsApp aplicam mudanças de config em até 1 min (cache de 60s no DO).
- O cap diário (`whatsapp_usage`) vira à meia-noite **UTC**.
