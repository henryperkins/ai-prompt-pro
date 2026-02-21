-- ============================================================
-- Contact support intake messages
-- ============================================================

create table if not exists public.support_reviewers (
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.support_reviewers enable row level security;

create policy "Users can read own support reviewer membership"
  on public.support_reviewers for select
  using (user_id = auth.uid());

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid references neon_auth."user"(id) on delete set null default auth.uid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone_country text not null default 'US',
  phone_number text not null default '',
  message text not null,
  privacy_consent boolean not null default false,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_messages_first_name_length check (char_length(first_name) between 1 and 80),
  constraint contact_messages_last_name_length check (char_length(last_name) between 1 and 80),
  constraint contact_messages_email_length check (char_length(email) between 3 and 320),
  constraint contact_messages_email_format check (position('@' in email) > 1),
  constraint contact_messages_phone_country_length check (char_length(phone_country) between 2 and 8),
  constraint contact_messages_phone_number_length check (char_length(phone_number) <= 50),
  constraint contact_messages_message_length check (char_length(message) between 1 and 5000),
  constraint contact_messages_status_check check (status in ('new', 'reviewing', 'resolved')),
  constraint contact_messages_privacy_consent_check check (privacy_consent = true)
);

alter table public.contact_messages enable row level security;

create policy "Anyone can submit contact messages"
  on public.contact_messages for insert
  with check (
    privacy_consent = true
    and (requester_user_id is null or requester_user_id = auth.uid())
  );

create policy "Users can read own contact messages"
  on public.contact_messages for select
  using (requester_user_id = auth.uid());

create policy "Support reviewers can read all contact messages"
  on public.contact_messages for select
  using (
    exists (
      select 1
      from public.support_reviewers as reviewers
      where reviewers.user_id = auth.uid()
    )
  );

create policy "Support reviewers can update contact messages"
  on public.contact_messages for update
  using (
    exists (
      select 1
      from public.support_reviewers as reviewers
      where reviewers.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.support_reviewers as reviewers
      where reviewers.user_id = auth.uid()
    )
  );

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

create index if not exists contact_messages_requester_idx
  on public.contact_messages (requester_user_id, created_at desc);

drop trigger if exists set_contact_messages_updated_at on public.contact_messages;
create trigger set_contact_messages_updated_at
before update on public.contact_messages
for each row execute function public.set_updated_at();
