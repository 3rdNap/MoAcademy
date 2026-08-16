import { canAccess, homeFor, isReadOnly, ROLE_AREAS } from "../src/lib/access.ts";
import type { Role } from "../src/lib/types.ts";

let fail = 0;
const check = (ok: boolean, label: string) => {
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
};

console.log("Each role lands on its own home:");
check(homeFor("student") === "/dashboard", "student  -> /dashboard");
check(homeFor("instructor") === "/dashboard", "instructor -> /dashboard");
check(homeFor("admin") === "/dashboard", "admin    -> /dashboard");
check(homeFor("parent") === "/family", "parent   -> /family");

console.log("\nA guardian reaches only their own areas:");
for (const p of ["/family", "/family/work", "/grades", "/calendar", "/inbox", "/roadmap"]) {
  check(canAccess("parent", p), `parent   CAN  ${p}`);
}
for (const p of [
  "/billing", "/billing/registrations", "/practice", "/assistant",
  "/study-guides", "/courses", "/courses/sub_math/assignments", "/admin", "/dashboard",
]) {
  check(!canAccess("parent", p), `parent   BLOCKED ${p}`);
}

console.log("\nOther roles keep what they need, lose what they don't:");
check(canAccess("student", "/billing"), "student  CAN  /billing");
check(canAccess("student", "/roadmap"), "student  CAN  /roadmap");
check(!canAccess("student", "/admin"), "student  BLOCKED /admin");
check(!canAccess("student", "/family"), "student  BLOCKED /family");
check(canAccess("instructor", "/courses/sub_math/grades"), "instructor CAN  /courses/…/grades");
check(!canAccess("instructor", "/billing"), "instructor BLOCKED /billing (a student's own registration)");
check(!canAccess("instructor", "/roadmap"), "instructor BLOCKED /roadmap (a student's own planning)");
check(!canAccess("instructor", "/admin"), "instructor BLOCKED /admin");
check(canAccess("admin", "/admin"), "admin    CAN  /admin");
check(canAccess("admin", "/billing"), "admin    CAN  /billing");
check(!canAccess("admin", "/family"), "admin    BLOCKED /family");

console.log("\nShared routes stay open to everyone:");
for (const role of ["student", "instructor", "admin", "parent"] as Role[]) {
  check(canAccess(role, "/account"), `${role} CAN /account`);
  check(canAccess(role, "/"), `${role} CAN /`);
}

console.log("\nOnly guardians are read-only:");
check(isReadOnly("parent"), "parent   is read-only");
check(!isReadOnly("student") && !isReadOnly("instructor") && !isReadOnly("admin"),
  "student/instructor/admin can act");

console.log("\nA prefix must not leak a sibling route:");
check(!canAccess("parent", "/gradesheet"), "parent BLOCKED /gradesheet (not a /grades prefix match)");
check(!canAccess("instructor", "/billing-export"), "instructor BLOCKED /billing-export");

console.log("\nEvery role's home is inside its own areas:");
for (const role of ["student", "instructor", "admin", "parent"] as Role[]) {
  check(canAccess(role, homeFor(role)), `${role}: home ${homeFor(role)} reachable`);
  check(ROLE_AREAS[role].length > 0, `${role}: has areas`);
}

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall access checks passed");
process.exit(fail ? 1 : 0);
