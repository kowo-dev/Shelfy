# 🛠️ Development

[← Back to the README](../README.md)

You need Docker, JDK 25 and Node.js 22.22.3+ or 24.15+.

## Run the app

```bash
cp backend/src/main/resources/application-local.yml.example backend/src/main/resources/application-local.yml
docker compose -f docker/docker-compose.yml up -d postgres mailpit
cd backend && SPRING_PROFILES_ACTIVE=local ./mvnw spring-boot:run
```

In a second terminal:

```bash
cd frontend && npm ci && npm start
```

| Service | Address |
| --- | --- |
| App | http://localhost:4200 |
| API | http://localhost:8082 |
| Mailpit, catches every email | http://localhost:8025 |

## Filling the app with test data

With the app running, this fills your test account through the public API: collection, notes and reviews, lists, a versus pool and a finished run.

```bash
SHELFY_SEED_EMAIL=you@example.com SHELFY_SEED_PASSWORD=... python scripts/dev-seed/seed.py
```

It also creates friend accounts, verified through Mailpit, fills them too and links them to yours with friendships, a pending request, follows, likes and comments. Their passwords are generated once and stored in `scripts/dev-seed/.env`, which Git ignores. You can run it again: existing accounts and items are reused and duplicates are skipped.

## Trying federation locally

Start a second instance next to the first one. The two backends reach each other as `shelfy-a.test` and `shelfy-b.test` on the Docker network, in a development mode that allows plain HTTP:

```bash
docker compose -f docker/docker-compose.yml --profile federation up -d
```

| Instance | API | Handles |
| --- | --- | --- |
| A | http://localhost:8082 | `@username@shelfy-a.test:8082` |
| B | http://localhost:8083 | `@username@shelfy-b.test:8082` |

To open the administration page locally, add your verified email to `application-local.yml`:

```yaml
app:
  federation:
    admins: "you@example.com"
```

See [Federation](federation.md) for how it works.

## Before opening a pull request

Format with `./mvnw spotless:apply` in `backend/` and `npm run format` in `frontend/`, then run these from the repository root:

```bash
npm run backend:check
npm run frontend:test
npm run frontend:lint
```

## Releases

Versions follow [semantic versioning](https://semver.org), seen from someone running an instance:

| Version | When |
| --- | --- |
| Major | Admins must do something before updating: a new required setting, a manual step, a break with older federated instances |
| Minor | New features, including database migrations that run on their own |
| Patch | Fixes only |

While the version starts with `0`, everything moves one step down: the minor number marks what admins must do before updating, and the patch number covers both features and fixes. Going to `1.0.0` means committing to smooth updates and to staying compatible with older federated instances.

The Git tag is the only place the version lives. `deploy.sh` reads it with `git describe` and builds it into the API, shown in nodeinfo, and into the web app, shown in the account menu.

To release, wait for CI to pass on `main`, then tag and push. Anything admins must do before updating goes in a second message, shown at the top of the release notes:

```bash
git tag -a v1.2.0 -m v1.2.0 -m "Before updating, add SOME_SETTING to docker/.env"
git push origin v1.2.0
```

The release workflow checks that the tag is on `main` and passed CI, lists the `feat`, `fix` and `perf` commits since the previous release, publishes the GitHub release and moves `stable` to the tag. A tag like `v1.2.0-rc.1` becomes a pre-release and leaves `stable` alone.

Two rules keep updates safe:

- Never edit a database migration that is already in a release: add a new one.
- Within a major version, keep talking to instances that run an older one.

## Deploying from GitHub

The Deploy workflow, started by hand, builds the web app to an SFTP host and updates the API on a server over SSH. It needs these repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_PRIVATE_KEY_B64`, `VPS_KNOWN_HOSTS`, `OVH_SFTP_HOST`, `OVH_SFTP_USER` and `OVH_SFTP_PASSWORD`, and the `API_DOMAIN` variable.

`VPS_KNOWN_HOSTS` pins the server's SSH key, so the workflow never talks to an impostor. Take it from a machine that already trusts the server:

```bash
ssh-keygen -F your-server.example.com
```
