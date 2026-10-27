package com.shelfy.api.federation;

import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
public class DeliveryService {

  static final int MAX_ATTEMPTS = 12;
  static final int BATCH_SIZE = 20;
  private static final Logger LOG = LoggerFactory.getLogger(DeliveryService.class);
  private static final Duration LEASE = Duration.ofMinutes(5);
  private static final Duration MAX_BACKOFF = Duration.ofHours(24);
  private static final Duration TIMEOUT = Duration.ofSeconds(15);
  private static final Duration BATCH_DEADLINE = Duration.ofMinutes(1);

  private final JdbcClient jdbcClient;
  private final ObjectMapper objectMapper;
  private final ActorStore actorStore;
  private final FederationUris uris;
  private final FederationProperties properties;
  private final RemoteFetcher fetcher;
  private final HttpClient httpClient;
  private final Clock clock;
  private final NotificationService notificationService;

  @Autowired
  public DeliveryService(
      JdbcClient jdbcClient,
      ObjectMapper objectMapper,
      ActorStore actorStore,
      FederationUris uris,
      FederationProperties properties,
      RemoteFetcher fetcher,
      NotificationService notificationService) {
    this(
        jdbcClient,
        objectMapper,
        actorStore,
        uris,
        properties,
        fetcher,
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build(),
        Clock.systemUTC(),
        notificationService);
  }

  DeliveryService(
      JdbcClient jdbcClient,
      ObjectMapper objectMapper,
      ActorStore actorStore,
      FederationUris uris,
      FederationProperties properties,
      RemoteFetcher fetcher,
      HttpClient httpClient,
      Clock clock,
      NotificationService notificationService) {
    this.jdbcClient = jdbcClient;
    this.objectMapper = objectMapper;
    this.actorStore = actorStore;
    this.uris = uris;
    this.properties = properties;
    this.fetcher = fetcher;
    this.httpClient = httpClient;
    this.clock = clock;
    this.notificationService = notificationService;
  }

  record Delivery(
      UUID id,
      UUID senderId,
      String inbox,
      String payload,
      int attempts,
      String signingKeyId,
      String signingKeyPem) {}

  public void enqueue(UUID senderId, String inbox, Map<String, Object> activity) {
    enqueueAfter(senderId, inbox, activity, Duration.ZERO);
  }

  public void enqueueAfter(
      UUID senderId, String inbox, Map<String, Object> activity, Duration delay) {
    if (!properties.enabled() || inbox == null) {
      return;
    }
    jdbcClient
        .sql(
            """
            insert into ap_deliveries (sender_id, inbox, payload, next_attempt_at)
            values (:sender, :inbox, :payload, :due)
            """)
        .param("sender", senderId)
        .param("inbox", inbox)
        .param("payload", objectMapper.writeValueAsString(activity))
        .param("due", now().plus(delay))
        .update();
  }

  public void enqueueSignedBy(ActorStore.KeyPem key, String inbox, Map<String, Object> activity) {
    if (!properties.enabled() || inbox == null) {
      return;
    }
    jdbcClient
        .sql(
            """
            insert into ap_deliveries (inbox, payload, signing_key_id, signing_key_pem)
            values (:inbox, :payload, :keyId, :keyPem)
            """)
        .param("inbox", inbox)
        .param("payload", objectMapper.writeValueAsString(activity))
        .param("keyId", key.keyId())
        .param("keyPem", key.privatePem())
        .update();
  }

