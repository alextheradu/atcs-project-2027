/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

// Run inside the Dokploy container. Requires its existing multiarch wrapper.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = "/etc/dokploy/multiarch";
const name = process.argv[2];
const backgroundNode = process.argv[3];
if (!/^[a-z0-9-]+$/.test(name || "") || !/^[a-zA-Z0-9_.-]+$/.test(backgroundNode || "")) {
  throw new Error("Usage: node install-deferred.cjs APP_NAME PI_NODE_NAME");
}
const configFile = path.join(root, "config.json");
const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
const app = config.apps[name];
if (!app || app.platforms.join(",") !== "linux/amd64,linux/arm64" || app.runtimeRefresh) {
  throw new Error("Application must already support both architectures without runtime refresh");
}
const docker = args => execFileSync("/usr/bin/docker", args, { encoding: "utf8" }).trim();
const database = docker(["ps", "-q", "--filter", "name=dokploy-postgres.1"]);
if (!/^[a-f0-9]+$/.test(database)) throw new Error("Cannot uniquely identify Dokploy database");
const sql = query => docker(["exec", database, "psql", "-U", "dokploy", "-d", "dokploy", "-Atc", query]);
const placement = JSON.parse(sql(`select coalesce("placementSwarm", '{}') from application where "appName"='${name}'`));
const constraint = "node.platform.arch==x86_64";
if ((placement.Constraints || []).some(value => value !== constraint)) {
  throw new Error("Review existing placement constraints before enabling deferred builds");
}
const wrapperFile = path.join(root, "docker");
let wrapper = fs.readFileSync(wrapperFile, "utf8");
const needle = "    authenticate(app, exec);\n    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dokploy-multiarch-'));";
const insertion = "    authenticate(app, exec);\n    if (app.deferredArm) {\n      require(path.join(root, 'deferred-build.cjs')).build({ name, app, config, info, exec, root });\n      return;\n    }\n    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'dokploy-multiarch-'));";
if (!wrapper.includes("if (app.deferredArm)")) {
  if (wrapper.split(needle).length !== 2) throw new Error("Unexpected multiarch wrapper version");
  wrapper = wrapper.replace(needle, insertion);
}
wrapper = wrapper.replace(
  "console.log(`[multiarch] Published ${args[1]} with both architectures`);",
  "console.log(`[multiarch] Published ${args[1]} for ${state.platforms.join(',')}`);",
);
for (const file of [wrapperFile, configFile]) {
  const backup = `${file}.before-deferred`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(backup, 0o600);
}
fs.copyFileSync(path.join(__dirname, "deferred-build.cjs"), path.join(root, "deferred-build.cjs"));
// Preserve the inode: this file is also bind-mounted at /usr/local/bin/docker.
fs.writeFileSync(wrapperFile, wrapper);
app.deferredArm = true;
app.backgroundNode = backgroundNode;
fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
const placementBackup = path.join(root, `${name}.placement.before-deferred.json`);
if (!fs.existsSync(placementBackup)) fs.writeFileSync(placementBackup, JSON.stringify(placement), { mode: 0o600 });
placement.Constraints = [constraint];
sql(`update application set "placementSwarm"='${JSON.stringify(placement).replaceAll("'", "''")}' where "appName"='${name}'`);
console.log(`Enabled main-first deployments for ${name}; background target: ${backgroundNode}`);
