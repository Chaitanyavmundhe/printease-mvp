import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeStorage } from "electron";

let configFilePath = "";
let secretFilePath = "";
let memoryConfig = {};
let memorySecrets = {};

function stripSecrets(value = {}) {
  const nextConfig = { ...value };

  for (const key of Object.keys(nextConfig)) {
    if (/token|secret|password|authorization|signed/i.test(key)) {
      delete nextConfig[key];
    }
  }

  return nextConfig;
}

export function setConfigDirectory(directory) {
  configFilePath = path.join(directory, "config.json");
  secretFilePath = path.join(directory, "agent-secrets.json");
}

export async function loadConfig() {
  if (!configFilePath) return { ...memoryConfig };

  try {
    const rawConfig = await readFile(configFilePath, "utf8");
    memoryConfig = stripSecrets(JSON.parse(rawConfig));
  } catch {
    memoryConfig = {};
  }

  return { ...memoryConfig };
}

export async function saveConfig(nextConfig = {}) {
  memoryConfig = stripSecrets({
    ...memoryConfig,
    ...nextConfig,
  });

  if (configFilePath) {
    await mkdir(path.dirname(configFilePath), { recursive: true });
    await writeFile(configFilePath, `${JSON.stringify(memoryConfig, null, 2)}\n`, "utf8");
  }

  return { ...memoryConfig };
}

function normalizeSecrets(value = {}) {
  return {
    accessToken: typeof value.accessToken === "string" ? value.accessToken : "",
    refreshToken: typeof value.refreshToken === "string" ? value.refreshToken : "",
  };
}

function canUseSafeStorage() {
  return Boolean(safeStorage?.isEncryptionAvailable?.());
}

export async function loadSecretConfig() {
  if (!secretFilePath || !canUseSafeStorage()) return { ...memorySecrets };

  try {
    const rawConfig = await readFile(secretFilePath, "utf8");
    const payload = JSON.parse(rawConfig);
    const encrypted = Buffer.from(String(payload.data || ""), "base64");
    const decrypted = safeStorage.decryptString(encrypted);
    memorySecrets = normalizeSecrets(JSON.parse(decrypted));
  } catch {
    memorySecrets = {};
  }

  return { ...memorySecrets };
}

export async function saveSecretConfig(nextSecrets = {}) {
  memorySecrets = normalizeSecrets({
    ...memorySecrets,
    ...nextSecrets,
  });

  // TODO: use an OS keychain abstraction for packaged production builds.
  if (secretFilePath && canUseSafeStorage()) {
    const encrypted = safeStorage.encryptString(JSON.stringify(memorySecrets));
    await mkdir(path.dirname(secretFilePath), { recursive: true });
    await writeFile(secretFilePath, `${JSON.stringify({
      version: 1,
      data: encrypted.toString("base64"),
    }, null, 2)}\n`, "utf8");
  }

  return { ...memorySecrets };
}