  public int deliverDue() {
    List<Delivery> due =
        jdbcClient
            .sql(
                """
                update ap_deliveries set next_attempt_at = :leaseUntil
                where id in (
                  select id from ap_deliveries where next_attempt_at <= :now
                  order by next_attempt_at limit :batch for update skip locked)
                returning id, sender_id, inbox, payload, attempts, signing_key_id, signing_key_pem
                """)
            .param("now", now())
            .param("leaseUntil", now().plus(LEASE))
            .param("batch", BATCH_SIZE)
            .query(Delivery.class)
            .list();
    if (due.isEmpty()) {
      return 0;
    }
    try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
      List<Future<?>> tasks =
          due.stream()
              .<Future<?>>map(delivery -> executor.submit(() -> deliver(delivery)))
              .toList();
      long deadline = System.nanoTime() + BATCH_DEADLINE.toNanos();
      for (Future<?> task : tasks) {
        try {
          task.get(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS);
        } catch (TimeoutException e) {
          task.cancel(true);
          LOG.warn("Delivery task still running after {}, cancelled", BATCH_DEADLINE);
        } catch (Exception e) {
          LOG.warn("Delivery task failed", e);
        }
      }
    }
    return due.size();
  }

  void deliver(Delivery delivery) {
    int status;
    String error;
    try {
      status = post(delivery);
      error = "HTTP " + status;
    } catch (RemoteFetcher.RemoteFetchException e) {
      status = 0;
      error = e.getMessage();
    }
    if (status >= 200 && status < 300) {
      remove(delivery.id());
      return;
    }
    boolean permanent = status >= 400 && status < 500 && status != 408 && status != 429;
    int attempts = delivery.attempts() + 1;
    if (permanent || attempts >= MAX_ATTEMPTS) {
      LOG.info("Dropping delivery to {} after {} attempts: {}", delivery.inbox(), attempts, error);
      remove(delivery.id());
      if (!permanent) {
        String domain = URI.create(delivery.inbox()).getHost();
        notificationService.notifyAdmins(
            NotificationType.DELIVERY_FAILING,
            null,
            null,
            null,
            Map.of("domain", domain, "error", String.valueOf(error)),
            NotificationType.DELIVERY_FAILING.name() + ":" + domain);
      }
      return;
    }
    jdbcClient
        .sql(
            """
            update ap_deliveries set attempts = :attempts, next_attempt_at = :next, last_error = :error
            where id = :id
            """)
        .param("attempts", attempts)
        .param("next", now().plus(backoff(attempts)))
        .param("error", error)
        .param("id", delivery.id())
        .update();
  }

  static Duration backoff(int attempts) {
    Duration delay = Duration.ofMinutes(1L << Math.min(attempts - 1, 20));
    return delay.compareTo(MAX_BACKOFF) > 0 ? MAX_BACKOFF : delay;
  }

  private int post(Delivery delivery) {
    URI inbox = URI.create(delivery.inbox());
    fetcher.checkTarget(inbox);
    ActorStore.KeyPem key;
    if (delivery.signingKeyPem() != null) {
      key = new ActorStore.KeyPem(delivery.signingKeyId(), null, delivery.signingKeyPem());
    } else if (delivery.senderId() == null) {
      key = actorStore.instanceKey();
    } else {
      key = actorStore.localKey(delivery.senderId());
    }
    byte[] body = delivery.payload().getBytes(StandardCharsets.UTF_8);
    HttpRequest.Builder request =
        HttpRequest.newBuilder(inbox)
            .timeout(TIMEOUT)
            .header("Content-Type", "application/activity+json")
            .header("User-Agent", "Shelfy (+" + uris.instanceActor() + ")")
            .POST(HttpRequest.BodyPublishers.ofByteArray(body));
    HttpSignatures.sign(
            "POST",
            inbox,
            body,
            key.keyId(),
            RsaKeys.parsePrivate(key.privatePem()),
            clock.instant())
        .forEach(request::header);
    try {
      return RemoteFetcher.sendWithin(
              httpClient, request.build(), HttpResponse.BodyHandlers.discarding(), TIMEOUT)
          .statusCode();
    } catch (IOException e) {
      throw new RemoteFetcher.RemoteFetchException("Could not reach " + inbox + ": " + e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RemoteFetcher.RemoteFetchException("Interrupted while delivering to " + inbox);
    }
  }

  private void remove(UUID id) {
    jdbcClient.sql("delete from ap_deliveries where id = :id").param("id", id).update();
  }

  private OffsetDateTime now() {
    return clock.instant().atOffset(ZoneOffset.UTC);
  }
}
