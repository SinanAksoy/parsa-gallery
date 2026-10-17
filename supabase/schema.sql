-- Parsa's Gallery — initial schema for an EMPTY Supabase project.
-- Run ONCE in Supabase SQL Editor; never run against an existing populated schema.
-- Public bucket intentionally exposes uploaded photo objects to anyone with their URL.
-- RLS protects database rows and write operations. Anonymous commenting requires
-- rate limiting / anti-spam before a wider public launch.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null check(length(btrim(display_name)) between 1 and 75),
  role text not null check(role in ('owner','friend')),
  created_at timestamptz not null default now()
);
create unique index one_gallery_owner on public.profiles ((role)) where role='owner';

create table public.categories (
  key text primary key check (key in ('friends','interactions','everything')),
  title text not null check(length(btrim(title)) between 1 and 50),
  slots int not null check ((key='friends' and slots=10) or (key in ('interactions','everything') and slots=5))
);
insert into public.categories(key,title,slots) values
 ('friends','Friends',10),('interactions','Interactions',5),('everything','Everything else',5);

create table public.site_content (
 id smallint primary key default 1 check(id=1),
 value jsonb not null
);
insert into public.site_content(id,value) values
 (1, '{"title":"Parsa''s Gallery","footer":"Parsa’s Gallery","entryOwner":"Gallery owner","entryFriend":"Friends","entryVisitor":"Visitor"}'::jsonb);

create table public.editions (
 id uuid primary key default gen_random_uuid(),
 edition_date date not null unique,
 status text not null default 'draft' check(status in ('draft','published')),
 created_at timestamptz not null default now()
);
create unique index only_one_draft_edition on public.editions((status)) where status='draft';

create table public.photos (
 id uuid primary key default gen_random_uuid(),
 edition_id uuid not null references public.editions(id) on delete cascade,
 category_key text not null references public.categories(key),
 slot int not null check (slot between 1 and 10),
 storage_path text not null check(length(storage_path)>0),
 comments_enabled boolean not null default true,
 created_at timestamptz not null default now(),
 unique (edition_id,category_key,slot),
 check (category_key='friends' or slot<=5)
);
create index photos_edition_idx on public.photos(edition_id);

-- Private email-based tags can be set BEFORE an account exists.
create table public.photo_tags (
 photo_id uuid not null references public.photos(id) on delete cascade,
 friend_email text not null check(friend_email=lower(btrim(friend_email)) and length(friend_email) between 3 and 320),
 display_name text not null check(length(btrim(display_name)) between 1 and 75),
 primary key(photo_id,friend_email)
);

