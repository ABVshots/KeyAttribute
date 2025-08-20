Actions module structure

- create.ts: createGroup, createChildGroup
- update.ts: updateGroupName, updateGroupDetails (+ GroupActionState)
- delete.ts: deleteGroup
- move.ts: moveGroupParent (DnD / reparent)
- names.ts: updateGroupNamesAllLocales (translations for names)

Conventions
- Server Actions only orchestrate: validate → auth/membership → call DB → revalidate/redirect
- Shared logic lives in src/lib (e.g., UUID_RE, ensureMembership, getDefaultLocale, preventCycle)
- Keep responses simple: { ok?: string; error?: string } where applicable
- Prefer DB triggers for cross-entity sync (e.g., names sync) to avoid duplication in actions

Importing
- Prefer importing via barrel: `import { createGroup, moveGroupParent } from '@/app/dashboard/groups/actions'`
- Each file is isolated by concern to simplify maintenance and testing
