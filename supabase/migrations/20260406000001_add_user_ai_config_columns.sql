-- Add custom AI model configuration columns to users table
-- Users can configure their own AI provider instead of the default OpenRouter
alter table public.users
  add column ai_provider  text default null,
  add column ai_api_key   text default null,
  add column ai_base_url  text default null,
  add column ai_model_name text default null;

comment on column public.users.ai_provider is 'AI provider: "custom" for user-provided, null for default OpenRouter';
comment on column public.users.ai_api_key is 'User-provided API key for custom AI provider';
comment on column public.users.ai_base_url is 'Base URL for custom AI provider (e.g. http://localhost:11434/v1 for Ollama)';
comment on column public.users.ai_model_name is 'Model identifier for custom AI provider (e.g. llama3.2, gpt-4o)';
