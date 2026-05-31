# ZERO2ONE Notification System Security Specification

This security specification details the access control models, security invariants, threat validation payloads, and defensive posture for the newly introduced `/notifications` collection mapped on Firebase Firestore and storage.

---

## 1. Data Invariants

1. **Academic Access (Read-Public)**:
   - Any guest user (including offline/unauthenticated clients) must have full read and list permissions to fetch active notifications.
   - Low-latency query matching must be available immediately for the client.

2. **Administrative Control (Write-Strict)**:
   - Only authorized administrators registered under the `/admins` entity can perform `create`, `update`, or `delete` actions.
   - Any attempt to spoof, bypass, or manipulate admin collections is strictly denied.

3. **Field and Schema Level Constraints**:
   - `createdAt` is mandatory on insertion, must represent `request.time` exactly, and remains strictly immutable after creation.
   - `active` must be a primitive Boolean.
   - `priority` must align strictly to the enumerated values: `["high", "medium", "low"]`.
   - `title` and `description` must not exceed strict string length boundaries to protect our clients and systems from Denial of Wallet or layout-breaking attacks.
   - User identity attributes or client-supplied clock times must not be trusted.

---

## 2. The "Dirty Dozen" (Pillars of Threat Simulation)

Below are the 12 specific JSON payloads designed to break the security guidelines of Identity, Integrity, and State:

1. **Plunge Injection (Privilege Escalation)**: Unauthenticated user attempts to write a high-priority notification.
2. **Title Poisoning Attack**: Admin tries to inject a 10MB junk payload string into `title`.
3. **Immutability Breach**: Admin attempts to update the immutable `createdAt` timestamp of an active notification document.
4. **Spoofed Administration**: Non-admin user attempts to create a notification passing simulated `isAdmin` claims in the auth context.
5. **Timestamp Hijacking**: Admin attempts to bypass server-time verification by providing a client-side hardcoded timestamp in `createdAt` or `updatedAt`.
6. **Prioritizer Chaos**: Admin publishes a notification with `priority: "ultra-critical"` violating the `["high", "medium", "low"]` enumeration gates.
7. **Phantom Active Update**: Guest user attempts to toggle the active state of an announcement.
8. **Shadow Field Insertion**: Admin attempts to inject a sneaky tracking key `trackingToken: "ghost-tag-value"` into the document payload.
9. **Relational Deletion Hijack**: Guest user queries the REST backend to invoke custom document `delete` operations on active notifications.
10. **ID Character Exploitation**: Malicious entity attempts to create a document ID with non-alphanumeric unicode parameters to trigger system path injections.
11. **Negative Value / Int Range Overflow**: Tries to post numerical limits outside boundaries.
12. **Blind Query Leakage**: Malicious customer attempts to list a private namespace collection.

---

## 3. Safe Access Verification (TDD Rules Configuration)

Our rules are set to block all 12 malicious mutations while cleanly allowing public read access and verified administrative publish actions.

- **Unauthenticated Read Block**: Allowed.
- **Admin Write Verification**: Verified via database document presence check `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`.
- **Schema Validation**: Validated via `isValidNotification(incoming())`.
