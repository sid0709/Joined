import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUDIT_SESSION_TOKEN_ENV,
  AUDIT_TARGET_ENV,
  auditSessionCookies,
  auditTargetForSite,
  auditTestModeEnabled,
  issueAuditSession,
  revokeAuditSession,
} from "./audit-auth.mjs";
import { AUDIT_ROUTE_PLAN_ENV, planAuditRoutes } from "./audit-routes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** CI entry exits when the scan finishes (interactive `cli.mjs` keeps the server open). */
const cli = path.join(root, "node_modules/@unlighthouse/cli/dist/ci.mjs");

function siteFromArgs(args) {
  const flagIndex = args.findIndex((arg) => arg === "--site");
  if (flagIndex !== -1) return args[flagIndex + 1];
  return args.find((arg) => arg.startsWith("--site="))?.slice("--site=".length);
}

/**
 * @param {string[]} args Unlighthouse CLI args (without node/cli path).
 * @returns {Promise<number>} Exit code.
 */
export async function runUnlighthouse(args) {
  const finalArgs = [...args];
  if (!finalArgs.includes("--disable-dynamic-sampling")) {
    finalArgs.push("--disable-dynamic-sampling");
  }
  if (!finalArgs.some((arg) => arg === "--build-static" || arg.startsWith("--build-static"))) {
    finalArgs.push("--build-static");
  }

  const site = siteFromArgs(finalArgs);
  const target = site ? auditTargetForSite(site) : undefined;
  const testMode = auditTestModeEnabled() && target !== undefined;

  let session = null;
  if (testMode) {
    let result;
    try {
      result = issueAuditSession(target);
    } catch (error) {
      console.error(`\nTest mode could not sign in to ${target.label}:\n${error.message}\n`);
      return 1;
    }
    if (result.status === "signed-in") {
      session = result;
      console.log(`Test mode: signed in to ${target.label} as ${session.email}\n`);
    } else if (result.status === "skipped") {
      console.warn(`Test mode: scanning ${target.label} signed out (${result.reason})\n`);
    }
  }

  const sessionEnv = { [AUDIT_SESSION_TOKEN_ENV]: session?.token ?? "" };
  let routePlan = null;
  if (target) {
    const cookieHeader = auditSessionCookies(target, sessionEnv)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    routePlan = await planAuditRoutes(target, cookieHeader);
    console.log(`Seeding ${routePlan.seed.length} app pages for ${target.label}.`);
    if (routePlan.skip.length > 0) {
      const list = routePlan.skip
        .map(({ route, status }) => `${route} (${status || "error"})`)
        .join(", ");
      console.log(`Not scanned, they redirect or fail for this visitor: ${list}\n`);
    }
  }

  // The session is short-lived anyway; revoking it on exit or Ctrl+C keeps the database clean.
  const revoke = () => {
    if (!session) return;
    const token = session.token;
    session = null;
    try {
      revokeAuditSession(target, token);
    } catch (error) {
      console.error(`Could not revoke the ${target.label} audit session: ${error.message}`);
    }
  };
  const onInterrupt = () => {
    revoke();
    process.exit(130);
  };
  process.once("SIGINT", onInterrupt);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...finalArgs], {
      stdio: "inherit",
      cwd: root,
      env: {
        ...process.env,
        ...sessionEnv,
        [AUDIT_TARGET_ENV]: target?.id ?? "",
        [AUDIT_ROUTE_PLAN_ENV]: routePlan
          ? JSON.stringify({ seed: routePlan.seed, skip: routePlan.skip.map(({ route }) => route) })
          : "",
      },
    });

    const finish = (code) => {
      process.off("SIGINT", onInterrupt);
      revoke();
      resolve(code);
    };

    child.on("exit", (code, signal) => {
      finish(signal ? 1 : (code ?? 1));
    });

    child.on("error", () => {
      finish(1);
    });
  });
}

export function outputPathForTarget(targetId) {
  return path.join(root, ".unlighthouse", targetId);
}
