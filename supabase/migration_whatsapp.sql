-- ==============================================================================
-- MIGRACAO — INTEGRACAO WHATSAPP (uazapi)
-- ==============================================================================
-- Rode este arquivo inteiro uma unica vez no SQL Editor do Supabase,
-- DEPOIS de já ter rodado o schema.sql principal.
--
-- Cria:
--   1. Tabela whatsapp_config (linha unica id=1)
--   2. Tabela agent_prompt_overrides (prompts editados no menu)
--   3. Tabela whatsapp_usage (cap diario global de respostas)
--   4. RPCs admin-only (SECURITY DEFINER, validam session token como as fn_*)
--
-- O Worker le a config completa (incluindo uazapi_token) via PostgREST com a
-- SERVICE ROLE KEY. O browser NUNCA recebe o token completo — só mascarado.
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. TABELAS
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id                     int PRIMARY KEY CHECK (id = 1),
  enabled                boolean NOT NULL DEFAULT false,
  uazapi_url             text NOT NULL DEFAULT '',
  uazapi_token           text NOT NULL DEFAULT '',
  model                  text NOT NULL DEFAULT 'google/gemini-3.5-flash',
  buffer_silence_ms      int  NOT NULL DEFAULT 10000,
  buffer_max_ms          int  NOT NULL DEFAULT 25000,
  typing_ms_per_char     int  NOT NULL DEFAULT 35,
  typing_min_ms          int  NOT NULL DEFAULT 1000,
  typing_max_ms          int  NOT NULL DEFAULT 5000,
  daily_reply_cap        int  NOT NULL DEFAULT 500,
  inactivity_timeout_min int  NOT NULL DEFAULT 45,
  media_enabled          boolean NOT NULL DEFAULT true,
  audio_reply_text       text NOT NULL DEFAULT 'Ainda não consigo ouvir áudios por aqui 😅 Pode me mandar por texto, por favor?',
  updated_at             timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.whatsapp_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.agent_prompt_overrides (
  agent_id      text PRIMARY KEY,
  system_prompt text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_usage (
  day     date PRIMARY KEY,
  replies int NOT NULL DEFAULT 0
);

ALTER TABLE public.whatsapp_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_prompt_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_usage         ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. HELPER INTERNO — valida sessao admin (nao exposto ao anon)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_wa_require_admin(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE public.sessions.token = p_token LIMIT 1;
  IF NOT FOUND OR v_session.role <> 'admin' OR v_session.expires_at <= now() THEN
    RAISE EXCEPTION 'Nao autorizado';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_wa_require_admin(uuid) FROM PUBLIC, anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. RPCs ADMIN (chamaveis pelo anon key; autorizacao dentro de cada uma)
-- ──────────────────────────────────────────────────────────────────────────────

-- fn_wa_get_config: config com token MASCARADO (browser nunca ve o token completo)
CREATE OR REPLACE FUNCTION public.fn_wa_get_config(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cfg public.whatsapp_config%ROWTYPE;
BEGIN
  PERFORM public.fn_wa_require_admin(p_token);
  SELECT * INTO v_cfg FROM public.whatsapp_config WHERE id = 1;

  RETURN jsonb_build_object(
    'enabled',                v_cfg.enabled,
    'uazapi_url',             v_cfg.uazapi_url,
    'has_token',              length(v_cfg.uazapi_token) > 0,
    'token_masked',           CASE WHEN length(v_cfg.uazapi_token) >= 8
                                THEN left(v_cfg.uazapi_token, 4) || '••••' || right(v_cfg.uazapi_token, 4)
                                WHEN length(v_cfg.uazapi_token) > 0 THEN '••••'
                                ELSE '' END,
    'model',                  v_cfg.model,
    'buffer_silence_ms',      v_cfg.buffer_silence_ms,
    'buffer_max_ms',          v_cfg.buffer_max_ms,
    'typing_ms_per_char',     v_cfg.typing_ms_per_char,
    'typing_min_ms',          v_cfg.typing_min_ms,
    'typing_max_ms',          v_cfg.typing_max_ms,
    'daily_reply_cap',        v_cfg.daily_reply_cap,
    'inactivity_timeout_min', v_cfg.inactivity_timeout_min,
    'media_enabled',          v_cfg.media_enabled,
    'audio_reply_text',       v_cfg.audio_reply_text,
    'updated_at',             v_cfg.updated_at
  );
END;
$$;

-- fn_wa_save_config: atualizacao parcial via jsonb.
-- uazapi_token so e sobrescrito se vier NAO-vazio (campo em branco = manter atual).
CREATE OR REPLACE FUNCTION public.fn_wa_save_config(p_token uuid, p_config jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_silence int;
  v_max     int;
BEGIN
  PERFORM public.fn_wa_require_admin(p_token);

  UPDATE public.whatsapp_config SET
    enabled                = COALESCE((p_config->>'enabled')::boolean,            enabled),
    uazapi_url             = COALESCE(NULLIF(trim(p_config->>'uazapi_url'), ''),  uazapi_url),
    uazapi_token           = COALESCE(NULLIF(trim(p_config->>'uazapi_token'),''), uazapi_token),
    model                  = COALESCE(NULLIF(trim(p_config->>'model'), ''),       model),
    buffer_silence_ms      = COALESCE((p_config->>'buffer_silence_ms')::int,      buffer_silence_ms),
    buffer_max_ms          = COALESCE((p_config->>'buffer_max_ms')::int,          buffer_max_ms),
    typing_ms_per_char     = COALESCE((p_config->>'typing_ms_per_char')::int,     typing_ms_per_char),
    typing_min_ms          = COALESCE((p_config->>'typing_min_ms')::int,          typing_min_ms),
    typing_max_ms          = COALESCE((p_config->>'typing_max_ms')::int,          typing_max_ms),
    daily_reply_cap        = COALESCE((p_config->>'daily_reply_cap')::int,        daily_reply_cap),
    inactivity_timeout_min = COALESCE((p_config->>'inactivity_timeout_min')::int, inactivity_timeout_min),
    media_enabled          = COALESCE((p_config->>'media_enabled')::boolean,      media_enabled),
    audio_reply_text       = COALESCE(p_config->>'audio_reply_text',              audio_reply_text),
    updated_at             = now()
  WHERE id = 1;

  SELECT buffer_silence_ms, buffer_max_ms INTO v_silence, v_max
    FROM public.whatsapp_config WHERE id = 1;

  IF v_silence < 1000 OR v_silence > 120000 THEN
    RAISE EXCEPTION 'buffer_silence_ms fora do intervalo (1000 a 120000)';
  END IF;
  IF v_max < v_silence OR v_max > 300000 THEN
    RAISE EXCEPTION 'buffer_max_ms deve ser >= buffer_silence_ms e <= 300000';
  END IF;
END;
$$;

-- fn_wa_get_prompts: lista overrides ativos (agentes sem override usam o default do codigo)
CREATE OR REPLACE FUNCTION public.fn_wa_get_prompts(p_token uuid)
RETURNS TABLE(agent_id text, system_prompt text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.fn_wa_require_admin(p_token);
  RETURN QUERY
    SELECT o.agent_id, o.system_prompt, o.updated_at
    FROM public.agent_prompt_overrides o
    ORDER BY o.agent_id;
END;
$$;

-- fn_wa_set_prompt: define override; prompt NULL ou vazio = remover (volta ao default)
CREATE OR REPLACE FUNCTION public.fn_wa_set_prompt(p_token uuid, p_agent_id text, p_prompt text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  PERFORM public.fn_wa_require_admin(p_token);

  IF p_agent_id IS NULL OR p_agent_id !~ '^[a-z0-9_-]{1,40}$' THEN
    RAISE EXCEPTION 'agent_id invalido';
  END IF;

  IF p_prompt IS NULL OR length(trim(p_prompt)) = 0 THEN
    DELETE FROM public.agent_prompt_overrides WHERE agent_id = p_agent_id;
  ELSE
    INSERT INTO public.agent_prompt_overrides (agent_id, system_prompt, updated_at)
    VALUES (p_agent_id, p_prompt, now())
    ON CONFLICT (agent_id) DO UPDATE
      SET system_prompt = EXCLUDED.system_prompt, updated_at = now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_wa_get_config(uuid)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wa_save_config(uuid, jsonb)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wa_get_prompts(uuid)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_wa_set_prompt(uuid, text, text) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. FUNCAO DE USO DIARIO — so o Worker (service role) chama. NAO expor ao anon.
-- ──────────────────────────────────────────────────────────────────────────────

-- Incrementa o contador do dia e retorna o novo total (o Worker compara com o cap).
CREATE OR REPLACE FUNCTION public.fn_wa_bump_usage()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO public.whatsapp_usage (day, replies)
  VALUES (current_date, 1)
  ON CONFLICT (day) DO UPDATE SET replies = public.whatsapp_usage.replies + 1
  RETURNING replies INTO v_count;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_wa_bump_usage() FROM PUBLIC, anon, authenticated;

-- ==============================================================================
-- CHECAGENS POS-EXECUCAO (rode manualmente depois para conferir)
-- ==============================================================================
-- SELECT * FROM public.whatsapp_config;
-- SELECT proname FROM pg_proc WHERE proname LIKE 'fn_wa%';
-- ==============================================================================
