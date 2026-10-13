const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const walkWorkspace = (directory, prefix = "") => {
  const excludedDirectories = new Set([
    ".git",
    "node_modules",
    "dist",
    "venv",
    "__pycache__",
  ]);
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkWorkspace(absolute, relative));
    } else if (!/^\.env(?:\.|$)/.test(entry.name) || entry.name === ".env.example") {
      results.push(relative);
    }
  }
  return results;
};

let listedFiles;
try {
  listedFiles = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repositoryRoot }
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
} catch {
  // Restricted sandboxes may disallow child processes. CI uses the Git-backed path.
  listedFiles = walkWorkspace(repositoryRoot);
}

const safeValue = (value, file) => {
  const normalized = value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
  return (
    !normalized ||
    file.endsWith(".env.example") ||
    file.includes("/tests/") ||
    normalized.startsWith("${") ||
    normalized.startsWith("process.env") ||
    normalized.startsWith("os.environ") ||
    /^\d+,?$/.test(normalized) ||
    normalized.includes("your_") ||
    normalized.includes("replace_") ||
    normalized.includes("example") ||
    normalized.includes("testsecret") ||
    normalized.includes("test-")
  );
};

const findings = [];
for (const relativeFile of listedFiles) {
  const normalizedFile = relativeFile.replaceAll("\\", "/");
  if (normalizedFile === "scripts/scan-secrets.js") continue;

  const absoluteFile = path.join(repositoryRoot, relativeFile);
  let content;
  try {
    content = fs.readFileSync(absoluteFile, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;

  content.split(/\r?\n/).forEach((line, index) => {
    const assignment = line.match(
      /^\s*(?:-\s*)?([A-Z][A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*[:=]\s*(.+?)\s*$/
    );
    if (assignment && !safeValue(assignment[2], normalizedFile)) {
      findings.push(`${normalizedFile}:${index + 1} (${assignment[1]})`);
    }

    const fallback = line.match(
      /process\.env\.([A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY)[A-Z0-9_]*)\s*\|\|\s*['"]([^'"]+)['"]/
    );
    if (fallback && !safeValue(fallback[2], normalizedFile)) {
      findings.push(`${normalizedFile}:${index + 1} (${fallback[1]} fallback)`);
    }

    if (/^-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(line)) {
      findings.push(`${normalizedFile}:${index + 1} (private key)`);
    }
    if (/\bAKIA[0-9A-Z]{16}\b/.test(line)) {
      findings.push(`${normalizedFile}:${index + 1} (AWS access key)`);
    }
    if (/\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(line)) {
      findings.push(`${normalizedFile}:${index + 1} (GitHub token)`);
    }
  });
}

if (findings.length) {
  console.error("Potential committed secrets detected:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`Secret scan passed (${listedFiles.length} repository files checked).`);
