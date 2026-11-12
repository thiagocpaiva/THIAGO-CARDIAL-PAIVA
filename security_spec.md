# Security Spec: Grupo MS Inventory & Synchronization

## 1. Data Invariants
- Branch ID in `/branches/{branchId}` must be one of `PAULO_AFONSO` or `DELMIRO`.
- Branch document updates must contain the valid branch field matching the document path.
- Config document ID in `/appConfig/{configId}` must match valid config keys (`users`, `settings`).
- All document updates must maintain data structure integrity without ghost fields or unbounded arrays.

## 2. The "Dirty Dozen" Payloads
1. Injecting invalid branch ID path: `/branches/UNKNOWN_CITY`
2. Setting branch property to mismatched value: `branch: "CURITIBA"`
3. Exceeding ID size limits (>128 chars): `id: "a".repeat(200)`
4. Overwriting appConfig with arbitrary unknown keys
5. Spoofing timestamps or invalid types
6. Injecting script payloads into branch name
7. Malformed materials array with non-object elements
8. Null or empty branch name in branch document
9. Unauthorized subcollection writing
10. Attempting to delete the master branches
11. Bypassing schema validation helper
12. Attempting unbounded array flood

## 3. Security Rules Design
- Default-deny catch-all rule `match /{document=**} { allow read, write: if false; }`.
- Rules allow read and write for authenticated users or open read/write with strict schema validation for the application's synchronization needs.
- Validate branchId with regex and length limits.
- Validate configId with regex and length limits.
