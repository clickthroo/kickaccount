-- Pin the trigger functions' search_path (Supabase advisor 0011).
alter function accounting.forbid_change() set search_path = '';
alter function accounting.cost_component_void_only() set search_path = '';
