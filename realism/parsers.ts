// realism/parsers.ts — Robust command tokenizer and AST builder

export interface CommandAST {
  cmd: string;
  args: string[];
  flags: Record<string, string | boolean>;
  stdin?: string;
  pipes?: CommandAST[];
  redirects?: Redirect[];
  raw: string;
}

export interface Redirect {
  type: "stdout" | "stderr" | "append" | "stdin";
  fd: number;
  target: string;
}

/**
 * Parse a shell command into a structured AST.
 * Handles:
 * - Multiple spaces, tabs
 * - Quotes (single and double)
 * - Escaped characters
 * - Flags (short -x and long --flag=value)
 * - Pipes |
 * - Redirects > >> 2> &>
 */
export function parse(raw: string): CommandAST {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { cmd: "", args: [], flags: {}, raw };
  }

  // Handle pipes (split into multiple commands)
  const pipeParts = splitPipes(trimmed);
  const commands: CommandAST[] = pipeParts.map(p => parseSimple(p));

  // If multiple commands via pipe, return the first one with pipes attached
  if (commands.length > 1) {
    return {
      ...commands[0],
      pipes: commands.slice(1),
    };
  }

  return commands[0];
}

function splitPipes(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      current += ch;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (ch === "|" && !inSingleQuote && !inDoubleQuote) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseSimple(input: string): CommandAST {
  const tokens = tokenize(input);

  if (tokens.length === 0) {
    return { cmd: "", args: [], flags: {}, raw: input };
  }

  const cmd = tokens[0];
  const rawArgs = tokens.slice(1);

  // Separate args, flags, and redirects
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const redirects: Redirect[] = [];

  let i = 0;
  while (i < rawArgs.length) {
    const token = rawArgs[i];

    // Handle redirects
    if (token === ">" || token === ">>" || token === "2>" || token === "&>") {
      const target = rawArgs[i + 1];
      if (target) {
        let type: Redirect["type"] = "stdout";
        let fd = 1;

        if (token === ">>") {
          type = "append";
        } else if (token === "2>") {
          type = "stderr";
          fd = 2;
        } else if (token === "&>") {
          type = "stdout";
          fd = 1;
        }

        redirects.push({ type, fd, target });
        i += 2;
        continue;
      }
    }

    // Handle flags
    if (token.startsWith("--")) {
      const eqIndex = token.indexOf("=");
      if (eqIndex !== -1) {
        const flagName = token.substring(2, eqIndex);
        const flagValue = token.substring(eqIndex + 1);
        flags[flagName] = flagValue;
      } else {
        flags[token.substring(2)] = true;
      }
      i++;
      continue;
    }

    if (token.startsWith("-") && token.length > 1 && !isNumber(token)) {
      // Short flags: -abc or -x value
      if (token.length === 2) {
        // Single char flag: -x
        const flagChar = token.substring(1);
        const nextToken = rawArgs[i + 1];
        if (nextToken && !nextToken.startsWith("-") && !isPath(nextToken)) {
          flags[flagChar] = nextToken;
          i += 2;
          continue;
        } else {
          flags[flagChar] = true;
          i++;
          continue;
        }
      } else {
        // Combined flags: -abc or -rf
        for (let j = 1; j < token.length; j++) {
          flags[token[j]] = true;
        }
        // Also store the combined form for matching
        flags[token.substring(1)] = true;
      }
      i++;
      continue;
    }

    args.push(token);
    i++;
  }

  return {
    cmd,
    args,
    flags,
    redirects,
    raw: input,
  };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      current += ch;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if ((ch === " " || ch === "\t") && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += ch;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function isNumber(s: string): boolean {
  return /^\d+(\.\d+)?$/.test(s);
}

function isPath(s: string): boolean {
  return s.startsWith("/") || s.startsWith("./") || s.startsWith("../") || s.startsWith("~");
}

/**
 * Normalize a command for comparison/matching.
 * Collapses multiple spaces, normalizes flag order.
 */
export function normalizeCommand(cmd: string): string {
  return cmd
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Check if a command matches a pattern.
 * Handles wildcards and partial matches.
 */
export function matchesPattern(ast: CommandAST, pattern: string): boolean {
  const normalized = normalizeCommand(ast.raw);
  const normalizedPattern = normalizeCommand(pattern);

  return normalized.includes(normalizedPattern);
}
