-- Update the shift label to reflect new operating hours (10:00 - 03:00)
-- The logic remains the same (Day = 10-18, Night = Everything else), 
-- but we update the text label to be less confusing.

create or replace function revenue_by_shift(p_start date, p_end date)
returns table(shift_name text, revenue numeric)
language sql
security definer
set search_path = public
as $$
	select
		case
			-- Morning/first shift: 10:00–18:00 (inclusive start, exclusive end)
			when (pay.paid_at::time >= time '10:00' and pay.paid_at::time < time '18:00')
				then 'Day (10:00–18:00)'
			else 'Night (18:00–03:00)'
		end as shift_name,
		coalesce(sum(pay.amount), 0)::numeric(10,2) as revenue
	from payments pay
	join orders o on o.id = pay.order_id
	where o.status = 'PAID'
	  and pay.paid_at >= p_start
	  and pay.paid_at < (p_end + 1)
	group by 1
	order by 1;
$$;
