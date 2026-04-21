-- ==============================================================================
-- SECRETARIA VISUAL — SCHEMA COMPLETO
-- ==============================================================================
-- Rode este arquivo inteiro uma unica vez no SQL Editor do Supabase.
-- Projeto: https://buiwcxygokdbmsdhquee.supabase.co
--
-- Cria:
--   1. Extensoes pgcrypto + pg_cron
--   2. Tabelas: users, temp_logins, sessions, ativacao_supabase
--   3. RPCs de auth (SECURITY DEFINER)
--   4. Seed do admin (method.growthhub@gmail.com)
--   5. Jobs pg_cron: cleanup de expirados (1 min) + keep-alive (1 hora)
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. EXTENSOES
-- ──────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. TABELAS
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.temp_logins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.sessions (
  token       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,
  username    text NOT NULL,
  role        text NOT NULL CHECK (role IN ('admin', 'temp')),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_temp_logins_expires ON public.temp_logins(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires    ON public.sessions(expires_at);

ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions    ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. RPCs (SECURITY DEFINER — chamaveis pelo anon key)
-- ──────────────────────────────────────────────────────────────────────────────

-- fn_login: retorna {token, role, expires_at, username} ou null
CREATE OR REPLACE FUNCTION public.fn_login(p_username text, p_password text)
RETURNS TABLE(token uuid, role text, expires_at timestamptz, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin  public.users%ROWTYPE;
  v_temp   public.temp_logins%ROWTYPE;
  v_token  uuid;
  v_expires timestamptz;
  v_role   text;
  v_uid    uuid;
  v_uname  text;
BEGIN
  -- Tenta admin primeiro
  SELECT * INTO v_admin FROM public.users WHERE public.users.username = p_username LIMIT 1;
  IF FOUND AND v_admin.password_hash = extensions.crypt(p_password, v_admin.password_hash) THEN
    v_role    := 'admin';
    v_uid     := v_admin.id;
    v_uname   := v_admin.username;
    v_expires := now() + interval '24 hours';
  ELSE
    -- Tenta temp
    SELECT * INTO v_temp FROM public.temp_logins
      WHERE public.temp_logins.username = p_username
        AND public.temp_logins.expires_at > now()
      LIMIT 1;
    IF FOUND AND v_temp.password_hash = extensions.crypt(p_password, v_temp.password_hash) THEN
      v_role    := 'temp';
      v_uid     := v_temp.id;
      v_uname   := v_temp.username;
      v_expires := v_temp.expires_at;
    ELSE
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.sessions(user_id, username, role, expires_at)
    VALUES (v_uid, v_uname, v_role, v_expires)
    RETURNING public.sessions.token INTO v_token;

  RETURN QUERY SELECT v_token, v_role, v_expires, v_uname;
END;
$$;

-- fn_validate_session: retorna {valid, role, expires_at, username}
CREATE OR REPLACE FUNCTION public.fn_validate_session(p_token uuid)
RETURNS TABLE(valid boolean, role text, expires_at timestamptz, username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE public.sessions.token = p_token LIMIT 1;
  IF NOT FOUND OR v_session.expires_at <= now() THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz, NULL::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, v_session.role, v_session.expires_at, v_session.username;
END;
$$;

-- fn_logout: apaga a sessao
CREATE OR REPLACE FUNCTION public.fn_logout(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  DELETE FROM public.sessions WHERE public.sessions.token = p_token;
END;
$$;

-- fn_create_temp_login: admin-only. Cria um temp login e retorna o id.
CREATE OR REPLACE FUNCTION public.fn_create_temp_login(
  p_token    uuid,
  p_username text,
  p_password text,
  p_minutes  int
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.sessions%ROWTYPE;
  v_new_id  uuid;
  v_minutes int;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE public.sessions.token = p_token LIMIT 1;
  IF NOT FOUND OR v_session.role <> 'admin' OR v_session.expires_at <= now() THEN
    RAISE EXCEPTION 'Nao autorizado';
  END IF;

  IF p_username IS NULL OR length(trim(p_username)) = 0 THEN
    RAISE EXCEPTION 'Username obrigatorio';
  END IF;
  IF p_password IS NULL OR length(p_password) < 4 THEN
    RAISE EXCEPTION 'Senha deve ter ao menos 4 caracteres';
  END IF;

  v_minutes := COALESCE(p_minutes, 10);
  IF v_minutes < 1 OR v_minutes > 1440 THEN
    RAISE EXCEPTION 'Minutos fora do intervalo (1 a 1440)';
  END IF;

  INSERT INTO public.temp_logins(username, password_hash, expires_at, created_by)
    VALUES (
      p_username,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now() + make_interval(mins => v_minutes),
      v_session.user_id
    )
    RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- fn_list_temp_logins: admin-only. Lista temps ativos.
CREATE OR REPLACE FUNCTION public.fn_list_temp_logins(p_token uuid)
RETURNS TABLE(id uuid, username text, expires_at timestamptz, created_at timestamptz)
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

  RETURN QUERY
    SELECT t.id, t.username, t.expires_at, t.created_at
    FROM public.temp_logins t
    WHERE t.expires_at > now()
    ORDER BY t.created_at DESC;
END;
$$;

-- fn_delete_temp_login: admin-only. Apaga um temp + sessoes dele.
CREATE OR REPLACE FUNCTION public.fn_delete_temp_login(p_token uuid, p_temp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session  public.sessions%ROWTYPE;
  v_username text;
BEGIN
  SELECT * INTO v_session FROM public.sessions WHERE public.sessions.token = p_token LIMIT 1;
  IF NOT FOUND OR v_session.role <> 'admin' OR v_session.expires_at <= now() THEN
    RAISE EXCEPTION 'Nao autorizado';
  END IF;

  SELECT username INTO v_username FROM public.temp_logins WHERE id = p_temp_id;
  DELETE FROM public.temp_logins WHERE id = p_temp_id;
  IF v_username IS NOT NULL THEN
    DELETE FROM public.sessions WHERE username = v_username AND role = 'temp';
  END IF;
END;
$$;

-- Permissoes: anon pode executar as RPCs (autorizacao feita dentro de cada uma)
GRANT EXECUTE ON FUNCTION public.fn_login(text, text)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_validate_session(uuid)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_logout(uuid)                               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_temp_login(uuid, text, text, int)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_list_temp_logins(uuid)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_delete_temp_login(uuid, uuid)              TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. SEED DO ADMIN
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO public.users (username, password_hash, role)
VALUES (
  'method.growthhub@gmail.com',
  extensions.crypt('Abc@0102030405', extensions.gen_salt('bf')),
  'admin'
)
ON CONFLICT (username) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. CRON — CLEANUP DE EXPIRADOS (1 min)
-- ──────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-auth');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-auth',
  '* * * * *',
  $CRON$
  DELETE FROM public.sessions    WHERE expires_at <= now();
  DELETE FROM public.temp_logins WHERE expires_at <= now();
  $CRON$
);

-- ==============================================================================
-- 6. KEEP-ALIVE SUPABASE (evita pausa por inatividade — 7 dias)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ativacao_supabase (
  id        BIGINT PRIMARY KEY,
  atualiza  BOOLEAN DEFAULT FALSE,
  last_ping TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.ativacao_supabase (id, atualiza)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  PERFORM cron.unschedule('keep-supabase-alive-job');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'keep-supabase-alive-job',
  '0 * * * *',
  $CRON$
  UPDATE public.ativacao_supabase
  SET atualiza  = NOT atualiza,
      last_ping = timezone('utc'::text, now())
  WHERE id = 1;
  $CRON$
);

-- ==============================================================================
-- CHECAGENS POS-EXECUCAO (rode manualmente depois para conferir)
-- ==============================================================================
-- SELECT jobname, schedule FROM cron.job;
-- SELECT username, role, created_at FROM public.users;
-- SELECT * FROM public.ativacao_supabase;
-- ==============================================================================
