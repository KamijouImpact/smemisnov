alter table public.account_roles
  drop constraint account_roles_account_type_check,
  add constraint account_roles_account_type_check
    check (account_type in ('owner', 'customer', 'admin'));
