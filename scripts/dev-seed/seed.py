import json
import os
import random
import re
import secrets
import string
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = os.environ.get("SHELFY_API", "http://localhost:8082/api/v1")
MAILPIT = os.environ.get("SHELFY_MAILPIT", "http://localhost:8025/api/v1")
ENV_FILE = Path(__file__).with_name(".env")
FRIENDS = [
    ("margot", "Margot", "Séries coréennes, RPG et beaucoup trop de manga."),
    ("hugo", "Hugo", "Cinéphile du dimanche, joueur du lundi."),
    ("lea", "Léa", "Je lis plus vite que je ne regarde."),
    ("sami", "Sami", "Anime de saison et jeux indé."),
    ("ines", "Inès", "Thrillers, SF et listes interminables."),
]
REVIEW_LINES = [
    "Le dernier acte vaut chaque heure passée avant. Une fin qui reste longtemps.",
    "Visuellement superbe, un peu long au milieu, mais la conclusion rattrape tout.",
    "Je ne m'attendais à rien et c'est devenu un de mes préférés de l'année.",
    "Excellent casting, écriture inégale. Je recommande quand même.",
    "Ambiance incroyable, bande-son parfaite. À découvrir sans rien savoir.",
    "Pas pour tout le monde, mais si ça accroche, impossible de s'arrêter.",
    "Une claque. Chaque épisode monte d'un cran.",
    "Sympa sans plus : bonne idée de départ, exécution trop sage.",
]
COMMENTS = [
    "Tellement d'accord !",
    "Il faut que je m'y mette.",
    "Bonne liste, j'en ai ajouté trois à ma collection.",
    "Pas convaincu par la fin, mais le reste est top.",
    "Merci pour la reco 🙏",
]

random.seed(41)


class ApiError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"{status}: {body[:200]}")
        self.status = status


def call(method: str, path: str, token: str | None = None, body=None, base: str = API):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise ApiError(e.code, e.read().decode(errors="replace")) from None


def soft(label: str, fn):
    try:
        return fn()
    except ApiError as e:
        if e.status != 409:
            print(f"  ! {label}: {e}")
        return None


def note(text: str) -> dict:
    return {"ops": [{"insert": text + "\n"}]}



def catalogue() -> dict[str, list[dict]]:
    specs = {
        "movie": ("movies", "tmdb", lambda x: x.get("title")),
        "tv_show": ("series", "tmdb", lambda x: x.get("name")),
        "game": ("games", "igdb", lambda x: x.get("name")),
        "anime": ("anime", "anilist", lambda x: x.get("title")),
        "manga": ("manga", "anilist", lambda x: x.get("title")),
        "webtoon": ("webtoons", "anilist", lambda x: x.get("title")),
    }
    out: dict[str, list[dict]] = {}
    for media_type, (path, provider, title) in specs.items():
        items = []
        for page in (0, 1):
            res = soft(f"trending {path}", lambda: call("GET", f"/discover/{path}/trending?page={page}&size=20"))
            for x in (res or {}).get("content", []):
                items.append({"provider": provider, "mediaType": media_type, "externalId": str(x["id"]), "title": title(x)})
        out[media_type] = items
        print(f"  catalogue {media_type}: {len(items)}")
    return out


def pick_refs(cat: dict[str, list[dict]], per_type: dict[str, int]) -> list[dict]:
    refs = []
    for media_type, n in per_type.items():
        pool = cat.get(media_type, [])
        refs += random.sample(pool, min(n, len(pool)))
    random.shuffle(refs)
    return refs



def login(email: str, password: str) -> str:
    return call("POST", "/auth/login", body={"email": email, "password": password})["accessToken"]


def verification_token(email: str) -> str | None:
    for _ in range(10):
        msgs = call("GET", f"/search?query=to:{urllib.request.quote(email)}", base=MAILPIT) or {}
        for m in msgs.get("messages", []):
            body = call("GET", f"/message/{m['ID']}", base=MAILPIT) or {}
            match = re.search(r"token=([A-Za-z0-9_\-.%]+)", (body.get("Text") or "") + (body.get("HTML") or ""))
            if match:
                return urllib.request.unquote(match.group(1))
        time.sleep(1)
    return None


