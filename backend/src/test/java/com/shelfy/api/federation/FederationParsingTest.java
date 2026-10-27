package com.shelfy.api.federation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.InetAddress;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class FederationParsingTest {

  private static final JsonMapper JSON = JsonMapper.builder().build();
  private static final String PEM = RsaKeys.publicPem(RsaKeys.generate().getPublic());

  @Test
  void onlyLocalAccountsWithAVerifiedListedEmailAreAdmins() {
    FederationProperties properties =
        new FederationProperties(
            true,
            "shelfy.test",
            "https://api.shelfy.test",
            null,
            false,
            List.of(" Kowo@Example.com "),
            false);

    assertThat(properties.isAdmin("kowo@example.com", true, true)).isTrue();
    assertThat(properties.isAdmin("kowo@example.com", false, true)).isFalse();
    assertThat(properties.isAdmin("kowo@example.com", true, false)).isFalse();
    assertThat(properties.isAdmin("someone@example.com", true, true)).isFalse();
    assertThat(properties.isAdmin(null, true, true)).isFalse();
    assertThat(
            new FederationProperties(true, null, null, null, false, List.of(), false)
                .isAdmin("kowo@example.com", true, true))
        .isFalse();
  }

  @Test
  void handlesAreParsed() {
    assertThat(RemoteActorService.Handle.parse("@alice@Shelfy.Example"))
        .contains(new RemoteActorService.Handle("alice", "shelfy.example"));
    assertThat(RemoteActorService.Handle.parse("acct:bob@host.test:8082"))
        .contains(new RemoteActorService.Handle("bob", "host.test:8082"));
    assertThat(RemoteActorService.Handle.parse("alice")).isEmpty();
    assertThat(RemoteActorService.Handle.parse("alice@")).isEmpty();
    assertThat(RemoteActorService.Handle.parse("a@b@c.example")).isEmpty();
    assertThat(RemoteActorService.Handle.parse("alice@evil.example/path")).isEmpty();
  }

  @Test
  void actorIsParsed() {
    RemoteActorService.ParsedActor actor =
        RemoteActorService.parseActor(
            "https://remote.example/users/alice", actor("https://remote.example/users/alice"));

    assertThat(actor.username()).isEqualTo("alice");
    assertThat(actor.displayName()).isEqualTo("Alice & co");
    assertThat(actor.bio()).isEqualTo("Hello\nworld");
    assertThat(actor.sharedInbox()).isEqualTo("https://remote.example/inbox");
    assertThat(actor.avatarUrl()).isEqualTo("https://remote.example/a.png");
  }

  @Test
  void actorWithAnotherIdIsRejected() {
    assertThatThrownBy(
            () ->
                RemoteActorService.parseActor(
                    "https://remote.example/users/alice",
                    actor("https://evil.example/users/alice")))
        .isInstanceOf(RemoteFetcher.RemoteFetchException.class);
  }

  @Test
  void keyOwnedBySomeoneElseIsRejected() {
    JsonNode doc =
        JSON.readTree(
            actor("https://remote.example/users/alice")
                .toString()
                .replace(
                    "\"owner\":\"https://remote.example/users/alice\"",
                    "\"owner\":\"https://remote.example/users/mallory\""));

    assertThatThrownBy(
            () -> RemoteActorService.parseActor("https://remote.example/users/alice", doc))
        .isInstanceOf(RemoteFetcher.RemoteFetchException.class);
  }

  @Test
  void selfLinkNeedsAnActivityType() {
    JsonNode jrd =
        JSON.readTree(
            """
            {"links": [
              {"rel": "self", "type": "text/html", "href": "https://remote.example/@alice"},
              {"rel": "self", "type": "application/activity+json",
               "href": "https://remote.example/users/alice"}]}
            """);

    assertThat(RemoteActorService.selfLink(jrd)).contains("https://remote.example/users/alice");
    assertThat(RemoteActorService.selfLink(JSON.readTree("{}"))).isEqualTo(Optional.empty());
  }

  @Test
  void privateAddressesAreDetected() throws Exception {
    for (String address :
        new String[] {
          "127.0.0.1",
          "10.1.2.3",
          "172.16.0.1",
          "192.168.1.20",
          "169.254.169.254",
          "0.0.0.0",
          "100.64.0.1",
          "::1",
          "fd00::1",
          "fe80::1"
        }) {
      assertThat(RemoteFetcher.isPrivate(InetAddress.getByName(address))).as(address).isTrue();
    }
    assertThat(RemoteFetcher.isPrivate(InetAddress.getByName("93.184.216.34"))).isFalse();
    assertThat(RemoteFetcher.isPrivate(InetAddress.getByName("2606:4700::1111"))).isFalse();
  }

  @Test
  void blockCandidatesCoverParentDomains() {
    assertThat(DomainPolicy.parents("a.b.evil.example"))
        .containsExactly("a.b.evil.example", "b.evil.example", "evil.example");
    assertThat(DomainPolicy.parents("example")).containsExactly("example");
  }

  @Test
  void remoteHtmlBecomesPlainText() {
    assertThat(RemoteActorService.plainText("<p>Hello<br>world</p>")).isEqualTo("Hello\nworld");
    assertThat(RemoteActorService.plainText("<p>One</p>\n  <p class=\"x\">Two</p>"))
        .isEqualTo("One\n\nTwo");
    assertThat(RemoteActorService.plainText("a<BR />b<br/>c")).isEqualTo("a\nb\nc");
    assertThat(RemoteActorService.plainText("<b>Tom &amp; Jerry</b>")).isEqualTo("Tom & Jerry");
    assertThat(RemoteActorService.plainText("1 < 2")).isEqualTo("1 < 2");
    assertThat(RemoteActorService.plainText("<p></p>")).isNull();
  }

  @Test
  void hostileHtmlIsHandledInLinearTime() {
    long start = System.nanoTime();
    RemoteActorService.plainText("<".repeat(1_000_000));
    RemoteActorService.plainText("<a".repeat(500_000) + ">");
    RemoteActorService.plainText("</p> ".repeat(200_000));
    assertThat(System.nanoTime() - start).isLessThan(1_000_000_000L);
  }

  private static JsonNode actor(String id) {
    return JSON.readTree(
        """
        {"id": "%s", "type": "Person", "preferredUsername": "alice",
         "name": "Alice &amp; co", "summary": "<p>Hello<br>world</p>",
         "inbox": "https://remote.example/users/alice/inbox",
         "endpoints": {"sharedInbox": "https://remote.example/inbox"},
         "icon": {"type": "Image", "url": "https://remote.example/a.png"},
         "publicKey": {"id": "https://remote.example/users/alice#main-key",
                       "owner": "https://remote.example/users/alice",
                       "publicKeyPem": %s}}
        """
            .formatted(id, JSON.writeValueAsString(PEM)));
  }
}
