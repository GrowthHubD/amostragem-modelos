# Dev handoff — colocar o WhatsApp no ar

Checklist na ordem. Itens 1–4 são feitos UMA vez; o resto é operação normal pelo menu.

## 1. Supabase — rodar a migração
No SQL Editor do projeto Supabase (`buiwcxygokdbmsdhquee`), rode o arquivo inteiro:

```
supabase/migration_whatsapp.sql
```

Confira depois:
```sql
SELECT * FROM public.whatsapp_config;              -- 1 linha, id=1
SELECT proname FROM pg_proc WHERE proname LIKE 'fn_wa%';  -- 6 funções
```

## 2. Secrets do Worker
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # Settings > API > service_role
npx wrangler secret put WA_WEBHOOK_SECRET           # gere com: openssl rand -hex 16
# (OPENROUTER_API_KEY e OPENAI_API_KEY já existem do chat web)
```
Para dev local: copie `.dev.vars.example` → `.dev.vars` e preencha.

## 3. Deploy
```bash
npx wrangler deploy
```
O deploy cria a classe `ChatBuffer` (migration tag `v1-chat-buffer`, SQLite — funciona
no plano free).

## 4. uazapi — criar a instância (painel da uazapi, uma vez)
1. No painel do seu servidor uazapi, crie uma instância e copie o **token da instância**
   (o admintoken NUNCA entra neste sistema).
2. No site, logue como admin → `/admin` → seção **WhatsApp**:
   - Cole a URL do servidor (ex.: `https://xxx.uazapi.com`) e o token → **Salvar conexão**.
   - **Gerar QR code** → escaneie no WhatsApp (Aparelhos conectados). A tela verifica a
     conexão sozinha a cada 4s.
   - **Registrar webhook** → registra a URL com o secret e os filtros
     `fromMeYes`/`isGroupYes` na origem.
   - Marque **Integração ativa** e salve de novo.

## 5. Operação pelo menu (/admin → WhatsApp)
- **Comportamento:** modelo OpenRouter (com botão Testar), buffer (silêncio + espera
  máx.), tempo de digitação (ms/caractere + mín/máx), limite diário de respostas,
  timeout para voltar ao menu, fotos de catálogo on/off, resposta fixa para áudios.
- **Prompts:** selecione um agente (secretária + 6), edite e salve. "Restaurar padrão"
  apaga o override. Alterações valem só no WhatsApp e aplicam em até 1 min (cache do DO).

## Como funciona por dentro (mapa rápido)
| Peça | Arquivo |
|---|---|
| Rotas webhook/admin | `src/worker.js` |
| DO ChatBuffer + secretária + cliente uazapi + handlers | `src/whatsapp.js` |
| `callOpenRouterOnly` + `buildAgentMessages` (compartilhado com web) | `src/chat.js` |
| Menu admin (UI) | `public/index.html`, `public/app.js`, `public/style.css` |
| Migração + RPCs | `supabase/migration_whatsapp.sql` |

## Comportamentos combinados (não são bugs)
- Erro de LLM → mensagem de cortesia, sem retry infinito e SEM fallback de modelo.
- Áudio/mídia recebidos → resposta fixa (sem transcrição na v1).
- "menu", "voltar", "inicio", "sair", "recomecar" → reseta pro menu numerado sem LLM.
- Cap diário atingido → aviso 1x/dia por contato, depois silêncio até virar o dia (UTC).
- Grupos e mensagens próprias são ignorados (filtro na uazapi E no código).

## Teste ponta a ponta sugerido
1. De outro número, mande "oi" → menu numerado da secretária.
2. Mande "3" → saudação do Vitor (imobiliária) após o buffer (default 10s de silêncio).
3. Peça "fotos do Audace" → texto + até 4 fotos.
4. Mande 2 mensagens rápidas em sequência → UMA resposta única (buffer agrupou).
5. Mande um áudio → resposta fixa educada.
6. Mande "menu" → volta pro menu numerado.
