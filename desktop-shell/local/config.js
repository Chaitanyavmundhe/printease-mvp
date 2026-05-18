let config = {};

export function loadConfig() {
  return { ...config };
}

export function saveConfig(nextConfig = {}) {
  // Do not store secrets here. Future tokens must go to the OS keychain, not plain files.
  const safeConfig = { ...nextConfig };

  for (const key of Object.keys(safeConfig)) {
    if (/token|secret|password|authorization|signed/i.test(key)) {
      delete safeConfig[key];
    }
  }

  config = safeConfig;
  return loadConfig();
}
