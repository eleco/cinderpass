// Renders .do/app.json with secrets from Git-ignored env files into
// .do/app.secrets.local.json (mode 600). Never prints secret values.
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";

const env = {};
for (const file of [".env.production.local", ".env.digitalocean.local"]) {
  try { Object.assign(env, parseEnv(await readFile(file, "utf8"))); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
Object.assign(env, process.env);
env.KV_REST_API_URL ||= env.UPSTASH_REDIS_REST_URL;
env.KV_REST_API_TOKEN ||= env.UPSTASH_REDIS_REST_TOKEN;

const spec = JSON.parse(await readFile(".do/app.json", "utf8"));
const missing = [];
for (const component of spec.services)
  for (const entry of component.envs)
    if (entry.value === "__SET_IN_DO__") {
      const value = env[entry.key]?.trim();
      if (!value || value === "[SENSITIVE]") missing.push(entry.key);
      else entry.value = value;
    }
if (missing.length) {
  console.error(`Missing real values for: ${missing.join(", ")}. Put them in .env.digitalocean.local.`);
  process.exit(1);
}
await writeFile(".do/app.secrets.local.json", JSON.stringify(spec, null, 2) + "\n", { mode: 0o600 });
console.log("Wrote .do/app.secrets.local.json (contains secrets; Git-ignored).");
