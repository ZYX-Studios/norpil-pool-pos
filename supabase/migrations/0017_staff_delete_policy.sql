-- Enable delete for staff table
-- Currently, only SELECT, INSERT, UPDATE are enabled in 0001_init.sql
-- We rely on application-level checks (Server Actions) for authorization for now, matching existing policies.

create policy staff_del on staff for delete to authenticated using (true);
