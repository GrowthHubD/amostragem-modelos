# Decisão de stack — Integração WhatsApp (uazapi)

Data: 2026-07-02 · Escopo: canal WhatsApp da demo "amostragem modelos" (Growth Hub)

## Resumo da arquitetura

```
WhatsApp ⇄ uazapi ⇄ POST /api/whatsapp/webhook/<secret>  (Cloudflare Worker)
                          │ filtra evento/eco/grupo
                          ▼
              Durable Object ChatBuffer (1 por contato, SQLite)
                          │ buffer/debounce via alarm
                          ▼
              OpenRouter (modelo único, sem fallback) ── prompts/config no Supabase
                          │
                          ▼
              uazapi /send/text (+delay "digitando…") e /send/media (fotos)
```

## Decisões e motivos

### 1. Durable Objects com alarms (não Queues, não cron, não n8n)
**Decisão:** um DO por contato (`idFromName(chatid)`), buffer de mensagens em storage e
debounce via `setAlarm`.
**Motivo:** o requisito central é "esperar o silêncio do usuário antes de responder" —
isso exige estado por conversa + timer reprogramável. DO entrega os dois nativamente;
`new_sqlite_classes` roda no plano FREE. Queues não tem debounce; cron tem granularidade
de minuto; n8n foi descartado no projeto (a versão web já migrou para Worker puro).
**Guardas:** alarm idempotente (`turn` com `pendingKey` + stage `gerado`), erros de
LLM/envio nunca relançam (Cloudflare re-executa alarm que lança exceção).

### 2. uazapi como gateway WhatsApp
**Decisão:** uazapi (API não-oficial baseada em whatsmeow), autenticação por token de
instância; **o Worker nunca guarda o admintoken** — o usuário cria a instância no painel
da uazapi uma vez e cola o token no menu.
**Motivo:** já era decisão fechada do projeto (2026-07-01); QR code exposto via
`POST /instance/connect` sem `phone`; webhook com `excludeMessages
["fromMeYes","isGroupYes"]` mata o loop de eco na origem. Fatos verificados contra o
OpenAPI oficial (uazapiGO v2.1.1).

### 3. OpenRouter com modelo único, sem fallback
**Decisão:** todo o canal WhatsApp usa `callOpenRouterOnly()` — 3 tentativas no MESMO
modelo (backoff 1s/2s); esgotou → mensagem de cortesia. Default `google/gemini-3.5-flash`,
editável no menu com botão "Testar".
**Motivo:** exigência explícita do usuário ("100% via openrouter sem fallback"). O chat
web continua intocado com o caminho antigo.

### 4. Supabase como fonte de config (não KV, não vars)
**Decisão:** `whatsapp_config` (linha única), `agent_prompt_overrides` e `whatsapp_usage`
no mesmo Supabase da autenticação; Worker lê com SERVICE_ROLE_KEY; browser só fala com
RPCs SECURITY DEFINER que validam sessão admin e **mascaram o token uazapi**.
**Motivo:** o projeto já tem Supabase com o padrão fn_* de sessão; o menu admin precisa
de leitura/escrita autenticada e o token não pode vazar pro front. KV exigiria outro
mecanismo de auth para escrita. Cache de 60s no DO amortiza leituras.

### 5. Webhook protegido por segredo na URL
**Decisão:** `/api/whatsapp/webhook/<WA_WEBHOOK_SECRET>` (secret do Worker), 404 se não
bater.
**Motivo:** a uazapi não assina webhooks; segredo na URL é o mecanismo viável. Defesa em
profundidade: filtro `fromMe/isGroup/wasSentByApi` repetido no código.

### 6. Secretária roteadora por tag + atalho numérico
**Decisão:** agente `secretaria` (prompt próprio, editável) roteia com `[[ROTEAR:id]]`
parseado por código; "1"–"6" roteia direto sem LLM; "menu"/"voltar" e timeout de
inatividade (default 45 min) resetam para a secretária.
**Motivo:** roteamento determinístico onde dá (número, comandos) e LLM só onde precisa;
a tag nunca chega ao usuário porque o código a remove antes do envio.

### 7. SPA fallback nos assets
**Decisão:** `not_found_handling: "single-page-application"` no wrangler.jsonc.
**Motivo:** bug pré-existente — recarregar `/admin`, `/login` ou `/<agente>` dava 404;
com o menu WhatsApp morando em `/admin`, o deep-link passou a ser caminho principal.

## Alternativas descartadas
- **Evolution API / Baileys self-hosted:** mais infra para manter; uazapi já decidida.
- **Fallback de modelo:** vetado pelo usuário — retry no mesmo modelo + cortesia.
- **Transcrição de áudio (v1):** resposta fixa educada; transcrição fica para v2.
- **Criar instância uazapi pelo menu (v1):** exigiria armazenar admintoken no Worker;
  risco desnecessário para ação que acontece uma vez.
