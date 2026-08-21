update public.events
set event_time = make_time(
  extract(hour from event_time)::integer,
  extract(minute from event_time)::integer,
  0
)
where event_time is not null
  and extract(second from event_time) <> 0;

alter table public.events
  add constraint events_event_time_minute_precision
  check (event_time is null or extract(second from event_time) = 0);
