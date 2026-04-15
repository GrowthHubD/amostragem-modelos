# Secretaria Visual — Central de Agentes IA

## O que é este projeto

Interface web single-page para um sistema de orquestração de agentes IA via n8n.

O usuário tem um **fluxo orquestrador no n8n** que gerencia múltiplos sub-fluxos (agentes IA especializados). A interface permite que usuários escolham qual agente ativar e conversem com ele. Quando a sessão termina, volta para o orquestrador.

## Arquivo principal

```
d:\Projetos-vibeocding\secretaria-visual\
├── index.html                      ← App completo (HTML + CSS + JS inline)
├── gh-tipografico.svg               ← Wordmark da empresa (tipografia roxa)
├── gh-simbolo.svg                   ← Ícone/símbolo da marca GH
└── CLAUDE.md                       ← Este arquivo
```

## Identidade visual (Brand tokens)

| Token | Valor |
|---|---|
| Purple primário | `#694de2` |
| Purple light | `#8b72f0` |
| Background base | `#161616` |
| Background raised | `#1c1c1c` |
| Texto primário | `#ededed` |
| Texto muted | `#7a7a7a` |
| Gradiente | `#694de2` → `#161616` |

Os dois SVGs estão na pasta e são referenciados por caminho relativo no `index.html`.

## Arquitetura da interface

- **Stack**: HTML + CSS puro + Vanilla JS (sem build, sem dependências, arquivo único)
- **Fonte**: Inter + Space Grotesk (Google Fonts via CDN)
- **Modo**: sempre dark mode, sem toggle

### Estrutura de layout

```
┌─ SIDEBAR (290px) ─┬─ MAIN PANEL ──────────────────────┐
│ Logo (SVGs)        │ Topbar (breadcrumb + chip ativo)   │
│ Orquestrador pill  ├───────────────────────────────────┤
│ Lista de agentes   │ VIEW: Orquestrador                 │
│                    │   Welcome title                    │
│                    │   Prévia de conversa               │
│                    │   Grid 2x2 de agentes              │
│                    │                                    │
│                    │ VIEW: Chat (agente ativo)          │
│                    │   Banner do agente                 │
│                    │   Área de mensagens                │
│                    │   Input + botão enviar             │
│ Footer (status)    │                                    │
└────────────────────┴────────────────────────────────────┘
```

### Estados da aplicação

1. **Orquestrador ativo** — Grid mostra agentes disponíveis para seleção
2. **Agente ativo** — Chat com o agente, breadcrumb mostra `Central › NomeAgente`
3. **Encerrar sessão** — Volta para estado 1

## Agentes configurados (array `AGENTS` no JS)

| ID | Nome | Webhook |
|---|---|---|
| `petshop` | Petshop | `https://webhook.iacompanyhorizon.com.br/webhook/petshope` |
| `delivery` | Delivery | `https://webhook.iacompanyhorizon.com.br/webhook/delivery` |
| `imobiliaria` | Imobiliária | `https://webhook.iacompanyhorizon.com.br/webhook/imobiliariaamostragem` |
| `conc` | Concierge | `https://webhook.iacompanyhorizon.com.br/webhook/conc` |

## Integração n8n

A função `callWebhook(url, message)` faz `POST` com:
```json
{ "message": "...", "agent": "petshop", "timestamp": "ISO string" }
```

Resposta aceita nos formatos: `output`, `response`, `message`, `text`, `content` (ou array com qualquer um desses).

## Regras para modificações

- Manter tudo em arquivo único `index.html` — sem frameworks, sem build
- Não adicionar emojis como ícones — usar SVG inline (Lucide/Heroicons style)
- Sempre usar as brand colors acima — não inventar novas cores
- Os SVGs da logo são referenciados por `<img src="...svg">` relativo, não inline
- Para adicionar agente: adicionar objeto no array `AGENTS` com `id`, `name`, `tag`, `desc`, `webhook`, `icon`
- Para remover agente: remover do array `AGENTS`
