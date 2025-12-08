-- Add session modifiers to table_sessions

create type session_type as enum ('OPEN', 'FIXED');

alter table table_sessions 
add column if not exists session_type session_type not null default 'OPEN',
add column if not exists target_duration_minutes integer,
add column if not exists is_money_game boolean not null default false,
add column if not exists bet_amount numeric(10,2);

-- Add check constraint to ensure target_duration_minutes is set when session_type is FIXED
alter table table_sessions
add constraint chk_target_duration_fixed
check (
  (session_type = 'FIXED' and target_duration_minutes is not null and target_duration_minutes > 0)
  or
  (session_type = 'OPEN')
);

-- Add check constraint to ensure bet_amount is set when is_money_game is true
alter table table_sessions
add constraint chk_bet_amount_money_game
check (
  (is_money_game = true and bet_amount is not null and bet_amount >= 0)
  or
  (is_money_game = false)
);
