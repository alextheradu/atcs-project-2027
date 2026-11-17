/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

// Loaded by the persistent Dokploy Docker wrapper, outside the application image.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const ROOT = "/etc/dokploy/multiarch";
const MAIN_CONSTRAINT = "node.platform.arch==x86_64";

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function write(file, data) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function current(job) {
  return read(path.join(job.root, `${job.name}.deferred.json`)).id === job.id;
}

function locked(job, command) {
  const result = spawnSync("/usr/bin/flock", [
    "--exclusive", path.join(job.root, `${job.name}.deferred.lock`),
    process.execPath, __filename, command, job.file,
  ], { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(`Deferred ${command} failed`);
}

function repository(image) {
  return image.replace(/:[^/:]+$/, "");
}

function buildCommand(job, platform, metadata) {
  if (!["linux/amd64", "linux/arm64"].includes(platform)) throw new Error("Unsupported platform");
  const tag = platform === "linux/amd64" ? "main" : "arm";
  return ["buildx", "build", "--builder", job.builder, "--platform", platform,
    "--tag", `${repository(job.app.image)}:${tag}-${job.id}`,
    "--label", `io.dokploy.deferred.release=${job.id}`,
    "--push", "--metadata-file", metadata, ...job.args];
}

function snapshotArgs(args, directory, cwd = process.cwd()) {
  // Dokploy's Dockerfile builds use a local context as the final argument.
  const context = path.resolve(cwd, args.at(-1));
  if (!fs.statSync(context).isDirectory()) throw new Error("Deferred builds need a local context");
  const target = path.join(directory, "context");
  fs.cpSync(context, target, {
    recursive: true,
    filter: source => ![".git", "node_modules", ".next"].includes(path.basename(source)),
  });
  const rest = args.slice(0, -1);
  for (let i = 0; i < rest.length; i++) {
    const separate = rest[i] === "-f" || rest[i] === "--file";
    const inline = rest[i].startsWith("--file=");
    if (!separate && !inline) continue;
    const original = separate ? rest[i + 1] : rest[i].slice(7);
    const relative = path.relative(context, path.resolve(cwd, original));
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Deferred Dockerfile must be inside the build context");
    }
    if (separate) rest[++i] = path.join(target, relative);
    else rest[i] = `--file=${path.join(target, relative)}`;
  }
  return [...rest, target];
}

function build({ name, app, config, info, exec, root = ROOT }) {
  if (app.platforms.join(",") !== "linux/amd64,linux/arm64" || !app.backgroundNode) {
    throw new Error("Deferred builds require AMD64, ARM64 and a background node");
  }
  if (app.runtimeRefresh) throw new Error("Runtime refresh is not supported for deferred builds");
  const id = randomUUID();
  const directory = path.join(root, "deferred", id);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const job = {
    id, root, name, app, builder: config.builder, directory,
    file: path.join(directory, "job.json"), status: "building-main",
    args: snapshotArgs(info.rest, directory),
  };
  write(job.file, job);
  locked(job, "reserve");
  const metadata = path.join(directory, "main.json");
  console.log("[deferred] Building AMD64 first; ARM64 will follow after the main server is healthy");
  exec(buildCommand(job, "linux/amd64", metadata));
  const digest = read(metadata)["containerimage.digest"];
  if (!/^sha256:[a-f0-9]{64}$/.test(digest || "")) throw new Error("Missing main image digest");
  job.source = `${repository(app.image)}@${digest}`;
  exec(["pull", "--platform", "linux/amd64", job.source]);
  job.localId = exec(["image", "inspect", "--format", "{{.Id}}", job.source], { capture: true });
  exec(["tag", job.source, `${name}:latest`]);
  write(path.join(root, `${name}.json`), {
    source: job.source, digest, localId: job.localId, platforms: ["linux/amd64"], targets: [app.image],
  });
  job.status = "waiting-main";
  write(job.file, job);
  // A separate container survives a Dokploy restart and keeps its own build snapshot.
  const parent = process.env.HOSTNAME;
  const image = exec(["inspect", "--format", "{{.Image}}", parent], { capture: true });
  exec(["run", "--detach", "--restart", "on-failure:3", "--name", `dokploy-arm-${id}`,
    "--log-opt", "max-size=10m", "--log-opt", "max-file=2",
    "--volumes-from", parent, "--entrypoint", "node", image,
    path.join(root, "deferred-build.cjs"), "worker", job.file], { capture: true });
  console.log(`[deferred] Main image ready. Pi build job: ${id}`);
}

function mainHealthy(exec, job) {
  const ids = exec(["ps", "--quiet", "--filter", `label=com.docker.swarm.service.name=${job.name}`],
    { capture: true }).split("\n").filter(Boolean);
  return ids.some(id => {
    const container = JSON.parse(exec(["inspect", id], { capture: true }))[0];
    return container.Image === job.localId && container.State.Running &&
      (!container.State.Health || container.State.Health.Status === "healthy");
  });
}

async function worker(job) {
  const wrapper = require(path.join(job.root, "docker"));
  const exec = wrapper.registryRunner(wrapper.run, job.app, job.root);
  wrapper.authenticate(job.app, exec);
  const deadline = Date.now() + 15 * 60_000;
  while (current(job) && !mainHealthy(exec, job)) {
    if (Date.now() > deadline) throw new Error("Main deployment did not become healthy within 15 minutes");
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!current(job)) return finish(job, "superseded");
  job.status = "building-arm";
  write(job.file, job);
  const metadata = path.join(job.directory, "arm.json");
  exec(buildCommand(job, "linux/arm64", metadata));
  job.armDigest = read(metadata)["containerimage.digest"];
  if (!/^sha256:[a-f0-9]{64}$/.test(job.armDigest || "")) throw new Error("Missing ARM image digest");
  write(job.file, job);
  locked(job, "promote");
}

function finish(job, status) {
  job.status = status;
  write(job.file, job);
  // Build arguments and environment files can hold secrets. Keep only status metadata.
  fs.rmSync(path.join(job.directory, "context"), { recursive: true, force: true });
  delete job.args;
  write(job.file, job);
  console.log(`[deferred] ${job.name}: ${status}`);
}

function promote(job, exec, checkIndex) {
  if (!current(job)) return finish(job, "superseded");
  if (!mainHealthy(exec, job)) throw new Error("Main release changed before ARM promotion");
  const combined = `${repository(job.app.image)}:release-${job.id}`;
  exec(["buildx", "imagetools", "create", "--tag", combined, job.source,
    `${repository(job.app.image)}@${job.armDigest}`]);
  const raw = exec(["buildx", "imagetools", "inspect", "--raw", combined], { capture: true });
  checkIndex(raw, job.app.platforms);
  const digest = exec(["buildx", "imagetools", "inspect", combined, "--format", "{{json .Manifest.Digest}}"],
    { capture: true });
  const combinedDigest = JSON.parse(digest);
  if (!/^sha256:[a-f0-9]{64}$/.test(combinedDigest || "")) throw new Error("Invalid combined image digest");
  const source = `${repository(job.app.image)}@${combinedDigest}`;
  exec(["buildx", "imagetools", "create", "--tag", job.app.image, source]);
  const stateFile = path.join(job.root, `${job.name}.json`);
  const state = read(stateFile);
  write(stateFile, { ...state, source, digest: source.split("@")[1], platforms: job.app.platforms });
  // Dokploy's saved placement always starts releases on the main server. Only a
  // verified dual-architecture image is moved to the Pi. Swarm keeps the main
  // task until its replacement is healthy and rolls back there on failure.
  exec(["service", "update", "--detach=true", "--with-registry-auth", "--image", source,
    "--constraint-rm", MAIN_CONSTRAINT,
    "--constraint-add", `node.hostname==${job.app.backgroundNode}`, job.name]);
  finish(job, "promoted");
}

module.exports = { build, buildCommand, snapshotArgs, mainHealthy, promote, MAIN_CONSTRAINT };

if (require.main === module) {
  const [command, file] = process.argv.slice(2);
  const job = read(file);
  Promise.resolve().then(() => {
    if (command === "reserve") {
      write(path.join(job.root, `${job.name}.deferred.json`), { id: job.id, file });
    } else if (command === "worker") return worker(job);
    else if (command === "promote") {
      const wrapper = require(path.join(job.root, "docker"));
      const exec = wrapper.registryRunner(wrapper.run, job.app, job.root);
      wrapper.authenticate(job.app, exec);
      promote(job, exec, wrapper.checkIndex);
    } else throw new Error("Unknown deferred build command");
  }).catch(() => {
    // Never log subprocess arguments, environment values or registry responses.
    console.error(`[deferred] ${job.name}: ${command} failed. Main deployment remains available.`);
    process.exitCode = 1;
  });
}
