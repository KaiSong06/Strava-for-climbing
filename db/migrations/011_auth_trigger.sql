-- Migration 011: Supabase Auth trigger (tracked)
-- Auto-insert a public.users row whenever Supabase Auth creates an auth.users
-- row. Previously this had to be pasted manually into the Supabase SQL Editor;
-- now it lives in version control like every other schema change.
--
-- Guarded on the presence of the `auth` schema so local/test environments
-- (plain pgvector/pgvector:pg16 containers, no Supabase) can apply the
-- migration as a no-op.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN

    CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      INSERT INTO public.users (id, phone, username, display_name)
      VALUES (
        NEW.id,
        NEW.phone,
        COALESCE(NEW.raw_user_meta_data->>'username', substring(NEW.id::text FROM 1 FOR 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'New climber')
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $fn$;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_auth_user();

  ELSE
    RAISE NOTICE 'Skipping Supabase auth trigger: auth schema not present (local/test env)';
  END IF;
END $$;
