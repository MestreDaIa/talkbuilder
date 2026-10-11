-- Remove secrets from templates already published before the sanitizer fix.
-- Keep node settings, labels, prompts, themes and other non-credential configuration.

CREATE OR REPLACE FUNCTION public._sanitize_bot_template_jsonb(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  result jsonb;
  item record;
  has_secret_descriptor boolean;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(p_value) = 'object' THEN
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_each(p_value) AS e(key, value)
      WHERE lower(e.key) IN ('key', 'name', 'header', 'field')
        AND jsonb_typeof(e.value) = 'string'
        AND e.value #>> '{}' ~* '(authorization|password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|^token$|^bearer$)'
    ) INTO has_secret_descriptor;

    result := '{}'::jsonb;
    FOR item IN SELECT key, value FROM jsonb_each(p_value)
    LOOP
      IF item.key ~* '(authorization|password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|ai[_-]?keys?|openai[_-]?key|anthropic[_-]?key|google[_-]?key|gemini[_-]?key|^token$|^bearer$)' THEN
        CONTINUE;
      END IF;

      IF has_secret_descriptor AND lower(item.key) IN ('value', 'content', 'defaultvalue', 'default_value') THEN
        CONTINUE;
      END IF;

      result := result || jsonb_build_object(item.key, public._sanitize_bot_template_jsonb(item.value));
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(p_value) = 'array' THEN
    SELECT COALESCE(
      jsonb_agg(public._sanitize_bot_template_jsonb(value) ORDER BY ordinal),
      '[]'::jsonb
    )
    INTO result
    FROM jsonb_array_elements(p_value) WITH ORDINALITY AS elements(value, ordinal);
    RETURN result;
  END IF;

  RETURN p_value;
END;
$$;

UPDATE public.bot_templates
SET snapshot = public._sanitize_bot_template_jsonb(snapshot)
WHERE snapshot IS NOT NULL;

DROP FUNCTION public._sanitize_bot_template_jsonb(jsonb);
