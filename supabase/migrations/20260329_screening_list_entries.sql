-- 規制リストエントリ（BIS Entity List・外国ユーザーリスト等）
create table if not exists screening_list_entries (
  id            uuid        default gen_random_uuid() primary key,
  list_source   text        not null,  -- 'bis_entity_list' | 'foreign_user_list'
  name          text        not null,
  aliases       text[]      not null default '{}',
  country       text,
  address       text,
  concern_categories text[] not null default '{}',
  notes         text,
  raw           jsonb,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists idx_sle_source  on screening_list_entries (list_source);
create index if not exists idx_sle_country on screening_list_entries (country);
-- 部分一致検索用
create index if not exists idx_sle_name_lower
  on screening_list_entries (lower(name) text_pattern_ops);