create table public.comments (
 id uuid primary key default gen_random_uuid(),
 photo_id uuid not null references public.photos(id) on delete cascade,
 author_id uuid references public.profiles(id) on delete set null,
 display_name text not null check(length(btrim(display_name)) between 1 and 70),
 message text not null check(length(btrim(message)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index comments_photo_idx on public.comments(photo_id,created_at);

create table public.friend_uploads (
 id uuid primary key default gen_random_uuid(),
 photo_id uuid not null references public.photos(id) on delete cascade,
 friend_id uuid not null references public.profiles(id) on delete cascade,
 display_name text not null,
 storage_path text not null check(length(storage_path)>0),
 created_at timestamptz not null default now(),
 unique(photo_id,friend_id)
);

create function public.is_gallery_owner() returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='owner');
 $$;
create function public.is_gallery_friend() returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='friend');
 $$;
create function public.is_photo_tagged(p_photo_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select (select public.is_gallery_friend()) and exists(
  select 1 from public.photo_tags t where t.photo_id=p_photo_id
  and t.friend_email=lower((select auth.jwt()->>'email'))
 ); $$;
create function public.is_photo_published(p_photo_id uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.photos p join public.editions e on e.id=p.edition_id
  where p.id=p_photo_id and e.status='published'); $$;

-- Service-side validation. Owner may publish only a COMPLETE 10+5+5 edition.
create function public.check_edition_publication() returns trigger
 language plpgsql security definer set search_path='' as $$
 begin
  if old.status='published' and new.status<>'published' then
   raise exception 'Published editions cannot revert to draft';
  end if;
  if new.status='published' and old.status='draft' and (
   (select count(*) from public.photos where edition_id=new.id and category_key='friends')<>10 or
   (select count(*) from public.photos where edition_id=new.id and category_key='interactions')<>5 or
   (select count(*) from public.photos where edition_id=new.id and category_key='everything')<>5
  ) then raise exception 'Every edition requires 10 Friends, 5 Interactions and 5 Everything else photographs'; end if;
  return new;
 end $$;
create trigger check_edition_publication_before_update before update of status on public.editions
 for each row execute function public.check_edition_publication();

create function public.publish_edition(p_edition_id uuid) returns void
 language plpgsql security definer set search_path='' as $$
 begin
  if not public.is_gallery_owner() then raise exception 'Not authorized'; end if;
  perform 1 from public.editions where id=p_edition_id and status='draft' for update;
  if not found then raise exception 'Draft not found'; end if;
  update public.editions set status='published' where id=p_edition_id;
 end $$;
revoke all on function public.publish_edition(uuid) from public;
grant execute on function public.publish_edition(uuid) to authenticated;

-- Replacement resets all feedback, friend uploads and tags in the same transaction.
create function public.guard_photo_changes() returns trigger
 language plpgsql security definer set search_path='' as $$
 declare v_status text;
 begin
  if tg_op='INSERT' then
   select status into v_status from public.editions where id=new.edition_id;
   if v_status is distinct from 'draft' then raise exception 'Photos can only be added to drafts'; end if;
   return new;
  elsif tg_op='DELETE' then
   -- Deleting a whole edition cascades: the parent edition row no longer exists.
   select status into v_status from public.editions where id=old.edition_id;
   if v_status='published' then raise exception 'Delete the edition, not individual published slots'; end if;
   return old;
  else
   select status into v_status from public.editions where id=old.edition_id;
   if v_status='published' and (new.edition_id,new.category_key,new.slot)
       is distinct from (old.edition_id,old.category_key,old.slot) then
    raise exception 'Published slots cannot be moved'; end if;
   if v_status='published' and new.storage_path is distinct from old.storage_path then
    delete from public.comments where photo_id=old.id;
    delete from public.friend_uploads where photo_id=old.id;
    delete from public.photo_tags where photo_id=old.id;
   end if;
   return new;
  end if;
 end $$;
create trigger guard_photo_changes_before_write before insert or update or delete on public.photos
 for each row execute function public.guard_photo_changes();

-- Keep friend-upload author label authoritative.
create function public.set_friend_upload_name() returns trigger
 language plpgsql security definer set search_path='' as $$
 begin
  select p.display_name into new.display_name from public.profiles p where p.id=new.friend_id;
  if new.display_name is null then raise exception 'Missing friend profile'; end if;
  return new;
 end $$;
create trigger friend_upload_name_before_insert before insert on public.friend_uploads
 for each row execute function public.set_friend_upload_name();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.site_content enable row level security;
alter table public.editions enable row level security;
alter table public.photos enable row level security;
alter table public.photo_tags enable row level security;
alter table public.comments enable row level security;
alter table public.friend_uploads enable row level security;

revoke all on public.profiles,public.categories,public.site_content,public.editions,
 public.photos,public.photo_tags,public.comments,public.friend_uploads from anon,authenticated;
grant select on public.categories,public.site_content,public.editions,public.photos,
 public.comments,public.friend_uploads to anon,authenticated;
grant select on public.profiles,public.photo_tags to authenticated;
grant update(title) on public.categories to authenticated;
grant update(value) on public.site_content to authenticated;
grant insert,update,delete on public.editions,public.photos to authenticated;
grant insert on public.photo_tags to authenticated;
grant delete on public.photo_tags to authenticated;
grant insert on public.friend_uploads to authenticated;
grant insert on public.comments to anon,authenticated;
grant delete on public.comments to authenticated;

create policy "self and owner profile" on public.profiles for select to authenticated
 using (id=(select auth.uid()) or (select public.is_gallery_owner()));
create policy "public categories" on public.categories for select to anon,authenticated using (true);
create policy "owner edit categories" on public.categories for update to authenticated
 using ((select public.is_gallery_owner())) with check ((select public.is_gallery_owner()));
create policy "public content" on public.site_content for select to anon,authenticated using (true);
create policy "owner edit content" on public.site_content for update to authenticated
 using ((select public.is_gallery_owner())) with check ((select public.is_gallery_owner()));

create policy "public published editions" on public.editions for select to anon,authenticated
 using(status='published' or (select public.is_gallery_owner()));
create policy "owner create draft" on public.editions for insert to authenticated
 with check ((select public.is_gallery_owner()) and status='draft');
create policy "owner update editions" on public.editions for update to authenticated
 using ((select public.is_gallery_owner())) with check ((select public.is_gallery_owner()));
create policy "owner delete editions" on public.editions for delete to authenticated
 using ((select public.is_gallery_owner()));

create policy "public published photos" on public.photos for select to anon,authenticated
 using ((select public.is_photo_published(id)) or (select public.is_gallery_owner()));
create policy "owner add photos" on public.photos for insert to authenticated
 with check ((select public.is_gallery_owner()));
create policy "owner edit photos" on public.photos for update to authenticated
 using ((select public.is_gallery_owner())) with check ((select public.is_gallery_owner()));
create policy "owner remove photos" on public.photos for delete to authenticated
 using ((select public.is_gallery_owner()));

-- Owner sees tag names and emails; friend sees only tags addressed to their own email.
create policy "private tags" on public.photo_tags for select to authenticated
 using ((select public.is_gallery_owner()) or
        ((select public.is_gallery_friend()) and friend_email=lower((select auth.jwt()->>'email'))));
create policy "owner add tags" on public.photo_tags for insert to authenticated
 with check ((select public.is_gallery_owner()));
create policy "owner delete tags" on public.photo_tags for delete to authenticated
 using ((select public.is_gallery_owner()));

-- Public view contains tag names only, never email addresses.
create view public.public_photo_tags with (security_invoker=false) as
 select t.photo_id,t.display_name from public.photo_tags t
 join public.photos p on p.id=t.photo_id
 join public.editions e on e.id=p.edition_id where e.status='published';
revoke all on public.public_photo_tags from public;
grant select on public.public_photo_tags to anon,authenticated;

create policy "read published comments" on public.comments for select to anon,authenticated
 using ((select public.is_photo_published(photo_id)) or (select public.is_gallery_owner()));
create policy "permitted comments" on public.comments for insert to anon,authenticated
 with check (
  ((author_id is null and (select auth.uid()) is null) or author_id=(select auth.uid()))
  and (select public.is_photo_published(photo_id))
  and exists (select 1 from public.photos p where p.id=photo_id and (
    p.category_key='interactions' or
    (p.category_key='everything' and p.comments_enabled) or
    (p.category_key='friends' and ((select public.is_gallery_owner()) or (select public.is_photo_tagged(photo_id))))
  ))
 );
create policy "owner delete comments" on public.comments for delete to authenticated
 using ((select public.is_gallery_owner()));

create policy "read published friend uploads" on public.friend_uploads for select to anon,authenticated
 using ((select public.is_photo_published(photo_id)) or (select public.is_gallery_owner()));
create policy "tagged friend upload once" on public.friend_uploads for insert to authenticated
 with check (friend_id=(select auth.uid()) and (select public.is_gallery_friend())
  and (select public.is_photo_tagged(photo_id)) and (select public.is_photo_published(photo_id))
  and exists (select 1 from public.photos p where p.id=photo_id and p.category_key='friends'));

-- Photos have opaque, random object paths; bucket is PUBLIC for read-only presentation.
-- Photo objects uploaded to a draft are accessible to someone holding their direct URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('parsa-images','parsa-images',true,18874368,
  array['image/jpeg','image/png','image/webp','image/avif']);
create policy "gallery owner image upload" on storage.objects for insert to authenticated
 with check (bucket_id='parsa-images' and (select public.is_gallery_owner())
  and (storage.foldername(name))[1]='owner');
create policy "tagged friend image upload" on storage.objects for insert to authenticated
 with check (bucket_id='parsa-images' and (select public.is_gallery_friend())
  and (storage.foldername(name))[1]='friends'
  and (storage.foldername(name))[3]=(select auth.uid())::text
  and (select public.is_photo_tagged(nullif((storage.foldername(name))[2],'')::uuid)));
create policy "gallery owner image delete" on storage.objects for delete to authenticated
 using (bucket_id='parsa-images' and (select public.is_gallery_owner()));

-- Important remaining production work:
-- (1) Anonymous comment abuse prevention (Edge Function + CAPTCHA + rate limiting),
-- (2) Storage orphan/object cleanup when photo/edition replaced or deleted,
-- (3) automated SQL/RLS integration tests, (4) backups.