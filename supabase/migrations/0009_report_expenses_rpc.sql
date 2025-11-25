-- Create a secure RPC to fetch expenses for reports
-- This bypasses RLS (security definer) which is necessary for the server-side PDF generation
-- where the request comes from Puppeteer (unauthenticated).

create or replace function get_expenses(p_start date, p_end date)
returns table(
    id uuid,
    expense_date date,
    category expense_category,
    amount numeric,
    note text
)
language sql
security definer
set search_path = public
as $$
    select
        id,
        expense_date,
        category,
        amount,
        note
    from expenses
    where expense_date >= p_start
      and expense_date < (p_end + 1)
    order by expense_date;
$$;
