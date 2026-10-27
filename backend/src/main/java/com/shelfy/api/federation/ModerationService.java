package com.shelfy.api.federation;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.net.URI;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
@RequiredArgsConstructor
public class ModerationService {

  private static final Pattern DOMAIN = Pattern.compile("[a-z0-9-]+(\\.[a-z0-9-]+)+(:\\d{1,5})?");
  private static final int MAX_REPORT = 2_000;

  public record DomainRule(String domain, String reason, Instant createdAt) {}

  public record Instance(
      String domain,
      long accounts,
      long followedLocally,
      Instant lastSeen,
      long pendingDeliveries,
      long failingDeliveries,
      String lastError,
      boolean isBlocked,
      boolean isAllowed) {}

  public record Overview(
      boolean isEnabled,
      String mode,
      String handleDomain,
      List<Instance> instances,
      List<DomainRule> blocks,
      List<DomainRule> allows,
      long reports) {}

  public record Report(
      UUID id,
      String reporterDomain,
      String reporterHandle,
      String targetHandle,
      String objectUris,
      String content,
      Instant createdAt) {}

  private final JdbcClient jdbcClient;
  private final FederationProperties properties;
  private final FederationUris uris;
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;
  private final NotificationService notificationService;

  public void requireAdmin(UUID userId) {
    boolean admin =
        userId != null
            && userRepository
                .findById(userId)
                .map(
                    user ->
                        properties.isAdmin(
                            user.getEmail(), user.isEmailVerified(), user.getDomain() == null))
                .orElse(false);
    if (!admin) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "Only instance admins can do this");
    }
  }

  public Overview getOverview() {
    List<DomainRule> blocks = listBlocks();
    List<DomainRule> allows = listAllows();
    Map<String, long[]> deliveries = new HashMap<>();
    Map<String, String> lastErrors = new HashMap<>();
    jdbcClient
        .sql("select inbox, attempts, last_error from ap_deliveries order by created_at")
        .query(
            (rs, row) -> {
              String host = host(rs.getString("inbox"));
              long[] counts = deliveries.computeIfAbsent(host, key -> new long[2]);
              counts[0]++;
              if (rs.getInt("attempts") > 0) {
                counts[1]++;
              }
              String error = rs.getString("last_error");
              if (error != null) {
                lastErrors.put(host, error);
              }
              return host;
            })
        .list();
    List<Instance> instances =
        jdbcClient
            .sql(
                """
                select lower(u.domain) as domain, count(distinct u.id) as accounts,
                       count(distinct f.followed_id) as followed, max(a.fetched_at) as last_seen
                from users u
                left join ap_actors a on a.user_id = u.id
                left join follows f on f.followed_id = u.id
                  and f.follower_id in (select id from users where domain is null)
                where u.domain is not null
                group by lower(u.domain)
                order by count(distinct u.id) desc, lower(u.domain)
                """)
            .query(
                (rs, row) -> {
                  String domain = rs.getString("domain");
                  long[] counts = deliveries.getOrDefault(stripPort(domain), new long[2]);
                  String lastError = lastErrors.get(stripPort(domain));
                  Timestamp seen = rs.getTimestamp("last_seen");
                  return new Instance(
                      domain,
                      rs.getLong("accounts"),
                      rs.getLong("followed"),
                      seen == null ? null : seen.toInstant(),
                      counts[0],
                      counts[1],
                      lastError,
                      matches(blocks, domain),
                      matches(allows, domain));
                })
            .list();
    long reports = jdbcClient.sql("select count(*) from ap_reports").query(Long.class).single();
    return new Overview(
        properties.enabled(),
        properties.mode().name().toLowerCase(Locale.ROOT),
        uris.handleDomain(),
        instances,
        blocks,
        allows,
        reports);
  }

  @Transactional
  public int retryDeliveries(String rawDomain) {
    String target = stripPort(domain(rawDomain));
    List<UUID> ids =
        jdbcClient
            .sql("select id, inbox from ap_deliveries")
            .query(
                (rs, row) ->
                    host(rs.getString("inbox")).equals(target)
                        ? rs.getObject("id", UUID.class)
                        : null)
            .list()
            .stream()
            .filter(Objects::nonNull)
            .toList();
    if (ids.isEmpty()) {
      return 0;
    }
    return jdbcClient
        .sql("update ap_deliveries set next_attempt_at = now(), attempts = 0 where id in (:ids)")
        .param("ids", ids)
        .update();
  }

  public List<DomainRule> listBlocks() {
    return rules("domain_blocks", "reason");
  }

  public List<DomainRule> listAllows() {
    return rules("domain_allows", "null");
  }

  @Transactional
  public void block(String rawDomain, String reason) {
    String domain = domain(rawDomain);
    jdbcClient
        .sql(
            """
            insert into domain_blocks (domain, reason) values (:domain, :reason)
            on conflict (domain) do update set reason = excluded.reason
            """)
        .param("domain", domain)
        .param("reason", reason == null || reason.isBlank() ? null : reason.strip())
        .update();
    jdbcClient
        .sql("delete from ap_deliveries where inbox like :https or inbox like :http")
        .param("https", "https://" + domain + "/%")
        .param("http", "http://" + domain + "/%")
        .update();
    List<UUID> accounts =
        jdbcClient
            .sql(
                """
                select id from users
                where lower(domain) = :domain or lower(domain) like :subdomains
                   or lower(domain) like :withPort
                """)
            .param("domain", domain)
            .param("subdomains", "%." + domain)
            .param("withPort", domain + ":%")
            .query(UUID.class)
            .list();
    for (UUID id : accounts) {
      userRepository
          .findById(id)
          .ifPresent(
              user -> {
                String avatar = user.getAvatarFilename();
                userRepository.delete(user);
                avatarStorageService.delete(avatar);
              });
    }
  }

  @Transactional
  public void unblock(String rawDomain) {
    jdbcClient
        .sql("delete from domain_blocks where domain = :domain")
        .param("domain", domain(rawDomain))
        .update();
  }

  @Transactional
  public void allow(String rawDomain) {
    jdbcClient
        .sql("insert into domain_allows (domain) values (:domain) on conflict do nothing")
        .param("domain", domain(rawDomain))
        .update();
  }

  @Transactional
  public void disallow(String rawDomain) {
    jdbcClient
        .sql("delete from domain_allows where domain = :domain")
        .param("domain", domain(rawDomain))
        .update();
  }

  public List<Report> listReports() {
    return jdbcClient
        .sql(
            """
            select r.id, r.reporter_domain, reporter.username as reporter_handle,
                   target.username as target_handle, r.object_uris, r.content, r.created_at
            from ap_reports r
            left join users reporter on reporter.id = r.reporter_id
            left join users target on target.id = r.target_user_id
            order by r.created_at desc limit 200
            """)
        .query(
            (rs, row) ->
                new Report(
                    rs.getObject("id", UUID.class),
                    rs.getString("reporter_domain"),
                    rs.getString("reporter_handle"),
                    rs.getString("target_handle"),
                    rs.getString("object_uris"),
                    rs.getString("content"),
                    rs.getTimestamp("created_at").toInstant()))
        .list();
  }

  public void onFlag(UserEntity signer, JsonNode activity) {
    List<String> objects = new ArrayList<>();
    JsonNode object = activity.path("object");
    if (object.isArray()) {
      object.forEach(item -> Optional.ofNullable(Activities.idOf(item)).ifPresent(objects::add));
    } else {
      Optional.ofNullable(Activities.idOf(object)).ifPresent(objects::add);
    }
    Optional<UUID> target =
        objects.stream()
            .map(uris::localUserId)
            .flatMap(Optional::stream)
            .filter(id -> userRepository.findById(id).map(u -> u.getDomain() == null).orElse(false))
            .findFirst();
    if (objects.isEmpty()) {
      return;
    }
    String content = Activities.text(activity, "content");
    jdbcClient
        .sql(
            """
            insert into ap_reports (activity_id, reporter_id, reporter_domain, target_user_id,
                                    object_uris, content)
            values (:activityId, :reporter, :domain, :target, :objects, :content)
            on conflict (activity_id) do nothing
            """)
        .param("activityId", Activities.idOf(activity))
        .param("reporter", signer.getId())
        .param("domain", signer.getDomain())
        .param("target", target.orElse(null))
        .param("objects", String.join("\n", objects))
        .param(
            "content",
            content == null
                ? null
                : content.length() <= MAX_REPORT ? content : content.substring(0, MAX_REPORT))
        .update();
    Map<String, Object> report = new HashMap<>();
    report.put("domain", signer.getDomain());
    report.put(
        "excerpt", content == null ? null : content.substring(0, Math.min(140, content.length())));
    target.ifPresent(id -> report.put("reportedUserId", id.toString()));
    notificationService.notifyAdmins(
        NotificationType.REPORT_RECEIVED, signer.getId(), null, null, report, null);
  }

  private List<DomainRule> rules(String table, String reasonColumn) {
    return jdbcClient
        .sql(
            "select domain, "
                + reasonColumn
                + " as reason, created_at from "
                + table
                + " order by domain")
        .query(
            (rs, row) ->
                new DomainRule(
                    rs.getString("domain"),
                    rs.getString("reason"),
                    rs.getTimestamp("created_at").toInstant()))
        .list();
  }

  private static boolean matches(List<DomainRule> rules, String domain) {
    List<String> candidates = DomainPolicy.parents(stripPort(domain));
    return rules.stream().anyMatch(rule -> candidates.contains(rule.domain()));
  }

  private static String stripPort(String domain) {
    int colon = domain.indexOf(':');
    return colon < 0 ? domain : domain.substring(0, colon);
  }

  private static String host(String uri) {
    try {
      String host = URI.create(uri).getHost();
      return host == null ? "" : host.toLowerCase(Locale.ROOT);
    } catch (IllegalArgumentException e) {
      return "";
    }
  }

  private static String domain(String raw) {
    String domain = stripPort(raw == null ? "" : raw.strip().toLowerCase(Locale.ROOT));
    if (!DOMAIN.matcher(domain).matches()) {
      throw new IllegalArgumentException("Invalid domain " + raw);
    }
    return domain;
  }
}
