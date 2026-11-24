# SME MIS contributor rules

## Access control is part of every feature

- **Authentication (AuthN).** Verify identity with Supabase Auth on the server before reading private information or performing a signed-in action. Keep the public catalog accessible to guests.
- **Role-based access control (RBAC).** Use the trusted account role stored in the database. Public registration offers Store Owner and Customer. Assign Administrator access only through a privileged process. Treat client input and editable signup metadata as untrusted after role assignment.
- **Authorization (AuthZ).** Explicitly allow each operation by role and record ownership. Store Owners manage only their own store and records. Customers access the public catalog and their own account data. Administrators get oversight permissions for the tasks assigned to them.
- Apply relevant access checks to server routes and actions. Enforce data access with Supabase grants and row-level security (RLS), including calls made through the Data API. Use the UI to reflect permissions. Deny private access when the identity, role, or ownership check fails.
- Verify allowed and denied cases before release. Cover signed-out access, the wrong role, another Owner’s records, and direct route or API access as applicable.
