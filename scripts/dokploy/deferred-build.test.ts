import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { buildCommand, snapshotArgs, mainHealthy, promote, MAIN_CONSTRAINT } = require("./deferred-build.cjs");
const directories: string[] = [];
function temporary() {
  const directory = mkdtempSync(path.join(tmpdir(), "deferred-test-"));
  directories.push(directory);
  return directory;
}
afterEach(() => directories.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true })));

function fixture() {
  const root = temporary();
  const directory = path.join(root, "job");
  mkdirSync(path.join(directory, "context"), { recursive: true });
  const job = {
    id: "release-a", name: "planner", root, directory, file: path.join(directory, "job.json"),
    localId: "image-a", source: "registry/planner@sha256:main", armDigest: "sha256:arm",
    app: { image: "registry/planner:latest", platforms: ["linux/amd64", "linux/arm64"], backgroundNode: "pi" },
    args: ["--build-arg", "EXAMPLE=private"], status: "building-arm",
  };
  writeFileSync(path.join(root, "planner.deferred.json"), JSON.stringify({ id: job.id }));
  writeFileSync(path.join(root, "planner.json"), JSON.stringify({ localId: job.localId, targets: [job.app.image] }));
  const exec = vi.fn((args: string[]) => {
    if (args[0] === "ps") return "main-container";
    if (args[0] === "inspect") return JSON.stringify([{ Image: "image-a", State: { Running: true, Health: { Status: "healthy" } } }]);
    if (args.includes("--raw")) return JSON.stringify({ manifests: [{ platform: { os: "linux", architecture: "amd64" } }, { platform: { os: "linux", architecture: "arm64" } }] });
    if (args.includes("--format")) return JSON.stringify(`sha256:${"a".repeat(64)}`);
    return "";
  });
  return { job, exec };
}

describe("deferred Dokploy builds", () => {
  it("builds one platform at a time from the same snapshot with a unique release label", () => {
    const { job } = fixture();
    const main = buildCommand(job, "linux/amd64", "main.json");
    const arm = buildCommand(job, "linux/arm64", "arm.json");
    expect(main[main.indexOf("--platform") + 1]).toBe("linux/amd64");
    expect(arm[arm.indexOf("--platform") + 1]).toBe("linux/arm64");
    expect(main).toContain("io.dokploy.deferred.release=release-a");
    expect(arm).toContain("io.dokploy.deferred.release=release-a");
    expect(main.slice(-job.args.length)).toEqual(arm.slice(-job.args.length));
    expect(() => buildCommand(job, "linux/386", "metadata.json")).toThrow("Unsupported platform");
  });

  it("snapshots the source and Dockerfile before a later checkout replaces them", () => {
    const root = temporary();
    const context = path.join(root, "checkout");
    const directory = path.join(root, "job");
    mkdirSync(context);
    writeFileSync(path.join(context, "Dockerfile"), "FROM node:22");
    mkdirSync(path.join(context, ".git"));
    writeFileSync(path.join(context, ".git", "config"), "excluded");
    const args = snapshotArgs(["-f", "checkout/Dockerfile", "--build-arg", "A=value", "checkout"], directory, root);
    writeFileSync(path.join(context, "Dockerfile"), "changed checkout");
    expect(readFileSync(args[1], "utf8")).toBe("FROM node:22");
    expect(args).toContain("A=value");
    expect(args.at(-1)).toBe(path.join(directory, "context"));
    expect(existsSync(path.join(directory, "context", ".git"))).toBe(false);
  });

  it("rejects a Dockerfile outside the frozen build context", () => {
    const root = temporary();
    mkdirSync(path.join(root, "context"));
    expect(() => snapshotArgs(["-f", "../Dockerfile", "context"], path.join(root, "job"), root)).toThrow("inside the build context");
  });

  it("supports an inline Dockerfile option", () => {
    const root = temporary();
    mkdirSync(path.join(root, "context"));
    writeFileSync(path.join(root, "context", "Dockerfile"), "FROM node:22");
    expect(snapshotArgs(["--file=context/Dockerfile", "context"], path.join(root, "job"), root)[0])
      .toBe(`--file=${path.join(root, "job/context/Dockerfile")}`);
  });

  it("requires this release's healthy main container before building ARM", () => {
    const { job, exec } = fixture();
    expect(mainHealthy(exec, job)).toBe(true);
    exec.mockImplementation((args: string[]) => args[0] === "ps" ? "container" : JSON.stringify([{ Image: "old-release", State: { Running: true, Health: { Status: "healthy" } } }]));
    expect(mainHealthy(exec, job)).toBe(false);
    exec.mockImplementation((args: string[]) => args[0] === "ps" ? "container" : JSON.stringify([{ Image: job.localId, State: { Running: true, Health: { Status: "starting" } } }]));
    expect(mainHealthy(exec, job)).toBe(false);
  });

  it("never publishes or updates the service for a superseded release", () => {
    const { job, exec } = fixture();
    writeFileSync(path.join(job.root, "planner.deferred.json"), JSON.stringify({ id: "newer-release" }));
    promote(job, exec, vi.fn());
    expect(exec).not.toHaveBeenCalled();
    expect(JSON.parse(readFileSync(job.file, "utf8")).status).toBe("superseded");
    expect(existsSync(path.join(job.directory, "context"))).toBe(false);
  });

  it("does not publish if the main release is no longer running", () => {
    const { job, exec } = fixture();
    exec.mockReturnValue("");
    expect(() => promote(job, exec, vi.fn())).toThrow("Main release changed");
    expect(exec.mock.calls.some(([args]) => args[0] === "buildx")).toBe(false);
  });

  it("verifies both architectures before publishing latest or moving to the Pi", () => {
    const { job, exec } = fixture();
    const check = vi.fn(() => { throw new Error("missing ARM"); });
    expect(() => promote(job, exec, check)).toThrow("missing ARM");
    expect(exec.mock.calls.some(([args]) => args.includes(job.app.image))).toBe(false);
    expect(exec.mock.calls.some(([args]) => args[0] === "service")).toBe(false);
  });

  it("combines immutable images and moves the verified release to the Pi", () => {
    const { job, exec } = fixture();
    const check = vi.fn();
    promote(job, exec, check);
    expect(check).toHaveBeenCalledWith(expect.any(String), job.app.platforms);
    expect(exec).toHaveBeenCalledWith(["buildx", "imagetools", "create", "--tag", "registry/planner:release-release-a", job.source, "registry/planner@sha256:arm"]);
    expect(exec).toHaveBeenCalledWith(["service", "update", "--detach=true", "--with-registry-auth", "--image", `registry/planner@sha256:${"a".repeat(64)}`, "--constraint-rm", MAIN_CONSTRAINT, "--constraint-add", "node.hostname==pi", job.name]);
    const state = JSON.parse(readFileSync(path.join(job.root, "planner.json"), "utf8"));
    expect(state.platforms).toEqual(job.app.platforms);
    expect(state.localId).toBe(job.localId);
    const finished = readFileSync(job.file, "utf8");
    expect(finished).not.toContain("EXAMPLE=private");
    expect(JSON.parse(finished).status).toBe("promoted");
  });
});