def ensure_friend_account(username: str, password: str) -> str:
    email = f"{username}@shelfy.test"
    try:
        return login(email, password)
    except ApiError:
        pass
    soft(f"register {username}", lambda: call("POST", "/auth/register", body={"email": email, "username": username, "password": password}))
    token = verification_token(email)
    if token:
        soft(f"verify {username}", lambda: call("POST", "/auth/verify-email", body={"token": token}))
    else:
        print(f"  ! no verification mail found for {email}")
    return login(email, password)


def make_public(token: str, display_name: str | None = None, bio: str | None = None) -> dict:
    me = call("GET", "/users/me", token)
    call(
        "PATCH",
        "/users/me",
        token,
        {
            "username": me["username"],
            "displayName": display_name or me.get("displayName"),
            "bio": bio or me.get("bio"),
            "profileVisibility": "public",
            "allowAdultContent": False,
            "confirmAdultContent": False,
        },
    )
    return me



STATUSES = ["done"] * 5 + ["ongoing"] * 2 + ["planned"] * 3 + ["dropped", "endless"]


def fill_collection(token: str, refs: list[dict], reviews: int) -> list[dict]:
    added = []
    for ref in refs:
        status = random.choice(STATUSES)
        if status == "endless" and ref["mediaType"] != "game":
            status = "done"
        body = {k: ref[k] for k in ("provider", "mediaType", "externalId")} | {"status": status}
        if status == "done":
            body["rating"] = random.choice([6, 7, 7, 8, 8, 8, 9, 9, 10])
        elif status == "dropped":
            body["rating"] = random.choice([3, 4, 5])
        if status == "planned" and random.random() < 0.35:
            body["bookmarked"] = True
        item = soft(f"add {ref['title']}", lambda: call("POST", "/collection", token, body))
        if item:
            added.append(item)
    done = [i for i in added if i["status"] == "done"]
    for item in random.sample(done, min(reviews, len(done))):
        soft("review", lambda: call("PUT", f"/collection/{item['id']}", token, {"note": note(random.choice(REVIEW_LINES)), "containsSpoilers": False}))
    return added


def ref_of(item: dict) -> dict:
    m = item["media"]
    return {"provider": m["provider"], "mediaType": m["mediaType"], "externalId": m["externalId"]}


def make_lists(token: str, items: list[dict], specs: list[tuple[str, str, list[str]]]) -> list[dict]:
    lists = []
    for name, desc, tags in specs:
        media = [ref_of(i) for i in random.sample(items, min(random.randint(5, 10), len(items)))]
        created = soft(f"list {name}", lambda: call("POST", "/lists", token, {"name": name, "description": desc, "visibility": "public", "tags": tags, "media": media}))
        if created:
            lists.append(created)
    return lists


def make_versus(token: str, items: list[dict], name: str, desc: str) -> dict | None:
    pool = soft(f"pool {name}", lambda: call("POST", "/versus/pools", token, {"name": name, "description": desc, "visibility": "public"}))
    if not pool:
        return None
    for item in random.sample(items, min(8, len(items))):
        soft("pool item", lambda: call("POST", f"/versus/pools/{pool['id']}/items", token, ref_of(item)))
    session = soft("start versus", lambda: call("POST", "/versus/sessions", token, {"poolId": pool["id"]}))
    for _ in range(20):
        match = (session or {}).get("currentMatch")
        if not match:
            break
        winner = random.choice([match["mediaA"], match["mediaB"]])["id"]
        session = soft("pick", lambda: call("POST", f"/versus/sessions/{session['sessionId']}/picks", token, {"winnerMediaId": winner}))
    return pool



