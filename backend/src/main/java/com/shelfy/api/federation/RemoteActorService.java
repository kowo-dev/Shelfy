package com.shelfy.api.federation;

import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.HtmlUtils;
import tools.jackson.databind.JsonNode;

@Service
public class RemoteActorService {

  static final Duration REFRESH_AFTER = Duration.ofDays(1);
  private static final Set<String> ACTOR_TYPES =
      Set.of("Person", "Service", "Application", "Group", "Organization");
  private static final Pattern DOMAIN = Pattern.compile("[a-z0-9.-]+(:\\d{1,5})?");
  private static final int MAX_USERNAME = 50;
  private static final int MAX_DISPLAY_NAME = 50;
  private static final int MAX_BIO = 500;
  private static final int MAX_HTML_INPUT = 20_000;

  private final RemoteFetcher fetcher;
  private final ActorStore actorStore;
  private final UserRepository userRepository;
  private final FederationUris uris;
  private final RemoteAvatars remoteAvatars;
  private final TransactionTemplate transactionTemplate;
  private final Clock clock;
  private final boolean enabled;

  @Autowired
  public RemoteActorService(
      RemoteFetcher fetcher,
      ActorStore actorStore,
      UserRepository userRepository,
      FederationUris uris,
      RemoteAvatars remoteAvatars,
      PlatformTransactionManager transactionManager,
      FederationProperties properties) {
    this(
        fetcher,
        actorStore,
        userRepository,
        uris,
        remoteAvatars,
        transactionManager,
        Clock.systemUTC(),
        properties.enabled());
  }

  RemoteActorService(
      RemoteFetcher fetcher,
      ActorStore actorStore,
      UserRepository userRepository,
      FederationUris uris,
      RemoteAvatars remoteAvatars,
      PlatformTransactionManager transactionManager,
      Clock clock,
      boolean enabled) {
    this.fetcher = fetcher;
    this.actorStore = actorStore;
    this.userRepository = userRepository;
    this.uris = uris;
    this.remoteAvatars = remoteAvatars;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    this.clock = clock;
    this.enabled = enabled;
  }

  public record Handle(String username, String domain) {
    public static Optional<Handle> parse(String value) {
      if (value == null) {
        return Optional.empty();
      }
      String handle = value.trim();
      if (handle.toLowerCase(Locale.ROOT).startsWith("acct:")) {
        handle = handle.substring(5);
      }
      if (handle.startsWith("@")) {
        handle = handle.substring(1);
      }
      int at = handle.lastIndexOf('@');
      if (at <= 0 || at == handle.length() - 1) {
        return Optional.empty();
      }
      String username = handle.substring(0, at);
      String domain = handle.substring(at + 1).toLowerCase(Locale.ROOT);
      if (username.contains("@") || !DOMAIN.matcher(domain).matches()) {
        return Optional.empty();
      }
      return Optional.of(new Handle(username, domain));
    }

    public String acct() {
      return "acct:" + display();
    }

    public String display() {
      return username + "@" + domain;
    }
  }

  public UserEntity resolveHandle(String value) {
    Handle handle =
        Handle.parse(value)
            .orElseThrow(() -> new RemoteFetcher.RemoteFetchException("Invalid handle " + value));
    if (uris.isLocalDomain(handle.domain())) {
      return userRepository
          .findByUsernameIgnoreCaseAndDomainIsNull(handle.username())
          .orElseThrow(() -> new RemoteFetcher.RemoteFetchException("Unknown user " + value));
    }
    Optional<UserEntity> known = userRepository.findByUsernameIgnoreCase(handle.display());
    if (known.isPresent()) {
      Optional<ActorStore.RemoteActor> actor = actorStore.findRemoteByUserId(known.get().getId());
      if (actor.isPresent() && isFresh(actor.get())) {
        return known.get();
      }
    }
    String actorUri =
        selfLink(fetcher.fetchJrd(uris.webFinger(handle.domain(), handle.acct())))
            .orElseThrow(
                () -> new RemoteFetcher.RemoteFetchException("No actor found for " + value));
    return resolveActor(actorUri, false);
  }

  public Optional<UserEntity> tryResolveHandle(String value) {
    if (!enabled || Handle.parse(value).isEmpty()) {
      return Optional.empty();
    }
    try {
      return Optional.of(resolveHandle(value));
    } catch (RemoteFetcher.RemoteFetchException e) {
      return Optional.empty();
    }
  }

