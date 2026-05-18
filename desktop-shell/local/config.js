let config = {};

function removeSensitiveFields(value) {
  const nextConfig = { ...value };

  for (const key of Object.keys(nextConfig)) {
    if (/token|secret|password|signed/i.test(key)) {
      delete nextConfig[key];
    }
  }

  return nextConfig;
}

function loadConfig() {
  return { ...config };
}

function saveConfig(nextConfig = {}) {
  config = removeSensitiveFields(nextConfig);
  return loadConfig();
}

module.exports = {
  loadConfig,
  saveConfig,
};
