-- 005_saas_onboarding_flow.sql
-- Ferreira SaaS V2: Automated Onboarding Flow

-- Function to handle new user registration
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_company_id uuid;
  company_name text;
begin
  -- 1. Extract company name from metadata (sent from frontend)
  -- Default to 'Minha Empresa' if not provided
  company_name := coalesce(new.raw_user_meta_data->>'company_name', 'Minha Empresa');

  -- 2. Create the Company
  insert into public.companies (name)
  values (company_name)
  returning id into new_company_id;

  -- 3. Create the User Profile
  insert into public.profiles (id, company_id, name, role)
  values (
    new.id, 
    new_company_id, 
    coalesce(new.raw_user_meta_data->>'name', new.email),
    'admin' -- First user is always admin
  );

  -- 4. Create initial Subscription (Trial)
  insert into public.subscriptions (company_id, plan_id, status, trial_ends_at)
  values (
    new_company_id,
    'free_trial',
    'trial',
    now() + interval '14 days'
  );

  return new;
end;
$$;

-- Trigger to execute the function after signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
