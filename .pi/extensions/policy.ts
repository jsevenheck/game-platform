import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { resolve, relative } from "node:path";

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function matches(input: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(input));
}

/** Gibt true zurück wenn `absPath` innerhalb von `rootDir` liegt */
function isInsideRoot(absPath: string, rootDir: string): boolean {
  const rel = relative(rootDir, absPath);
  return !rel.startsWith("..") && !rel.startsWith("/");
}

// ─── Datei-Richtlinien ────────────────────────────────────────────────────────

const READ_DENY = [
  /(?:^|\/)\.env(\.[^/]*)?$/,
  /(?:^|\/)\.git\//,
  /(?:^|\/)node_modules\//,
  /\.pem$/,
  /\.key$/,
  /\.crt$/,
  /\.log$/,
];

const WRITE_DENY = [
  /(?:^|\/)\.env(\.[^/]*)?$/,
  /(?:^|\/)\.claude\/settings\.json$/,
  /(?:^|\/)pnpm-lock\.yaml$/,
  /(?:^|\/)package\.json$/,
  /(?:^|\/)tsconfig[^/]*\.json$/,
];

const WRITE_ALLOW = [
  /\.ts$/,
  /\.tsx$/,
  /\.vue$/,
  /\.js$/,
  /\.cds$/,
  /\.json$/,
  /\.md$/,
  /\.css$/,
  /\.html$/,
];

// ─── Bash-Richtlinien ─────────────────────────────────────────────────────────

const BASH_ALLOW = [
  /^pnpm\s+run\s+(test|test:e2e|typecheck|dev|build)(\s|$)/,
  /^pnpm\s+(test|typecheck|build|format|lint|test:e2e)(:|$|\s)/,
  /^pnpm\s+(install|add)(\s|$)/,
  /^pnpm\s+exec\s+playwright\b/,
  /^pnpm\s+playwright-cli\b/,
  /^git\s+(status|diff|log)(\s|$)/,
];

const BASH_DENY = [
  /^rm\s+-rf\b/,
  /^sudo\b/,
  /^su\b/,
  /^chmod\b/,
  /^chown\b/,
  /^git\s+add\b/,
  /^git\s+commit\b/,
  /^git\s+push\b/,
  /^git\s+merge\b/,
  /^git\s+rebase\b/,
  /^git\s+reset\b/,
  /^cf\s+(push|login)\b/,
  /^npm\s+publish\b/,
  /^cds\s+deploy\b/,
  /\b(cat|less|more|grep|awk|sed)\s[^|]*\.env/,
];

// ─── Extension ────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    const { toolName, input } = event;
    const projectRoot = ctx.cwd;

    // ── Datei-Tools ──────────────────────────────────────────────────────────
    if (toolName === "read" || toolName === "write" || toolName === "edit") {
      const rawPath = String(input?.path ?? "");
      if (!rawPath) return;

      // Absoluten Pfad auflösen (relativ zum Projektverzeichnis)
      const absPath = resolve(projectRoot, rawPath);

      // CWD-Grenze: kein Zugriff außerhalb des Projektverzeichnisses
      if (!isInsideRoot(absPath, projectRoot)) {
        return {
          block: true,
          reason: `${toolName} außerhalb des Projektverzeichnisses blockiert: ${absPath} (root: ${projectRoot})`,
        };
      }

      if (toolName === "read" && matches(absPath, READ_DENY)) {
        return { block: true, reason: `Read blocked (protected): ${absPath}` };
      }

      if (toolName === "write" || toolName === "edit") {
        if (matches(absPath, WRITE_DENY)) {
          return { block: true, reason: `Write/Edit blocked (protected file): ${absPath}` };
        }
        if (!matches(absPath, WRITE_ALLOW)) {
          return {
            block: true,
            reason: `Write/Edit blocked (unsupported type): ${absPath} — erlaubt: .ts .tsx .vue .js .cds .json .md .css .html`,
          };
        }
      }
    }

    // ── Bash-Tool ─────────────────────────────────────────────────────────────
    if (toolName === "bash") {
      const command = String(input?.command ?? "").trim();
      if (!command) return;

      if (matches(command, BASH_DENY)) {
        return { block: true, reason: `Bash blockiert: ${command}` };
      }

      if (!matches(command, BASH_ALLOW)) {
        return {
          block: true,
          reason: `Bash nicht in der Allowlist: ${command}`,
        };
      }
    }
  });
}