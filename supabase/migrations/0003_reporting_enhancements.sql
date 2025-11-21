-- Extra reporting helpers to power the admin /reports page.
-- We keep these functions small and focused, and reuse the same
-- date range semantics as the existing reporting RPCs:
--   - p_start and p_end are DATEs (inclusive on start, inclusive on end)
--   - Internally we filter using [p_start, p_end + 1 day) on paid_at.

-- === Daily revenue trend ===
-- Returns one row per calendar day between p_start and p_end (inclusive),
-- with NULL-safe revenue totals so the UI can always render a full series.
create or replace function daily_revenue(p_start date, p_end date)
returns table(day date, revenue numeric)
language sql
security definer
set search_path = public
as $$
	with date_series as (
		select generate_series(p_start, p_end, interval '1 day')::date as day
	),
	revenue_per_day as (
		select
			pay.paid_at::date as day,
			coalesce(sum(pay.amount), 0)::numeric(10,2) as revenue
		from payments pay
		join orders o on o.id = pay.order_id
		where o.status = 'PAID'
		  and pay.paid_at >= p_start
		  and pay.paid_at < (p_end + 1)
		group by pay.paid_at::date
	)
	select
		ds.day,
		coalesce(rpd.revenue, 0)::numeric(10,2) as revenue
	from date_series ds
	left join revenue_per_day rpd on rpd.day = ds.day
	order by ds.day;
$$;


-- === Revenue by pool table ===
-- Useful for understanding which tables are generating the most income
-- and how many sessions they host in the selected range.
create or replace function revenue_by_table(p_start date, p_end date)
returns table(table_name text, revenue numeric, session_count integer)
language sql
security definer
set search_path = public
as $$
	select
		pt.name as table_name,
		coalesce(sum(pay.amount), 0)::numeric(10,2) as revenue,
		count(distinct ts.id)::integer as session_count
	from pool_tables pt
	join table_sessions ts on ts.pool_table_id = pt.id
	join orders o on o.table_session_id = ts.id
	join payments pay on pay.order_id = o.id
	where o.status = 'PAID'
	  and pay.paid_at >= p_start
	  and pay.paid_at < (p_end + 1)
	group by pt.name
	order by revenue desc;
$$;