  public UserEntity resolveActor(String actorUri, boolean forceRefresh) {
    if (uris.isLocalUri(actorUri)) {
      throw new RemoteFetcher.RemoteFetchException("Not a remote actor: " + actorUri);
    }
    if (!forceRefresh) {
      Optional<ActorStore.RemoteActor> cached = actorStore.findRemoteByUri(actorUri);
      if (cached.isPresent() && isFresh(cached.get())) {
        return userRepository.findById(cached.get().userId()).orElseThrow();
      }
    }
    JsonNode doc = fetcher.fetchActivity(URI.create(actorUri));
    ParsedActor parsed = parseActor(actorUri, doc);
    Handle handle = canonicalHandle(parsed.username(), actorUri);
    Optional<String> previousAvatar =
        actorStore.findRemoteByUri(actorUri).map(ActorStore.RemoteActor::avatarUrl);
    UserEntity saved;
    try {
      saved = save(parsed, handle);
    } catch (DataIntegrityViolationException e) {
      saved = save(parsed, handle);
    }
    boolean avatarChanged =
        previousAvatar.isEmpty()
            || !Objects.equals(previousAvatar.get(), parsed.avatarUrl())
            || saved.getAvatarFilename() == null;
    if (parsed.avatarUrl() != null && avatarChanged) {
      remoteAvatars.refresh(saved.getId(), parsed.avatarUrl());
    }
    return saved;
  }

  public void refreshFrom(UserEntity remote, String actorUri, JsonNode doc) {
    ParsedActor parsed = parseActor(actorUri, doc);
    Optional<String> previousAvatar =
        actorStore.findRemoteByUri(actorUri).map(ActorStore.RemoteActor::avatarUrl);
    UserEntity saved = save(parsed, new Handle(parsed.username(), remote.getDomain()));
    if (parsed.avatarUrl() != null
        && !Objects.equals(previousAvatar.orElse(null), parsed.avatarUrl())) {
      remoteAvatars.refresh(saved.getId(), parsed.avatarUrl());
    }
  }

  public UserEntity resolveByKeyId(String keyId, boolean forceRefresh) {
    if (!forceRefresh) {
      Optional<ActorStore.RemoteActor> known = actorStore.findRemoteByKeyId(keyId);
      if (known.isPresent() && isFresh(known.get())) {
        return userRepository.findById(known.get().userId()).orElseThrow();
      }
    }
    int fragment = keyId.indexOf('#');
    String document = fragment < 0 ? keyId : keyId.substring(0, fragment);
    String actorUri = document;
    if (fragment < 0) {
      JsonNode key = fetcher.fetchActivity(URI.create(document));
      String owner = text(key, "owner");
      if (!ACTOR_TYPES.contains(text(key, "type")) && owner != null) {
        actorUri = owner;
      }
    }
    UserEntity actor = resolveActor(actorUri, forceRefresh);
    String storedKeyId =
        actorStore
            .findRemoteByUserId(actor.getId())
            .map(ActorStore.RemoteActor::publicKeyId)
            .orElse(null);
    if (!keyId.equals(storedKeyId)) {
      throw new RemoteFetcher.RemoteFetchException(
          "Key " + keyId + " does not belong to its actor");
    }
    return actor;
  }

  record ParsedActor(
      String actorUri,
      String username,
      String displayName,
      String bio,
      String inbox,
      String sharedInbox,
      String outbox,
      String followers,
      String following,
      String profileUrl,
      String avatarUrl,
      String keyId,
      String publicKeyPem,
      CollectionVisibility visibility) {}

  static ParsedActor parseActor(String actorUri, JsonNode doc) {
    if (!actorUri.equals(text(doc, "id"))) {
      throw new RemoteFetcher.RemoteFetchException("Actor id does not match " + actorUri);
    }
    if (!ACTOR_TYPES.contains(text(doc, "type"))) {
      throw new RemoteFetcher.RemoteFetchException("Not an actor: " + actorUri);
    }
    String username = text(doc, "preferredUsername");
    if (username == null
        || username.isBlank()
        || username.length() > MAX_USERNAME
        || username.contains("@")) {
      throw new RemoteFetcher.RemoteFetchException("Invalid preferredUsername for " + actorUri);
    }
    String inbox = text(doc, "inbox");
    if (inbox == null) {
      throw new RemoteFetcher.RemoteFetchException("Actor has no inbox: " + actorUri);
    }
    JsonNode key = doc.path("publicKey");
    String keyId = text(key, "id");
    String pem = text(key, "publicKeyPem");
    if (keyId == null || pem == null || !actorUri.equals(text(key, "owner"))) {
      throw new RemoteFetcher.RemoteFetchException("Actor has no valid public key: " + actorUri);
    }
    RsaKeys.parsePublic(pem);
    return new ParsedActor(
        actorUri,
        username,
        truncate(plainText(text(doc, "name")), MAX_DISPLAY_NAME),
        truncate(plainText(text(doc, "summary")), MAX_BIO),
        inbox,
        text(doc.path("endpoints"), "sharedInbox"),
        text(doc, "outbox"),
        text(doc, "followers"),
        text(doc, "following"),
        doc.path("url").isString() ? text(doc, "url") : null,
        imageUrl(doc.path("icon")),
        keyId,
        pem,
        switch (String.valueOf(text(doc, "shelfy:profileVisibility"))) {
          case "friends_only", "private" -> CollectionVisibility.PRIVATE;
          default -> CollectionVisibility.PUBLIC;
        });
  }

