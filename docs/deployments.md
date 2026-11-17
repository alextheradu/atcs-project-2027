# Deployments and unsaved edits

The Docker build gives each release a unique `NEXT_DEPLOYMENT_ID`. Next.js detects an older browser tab and loads the new release during navigation. An operator may supply the ID as a Docker build argument instead. Use the same ID for replicas of one release, and a new ID for each release. Outside Docker, set `NEXT_DEPLOYMENT_ID` when running `npm run build`.

Editors write recovery drafts synchronously on each change to `sessionStorage`, scoped by the signed-in user and the edited resource. Keys do not include the release ID. A reload restores the draft and labels it as unsaved. Server validation and authorization still apply when the user saves. Recovery never submits an edit automatically. If saved data changed while the user was away, the editor asks them to review the recovered draft before saving.

A confirmed save clears only the submitted revision. Typing during that request stays recoverable. Validation errors and interrupted requests keep the draft. When browser storage is blocked or full, the editor warns the user and asks the browser to confirm a reload while work remains unsaved.

Planner actions keep one pending course change until the server confirms it. An interrupted action offers Retry and Discard. Retry compares the change with the latest loaded plan first, so a course that was added before the response was lost is not added twice. Pending changes are never applied automatically, and submitted plans remain read-only.

Transcript recovery stores only parsed course review data in the browser tab, never the PDF or raw PDF text. It does not upload the file. Recovery drafts are temporary: they survive reloads and deployments in the same tab, but are not a backup across devices or closed tabs. Drafts from another account are never loaded into the editor.

Keep the existing production database volume and `AUTH_SECRET` across releases. Container replacement must reuse the database, not recreate it. Migrations and the create-only seed run through the existing entrypoint.

## Main server first, Pi afterward

The live Dokploy application is named `casamento-project-prod-frontend-j38kif`, despite serving this course planner. It uses the existing persistent Docker wrapper and BuildKit builder under `/etc/dokploy/multiarch`. Previously each deployment waited for both AMD64 and emulated ARM64 builds and their registry upload. On November 17 the native Next build took 9.5 seconds, while ARM dependency installation took 197 seconds and its Next build took 97 seconds.

This application now enables `deferredArm` in the wrapper configuration:

1. Dokploy builds and publishes AMD64, then deploys to `atlas`. Its saved placement is `node.platform.arch==x86_64`.
2. A separate `dokploy-arm-<release-id>` container waits for that exact release's main-server container to become healthy. A unique image label distinguishes releases even when all build layers are cached.
3. It builds ARM64 from a private snapshot of the same checkout and build arguments. A newer checkout cannot change its source. The job survives a Dokploy restart.
4. Under a per-application file lock, it checks that no newer release has started, combines the two immutable image digests, verifies both architectures, publishes the combined index and moves the service to `cluster-pi-2`.

Swarm uses the existing start-first rollout and rollback policy. A failed ARM build leaves the main-server deployment running. A superseded ARM job cannot publish or move the service. The saved Dokploy placement continues to target the main server, so the next release starts there again. Other applications keep their existing deployment behavior.

The installed helper is `/etc/dokploy/multiarch/deferred-build.cjs`; its source and tests are in `scripts/dokploy/`. To install or update it on this existing Dokploy setup:

```bash
dokploy_container=$(docker ps -q --filter name=dokploy.1)
docker exec "$dokploy_container" mkdir -p /tmp/atcs-deferred
docker cp scripts/dokploy/. "$dokploy_container":/tmp/atcs-deferred/
docker exec "$dokploy_container" node /tmp/atcs-deferred/install-deferred.cjs casamento-project-prod-frontend-j38kif cluster-pi-2
```

The installer backs up the wrapper, configuration and saved placement. It requires the existing multiarch setup and refuses unexpected placement constraints. It preserves the wrapper's inode because the same file is bind-mounted at `/usr/local/bin/docker`. No Dokploy restart is needed. The scripts are excluded from the application image.

Dokploy's deployment log shows the background job ID. Inspect it with `docker logs dokploy-arm-<release-id>`, and check the final rollout with `docker service ps casamento-project-prod-frontend-j38kif`. The latest job pointer is `/etc/dokploy/multiarch/casamento-project-prod-frontend-j38kif.deferred.json`. Job directories are private because frozen build arguments or environment files may contain credentials; successful and superseded jobs delete the source snapshot and arguments. Completed job containers retain bounded logs and may be removed individually after review.

To disable staging for future deployments, set this app's `deferredArm` to false and restore its saved placement from `casamento-project-prod-frontend-j38kif.placement.before-deferred.json`. Active jobs must be stopped by their exact container names before changing the configuration. This returns future deployments to building both architectures synchronously. Keep the database volume and authentication settings unchanged.

This protection begins after the browser loads a release containing the recovery code. A tab still running an earlier release cannot retroactively recover its unsaved component state.

Verification: `npm run typecheck && npm run lint && npm test`, then `npm run e2e` with local Postgres and `DEV_AUTH=true`. Browser tests use only synthetic records and never enable the dev login in production.
