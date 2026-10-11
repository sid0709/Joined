import {
  AUDIT_TARGET_ENV,
  authenticateAuditPage,
  auditTestModeEnabled,
} from "./tools/audit-auth.mjs";
import { AUDIT_FRONTENDS } from "./tools/audit-frontends.mjs";

/** Runs in the Unlighthouse child process. The runner sets AUDIT_TARGET_ID for each app. */
function auditHooks() {
  const target = AUDIT_FRONTENDS.find((entry) => entry.id === process.env[AUDIT_TARGET_ENV]);
  if (!target) {
    return {};
  }
  return {
    authenticate: (page) => authenticateAuditPage(page, target),
  };
}

export default {
  ...(auditTestModeEnabled() ? { hooks: auditHooks() } : {}),
};
