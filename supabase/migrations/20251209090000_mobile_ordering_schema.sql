alter table "public"."orders" add column "order_type" text not null default 'SESSION';
alter table "public"."orders" add column "table_label" text;
