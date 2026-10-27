package com.shelfy.api.federation;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DomainPolicy {

  private final JdbcClient jdbcClient;
  private final FederationProperties properties;
  private final FederationUris uris;

  public boolean isAllowed(String host) {
    if (host == null || host.isBlank()) {
      return false;
    }
    String domain = host.toLowerCase(Locale.ROOT);
    if (uris.isLocalDomain(domain)) {
      return true;
    }
    List<String> candidates = parents(domain);
    boolean blocked =
        jdbcClient
            .sql("select exists (select 1 from domain_blocks where lower(domain) in (:domains))")
            .param("domains", candidates)
            .query(Boolean.class)
            .single();
    if (blocked) {
      return false;
    }
    if (properties.mode() == FederationProperties.Mode.OPEN) {
      return true;
    }
    return jdbcClient
        .sql("select exists (select 1 from domain_allows where lower(domain) in (:domains))")
        .param("domains", candidates)
        .query(Boolean.class)
        .single();
  }

  static List<String> parents(String domain) {
    List<String> result = new ArrayList<>();
    String current = domain;
    while (true) {
      result.add(current);
      int dot = current.indexOf('.');
      if (dot < 0 || current.indexOf('.', dot + 1) < 0) {
        return result;
      }
      current = current.substring(dot + 1);
    }
  }
}
