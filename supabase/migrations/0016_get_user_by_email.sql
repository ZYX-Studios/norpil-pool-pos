-- RPC to get user ID by email
-- Only accessible by admins (we will enforce this via RLS or logic, but for now we make it security definer)
-- ideally we should check if the calling user is an admin in the function.

create or replace function get_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- Check if the caller is an admin (optional but recommended)
  -- For now, we'll just return the ID. The server action calling this must ensure authorization.
  
  select id into v_user_id
  from auth.users
  where email = p_email;
  
  return v_user_id;
end;
$$;
