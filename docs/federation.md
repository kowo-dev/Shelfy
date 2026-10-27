# 🌐 Federation

[← Back to the README](../README.md)

Shelfy speaks [ActivityPub](https://www.w3.org/TR/activitypub/), the protocol behind Mastodon and the Fediverse. Every instance keeps its own database and talks directly to the others: there is no central server, and nothing is sent anywhere until someone follows someone.

- [For everyone on your instance](#for-everyone-on-your-instance)
- [For the person running the instance](#for-the-person-running-the-instance)
- [Administration API](#administration-api)
- [Trying it locally](development.md#trying-federation-locally)

## For everyone on your instance

- Your address is `@username@your-domain`, like an email address. Share it so people on other servers can find you.
- To find someone elsewhere, type their full address, like `@marie@shelfy.example.org`, in the search of the **Social** page. Their profile opens like any other.
- On **Community**, the **Fediverse** filter next to Everyone and Following shows only what comes from accounts on other servers, like the federated timeline of Mastodon. It lists what accounts followed by your members publish, so it fills up as people follow others.
- Follow them, comment, like and mention them (`@marie@shelfy.example.org`) with the usual buttons. Their additions, ratings, reviews, lists and versus pools then show up in your feed, and yours in theirs.
- **Settings → Preferences → Share on the Fediverse** turns federation off for your account alone. Off, your account behaves as if it were private for other servers: it cannot be found or followed from outside, and nothing you do is sent. Servers that already received something are not asked to remove it. Your profile visibility on Shelfy itself does not change.
- Your avatar and your profile banner appear on your Mastodon profile as its picture and header. Change them in Shelfy and other servers update their copy. Accounts that allow adult content do not publish their banner.
- Your profile visibility still decides everything: **public** goes to your followers wherever they are, and **private** never leaves your instance. Lists and versus pools shared **with the link** are never sent to other servers.
- Mastodon and other Fediverse apps can follow you too: your additions, ratings, reviews and status changes show up there as posts, with a content warning for spoilers, a link back to Shelfy and hashtags such as `#movie` or `#game`. Their replies come back as comments, and their favourites as likes on your reviews, lists and versus pools.
- A new follower on another server receives your five latest public posts right after you accept them, so their feed is not empty. Anything older stays on your profile.
- Edits and deletions travel too: when you change or delete something, or delete your account, the servers that received it are asked to update or remove their copy. Most servers respect this, but they are run by other people, so a removal elsewhere cannot be guaranteed. The shelf visibility setting and the privacy policy say so.

### Following someone on Shelfy from another server

People who are not signed in can follow a profile from their own account. On the profile, **Follow** opens a dialog: sign in, or type your address on another server, like `@you@mastodon.social`, then **Continue**. You land on your own server, which asks you to confirm the follow.

The server must offer remote follow (Mastodon and most Fediverse servers do). If it does not, the dialog says so and you can search for the profile from your own server instead. The option only appears when the instance has federation on and the profile is not private.

## For the person running the instance

Federation turns on by itself with `TLS_MODE=public`. It stays off with `TLS_MODE=internal`, and with `TLS_MODE=off` unless your proxy or tunnel is reachable from the Internet. To keep your instance on its own, set `FEDERATION_ENABLED=false` before the first deployment.

Optional settings in `docker/.env`:

| Variable | What it does |
| --- | --- |
| `FEDERATION_ENABLED` | `false` keeps your instance on its own |
| `FEDERATION_MODE` | `open` talks to every instance, `allowlist` only to the ones you approve |
| `FEDERATION_AUTHORIZED_FETCH` | `true` makes other servers sign their requests to read profiles, outboxes and posts, like Mastodon's secure mode. Your instance actor and discovery stay public. Servers that cannot sign are refused |
| `FEDERATION_ADMINS` | Emails of the accounts allowed to manage federation, comma separated. An account only counts once its email is verified, so admins need a working email server |

> [!WARNING]
> The domain of `FRONTEND_URL` is part of every username. Keep it once federation is on, or followers on other instances are lost.

When federation is on, the privacy policy page gains a section explaining what is shared and that deletions elsewhere cannot be guaranteed.

If the web app is hosted separately from the API, the website address must also answer for three paths, see [external web hosting](self-hosting.md#external-web-hosting).

### Instance administration

Admins find **Administration** in the account menu, above **Settings** (in the **More** sheet on mobile). The page shows the federation status, the instances your members have met, blocked and allowed instances, and reports sent by other instances. Blocking an instance removes its accounts and everything copied from them.

When deliveries to an instance keep failing, its row shows how many are waiting, the last error on hover, and a **Retry now** button. Deliveries are retried automatically up to 12 times, with a delay that grows to a day, then dropped.

### Limits

The inboxes accept 600 requests a minute from each address, shared by the shared inbox and every user inbox. Servers that go over get a `429` and try again later. Looking up an address for remote follow is limited to 20 a minute.

### When something does not show up

- Check that discovery answers. This must return JSON, not a 404:

  ```bash
  curl -i "https://your-domain/.well-known/webfinger?resource=acct:username@your-domain"
  ```

- Nothing reaches a follower until a follow is accepted, and only profiles that are not private publish. Posts made before someone followed are not sent again, except the five latest.
- Look at the backend log for refused requests and failed deliveries:

  ```bash
  docker logs shelfy-backend 2>&1 | grep -E "Rejected inbox|Dropping delivery|Delivery task failed"
  ```

  A rejected request ends with the answer from the other server, which usually says why.
- Some servers only share profiles with signed requests. Shelfy signs its requests with the instance key at `/ap/actor`, so that address must be reachable from the Internet.

## Moving an account

Shelfy follows the ActivityPub move protocol, so accounts can leave and arrive without losing followers. Open **Settings → Account → Move your account** to add an alias (moving here) or move your account (moving away). The same actions are available through the API, signed in with your own account token, as shown below.

**When someone you follow moves**, nothing to do: if their new account lists the old one as an alias, the people on your instance who followed the old account follow the new one.

**To move your Shelfy account to another server**, first create the new account and add your Shelfy address (shown by `GET /api/v1/federation/migration` as `actor`) as an alias in its settings. Then:

```bash
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"handle": "@you@new.example"}' https://api.your-domain/api/v1/federation/migration/move
```

Your profile then points to the new account and your followers are told to follow it. A move cannot be undone from Shelfy.

**To move an account to Shelfy**, add the old address as an alias of your Shelfy account, then start the move from the old server:

```bash
curl -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"handle": "@you@old.example"}' https://api.your-domain/api/v1/federation/migration/alias
```

`DELETE /api/v1/federation/migration/alias` removes the alias.

## Administration API

The same actions are available through the API, signed in with an admin account token:

```bash
curl -X PUT -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"reason": "spam"}' https://api.your-domain/api/v1/admin/federation/domain-blocks/spam.example
```

| Request | What it does |
| --- | --- |
| `GET` `/api/v1/admin/federation/overview` | Federation status, known instances, blocks and allows |
| `GET`, `PUT`, `DELETE` `/api/v1/admin/federation/domain-blocks/{domain}` | Block an instance and remove its accounts, or unblock it |
| `GET`, `PUT`, `DELETE` `/api/v1/admin/federation/domain-allows/{domain}` | Manage the instances allowed in `allowlist` mode |
| `GET` `/api/v1/admin/federation/reports` | Reports sent by other instances |
| `POST` `/api/v1/admin/federation/deliveries/{domain}/retry` | Retry now every delivery waiting for an instance |
