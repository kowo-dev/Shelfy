# 🚀 Self-hosting

[← Back to the README](../README.md)

The [README](../README.md#self-hosting) covers a standard installation. This page covers what comes after, and the less common setups.

- [Updates](#updates)
- [Backups and restore](#backups-and-restore)
- [Useful commands](#useful-commands)
- [Advanced setups](#advanced-setups)

## Updates

Update to the latest release. A backup is taken automatically first, and the previous version comes back if the update fails.

```bash
git pull
bash docker/deploy.sh
```

The script ends with the version now running. It is also shown at the bottom of the account menu.

> [!NOTE]
> Installed from `main` before releases existed? Switch to `stable` once the next release is out, so your database is never ahead of the code: `git fetch && git checkout stable`.

## Backups and restore

Back up at any time, or every day with cron. Backups go to `docker/backups` and the 14 latest are kept.

```bash
bash docker/backup.sh
```

Restore a backup:

```bash
bash docker/restore.sh docker/backups/db-<date>.sql.gz docker/backups/avatars-<date>.tar.gz
```

> [!IMPORTANT]
> Copy `docker/backups` to another machine regularly. Use `deploy.sh` and `restore.sh` rather than `docker compose up` by hand: they compute settings the app needs.

## Useful commands

Run them from the `docker/` folder:

```bash
docker compose -f docker-compose.prod.yml ps               # status
docker compose -f docker-compose.prod.yml logs -f backend  # API logs
docker compose -f docker-compose.prod.yml down             # stop, keeps your data
```

From the repository root, without an email server, confirm an account's email by hand, for example to make it an admin:

```bash
bash docker/verify-email.sh alice@example.com
```

## Advanced setups

### Ports already in use

Common on a NAS. Set `HTTP_PORT` and `HTTPS_PORT`. In `internal` mode the address then includes the port, like `https://192.168.1.20:8443`. In `public` mode, forward ports 80 and 443 of your router to them.

### Separate API domain

The API is served under `/api` by default. Set `API_DOMAIN=api.shelfy.example.com` to give it its own name, pointing to the same server.

### External web hosting

Set `FRONTEND_HOSTING=external`, `API_DOMAIN` and `FRONTEND_URL`. Both must share the same domain, such as `shelfy.example.com` and `api.shelfy.example.com`, or people get signed out. Then build the web app with Node.js 22.22.3+ or 24.15+:

```bash
cd frontend
npm ci
cat > src/environments/environment.prod.ts <<'EOT'
export const environment = {
  production: true,
  version: '1.0.0',
  baseUrl: 'https://api.shelfy.example.com/api/v1',
  tmdbImageBaseUrl: 'https://image.tmdb.org/t/p/',
};
EOT
npm run build
```

Upload `frontend/dist/shelfy/browser` to your host and make it serve `index.html` for unknown paths (the included `.htaccess` does this on Apache).

For [federation](federation.md), the website address must also answer for the API on three paths. The included `.htaccess` redirects `/.well-known/webfinger`, `/.well-known/nodeinfo` and `/.well-known/host-meta` to `api.shelfy.dev`: replace it with your `API_DOMAIN` in `frontend/public/.htaccess` before building, or set up the same redirects on your host.
