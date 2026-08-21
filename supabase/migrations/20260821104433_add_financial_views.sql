create or replace view public.v_event_financials
with (security_invoker = true)
as
with service_totals as (
  select
    event_service.event_id,
    sum(event_service.price_cents)::bigint as item_total_cents
  from public.event_services as event_service
  group by event_service.event_id
),
transaction_totals as (
  select
    transaction.event_id,
    sum(
      case when transaction.kind = 'in' then transaction.amount_cents else 0 end
    )::bigint as received_cents,
    sum(
      case when transaction.kind = 'out' then transaction.amount_cents else 0 end
    )::bigint as cost_cents
  from public.transactions as transaction
  where transaction.deleted_at is null
    and transaction.event_id is not null
  group by transaction.event_id
),
event_amounts as (
  select
    event.id as event_id,
    greatest(
      coalesce(service_total.item_total_cents, 0::bigint) - event.discount_cents::bigint,
      0::bigint
    ) as contract_cents,
    coalesce(transaction_total.received_cents, 0::bigint) as received_cents,
    coalesce(transaction_total.cost_cents, 0::bigint) as cost_cents,
    event.canceled
  from public.events as event
  left join service_totals as service_total on service_total.event_id = event.id
  left join transaction_totals as transaction_total on transaction_total.event_id = event.id
  where (select public.has_perm('manage_finance'))
)
select
  event_amount.event_id,
  event_amount.contract_cents,
  event_amount.received_cents,
  event_amount.cost_cents,
  event_amount.received_cents - event_amount.cost_cents as profit_cents,
  case
    when event_amount.canceled then 0::bigint
    else greatest(
      event_amount.contract_cents - event_amount.received_cents,
      0::bigint
    )
  end as receivable_cents
from event_amounts as event_amount;

create or replace view public.v_cash_position
with (security_invoker = true)
as
select
  coalesce(
    sum(
      case
        when transaction.kind = 'in' then transaction.amount_cents
        else -transaction.amount_cents
      end
    ),
    0::bigint
  )::bigint as cash_cents
from public.transactions as transaction
where transaction.deleted_at is null
  and (select public.has_perm('manage_finance'))
having (select public.has_perm('manage_finance'));

create or replace view public.v_monthly_flow
with (security_invoker = true)
as
select
  date_trunc('month', transaction.date)::date as month,
  sum(
    case when transaction.kind = 'in' then transaction.amount_cents else 0 end
  )::bigint as revenue_cents,
  sum(
    case when transaction.kind = 'out' then transaction.amount_cents else 0 end
  )::bigint as expenses_cents,
  sum(
    case
      when transaction.kind = 'in' then transaction.amount_cents
      else -transaction.amount_cents
    end
  )::bigint as profit_cents
from public.transactions as transaction
where transaction.deleted_at is null
  and (select public.has_perm('manage_finance'))
group by date_trunc('month', transaction.date)::date;

create or replace view public.v_service_sales
with (security_invoker = true)
as
select
  event_service.id as event_service_id,
  event_service.event_id,
  event_service.service_id,
  service.name as service_name,
  event_service.price_cents,
  event_service.created_at as closed_at
from public.event_services as event_service
join public.events as event on event.id = event_service.event_id
join public.services as service on service.id = event_service.service_id
where not event.canceled
  and (select public.has_perm('manage_finance'));

create or replace view public.v_category_expenses
with (security_invoker = true)
as
select
  transaction.category_id,
  category.name as category_name,
  transaction.date,
  sum(transaction.amount_cents)::bigint as total_cents
from public.transactions as transaction
join public.transaction_categories as category on category.id = transaction.category_id
where transaction.kind = 'out'
  and transaction.deleted_at is null
  and (select public.has_perm('manage_finance'))
group by transaction.category_id, category.name, transaction.date;

revoke all on public.v_event_financials from public, anon, authenticated;
revoke all on public.v_cash_position from public, anon, authenticated;
revoke all on public.v_monthly_flow from public, anon, authenticated;
revoke all on public.v_service_sales from public, anon, authenticated;
revoke all on public.v_category_expenses from public, anon, authenticated;

grant select on public.v_event_financials to authenticated;
grant select on public.v_cash_position to authenticated;
grant select on public.v_monthly_flow to authenticated;
grant select on public.v_service_sales to authenticated;
grant select on public.v_category_expenses to authenticated;