  private Handle canonicalHandle(String username, String actorUri) {
    String host = URI.create(actorUri).getRawAuthority().toLowerCase(Locale.ROOT);
    Handle fallback = new Handle(username, host);
    JsonNode jrd;
    try {
      jrd = fetcher.fetchJrd(uris.webFinger(host, fallback.acct()));
    } catch (RemoteFetcher.RemoteFetchException e) {
      return fallback;
    }
    if (!selfLink(jrd).map(actorUri::equals).orElse(false)) {
      throw new RemoteFetcher.RemoteFetchException(
          "WebFinger of " + fallback.acct() + " does not point to " + actorUri);
    }
    Optional<Handle> subject = Handle.parse(text(jrd, "subject"));
    if (subject.isEmpty() || subject.get().domain().equals(host)) {
      return subject.orElse(fallback);
    }
    try {
      JsonNode confirmed =
          fetcher.fetchJrd(uris.webFinger(subject.get().domain(), subject.get().acct()));
      if (selfLink(confirmed).map(actorUri::equals).orElse(false)) {
        return subject.get();
      }
    } catch (RemoteFetcher.RemoteFetchException e) {
      return fallback;
    }
    return fallback;
  }

  private UserEntity save(ParsedActor parsed, Handle handle) {
    return transactionTemplate.execute(
        status -> {
          UserEntity user =
              actorStore
                  .findRemoteByUri(parsed.actorUri())
                  .flatMap(actor -> userRepository.findById(actor.userId()))
                  .or(() -> userRepository.findByUsernameIgnoreCase(handle.display()))
                  .orElseGet(UserEntity::new);
          user.setUsername(handle.display());
          user.setDomain(handle.domain());
          user.setDisplayName(parsed.displayName());
          user.setBio(parsed.bio());
          user.setProfileVisibility(parsed.visibility());
          UserEntity saved = userRepository.saveAndFlush(user);
          actorStore.saveRemote(
              new ActorStore.RemoteActor(
                  saved.getId(),
                  parsed.actorUri(),
                  parsed.inbox(),
                  parsed.sharedInbox(),
                  parsed.outbox(),
                  parsed.followers(),
                  parsed.following(),
                  parsed.profileUrl(),
                  parsed.avatarUrl(),
                  parsed.keyId(),
                  parsed.publicKeyPem(),
                  OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC)));
          return saved;
        });
  }

  private boolean isFresh(ActorStore.RemoteActor actor) {
    return actor.fetchedAt() != null
        && actor.fetchedAt().toInstant().plus(REFRESH_AFTER).isAfter(clock.instant());
  }

  static Optional<String> selfLink(JsonNode jrd) {
    for (JsonNode link : jrd.path("links")) {
      String type = text(link, "type");
      if ("self".equals(text(link, "rel"))
          && type != null
          && (type.startsWith("application/activity+json")
              || type.startsWith("application/ld+json"))
          && text(link, "href") != null) {
        return Optional.of(text(link, "href"));
      }
    }
    return Optional.empty();
  }

  private static String imageUrl(JsonNode icon) {
    JsonNode image = icon.isArray() ? icon.path(0) : icon;
    return image.path("url").isString() ? text(image, "url") : null;
  }

  static String text(JsonNode node, String field) {
    JsonNode value = node.path(field);
    return value.isString() ? value.asString() : null;
  }

  // One linear pass over a bounded prefix: remote servers choose this text, so no regex here
  static String plainText(String html) {
    if (html == null) {
      return null;
    }
    String input = html.length() > MAX_HTML_INPUT ? html.substring(0, MAX_HTML_INPUT) : html;
    StringBuilder text = new StringBuilder(input.length());
    int paragraphEnd = -1;
    int i = 0;
    while (i < input.length()) {
      int open = input.indexOf('<', i);
      int close = open < 0 ? -1 : input.indexOf('>', open + 1);
      if (close < 0) {
        text.append(input, i, input.length());
        break;
      }
      if (open > i && !input.substring(i, open).isBlank()) {
        paragraphEnd = -1;
      }
      text.append(input, i, open);
      String tag = input.substring(open + 1, close).strip().toLowerCase(Locale.ROOT);
      if (isLineBreak(tag)) {
        text.append('\n');
        paragraphEnd = -1;
      } else if (tag.equals("/p")) {
        paragraphEnd = text.length();
      } else if (paragraphEnd >= 0 && isParagraphStart(tag)) {
        text.setLength(paragraphEnd);
        text.append("\n\n");
        paragraphEnd = -1;
      } else {
        paragraphEnd = -1;
      }
      i = close + 1;
    }
    String result = HtmlUtils.htmlUnescape(text.toString()).strip();
    return result.isEmpty() ? null : result;
  }

  private static boolean isLineBreak(String tag) {
    return tag.equals("br") || (tag.startsWith("br") && tag.substring(2).strip().equals("/"));
  }

  private static boolean isParagraphStart(String tag) {
    return tag.equals("p") || (tag.startsWith("p") && Character.isWhitespace(tag.charAt(1)));
  }

  private static String truncate(String value, int max) {
    if (value == null || value.length() <= max) {
      return value;
    }
    return value.substring(0, max);
  }
}
