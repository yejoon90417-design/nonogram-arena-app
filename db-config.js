function isEnabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function isDisabled(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "false" || normalized === "disable" || normalized === "disabled";
}

function isLocalDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    const host = String(parsed.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function shouldUseSsl(env, databaseUrl) {
  if (isDisabled(env.PGSSL) || isDisabled(env.PGSSLMODE)) return false;
  if (env.PGSSLMODE === "require" || isEnabled(env.PGSSL) || env.NODE_ENV === "production") {
    return true;
  }
  return Boolean(databaseUrl) && !isLocalDatabaseUrl(databaseUrl);
}

function buildDbConfig(env = process.env) {
  const databaseUrl = String(env.DATABASE_URL || "").trim();
  const useSsl = shouldUseSsl(env, databaseUrl);
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    };
  }
  return {
    host: env.PGHOST || "localhost",
    port: Number(env.PGPORT || 5432),
    user: env.PGUSER || "postgres",
    password: env.PGPASSWORD || "1234",
    database: env.PGDATABASE || "nonogram_prod",
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
}

function describeDbTarget(config) {
  if (config.connectionString) {
    try {
      const parsed = new URL(config.connectionString);
      return `${parsed.hostname}${parsed.pathname || ""}`;
    } catch {
      return "DATABASE_URL";
    }
  }
  return `${config.user || "unknown"}@${config.host || "localhost"}:${config.port || 5432}/${config.database || ""}`;
}

function getDbName(config) {
  if (config.connectionString) {
    try {
      return decodeURIComponent(new URL(config.connectionString).pathname.replace(/^\//, ""));
    } catch {
      return "";
    }
  }
  return String(config.database || "");
}

module.exports = {
  buildDbConfig,
  describeDbTarget,
  getDbName,
};