def main() -> None:
    email, password = os.environ.get("SHELFY_SEED_EMAIL"), os.environ.get("SHELFY_SEED_PASSWORD")
    if not email or not password:
        sys.exit("Set SHELFY_SEED_EMAIL and SHELFY_SEED_PASSWORD (local test account).")

    friend_password = None
    if ENV_FILE.exists():
        m = re.search(r"^SHELFY_FRIENDS_PASSWORD=(.+)$", ENV_FILE.read_text(), re.M)
        friend_password = m.group(1).strip() if m else None
    if not friend_password:
        friend_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))
        ENV_FILE.write_text(f"# Local dev seed accounts: <name>@shelfy.test\nSHELFY_FRIENDS_PASSWORD={friend_password}\n")

    print("Catalogue")
    cat = catalogue()

    print("Main account")
    main_token = login(email, password)
    me = make_public(main_token)
    main_items = fill_collection(main_token, pick_refs(cat, {"movie": 10, "tv_show": 10, "game": 8, "anime": 6, "manga": 6, "webtoon": 4}), reviews=8)
    main_lists = make_lists(main_token, main_items, [
        ("À voir ce week-end", "Ma pile du moment, tous médias confondus.", ["week-end"]),
        ("Mes indispensables", "Ce que je recommande à tout le monde.", ["favoris"]),
        ("Pour les soirées pluvieuses", "Ambiance cosy garantie.", ["cosy"]),
    ])
    main_pool = make_versus(main_token, main_items, "Le meilleur de l'année", "Huit titres, un seul vainqueur.")
    print(f"  {len(main_items)} items, {len(main_lists)} lists, versus: {bool(main_pool)}")

    print("Friends")
    friend_tokens: dict[str, str] = {}
    for i, (username, display, bio) in enumerate(FRIENDS):
        token = soft(f"account {username}", lambda: ensure_friend_account(username, friend_password))
        if not token:
            continue
        friend_tokens[username] = token
        friend = make_public(token, display, bio)
        items = fill_collection(token, pick_refs(cat, {"movie": 6, "tv_show": 6, "game": 4, "anime": 4, "manga": 3, "webtoon": 2}), reviews=4)
        make_lists(token, items, [(f"Les favoris de {display}", "Mes coups de cœur récents.", ["favoris"])])
        make_versus(token, items, f"Le duel de {display}", "Qui gagne ?")
        if i == len(FRIENDS) - 1:
            soft("pending request", lambda: call("POST", f"/friends/requests/{me['id']}", token))
        else:
            soft("friend request", lambda: call("POST", f"/friends/requests/{friend['id']}", main_token))
            incoming = soft("incoming", lambda: call("GET", "/friends/requests/incoming", token)) or {}
            for req in incoming.get("content", []):
                soft("accept", lambda: call("POST", f"/friends/requests/{req['id']}/accept", token))
            soft("follow", lambda: call("POST", f"/follows/{me['id']}", token))
            if i % 2 == 0:
                soft("follow back", lambda: call("POST", f"/follows/{friend['id']}", main_token))
        for lst in main_lists[:2]:
            soft("like list", lambda: call("POST", f"/lists/{lst['id']}/likes", token))
            if random.random() < 0.6:
                soft("comment list", lambda: call("POST", f"/lists/{lst['id']}/comments", token, {"content": random.choice(COMMENTS)}))
        if main_pool:
            soft("like pool", lambda: call("POST", f"/versus/pools/{main_pool['id']}/likes", token))
        print(f"  {username}: {len(items)} items")

    print("Review likes and comments")
    reviews = soft("browse reviews", lambda: call("GET", "/users/reviews?page=0&size=50", main_token)) or {}
    for review in reviews.get("content", [])[:20]:
        author = (review.get("author") or {}).get("username") or review.get("username")
        others = [(u, t) for u, t in friend_tokens.items() if u != author]
        for username, token in random.sample(others, min(2, len(others))):
            soft("like review", lambda: call("POST", f"/users/reviews/{review['id']}/likes", token))
            if random.random() < 0.3:
                soft("comment review", lambda: call("POST", f"/reviews/{review['id']}/comments", token, {"content": random.choice(COMMENTS)}))
    print("Done.")


if __name__ == "__main__":
    main()
