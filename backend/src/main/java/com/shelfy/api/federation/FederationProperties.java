package com.shelfy.api.federation;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "app.federation")
public record FederationProperties(
    @DefaultValue("false") boolean enabled,
    String handleDomain,
    String serverUrl,
    @DefaultValue("open") Mode mode,
    @DefaultValue("false") boolean devMode,
    @DefaultValue List<String> admins,
    @DefaultValue("false") boolean authorizedFetch) {

  public boolean isAdmin(String email, boolean emailVerified, boolean local) {
    return local
        && emailVerified
        && email != null
        && admins != null
        && admins.stream().map(String::strip).anyMatch(email.strip()::equalsIgnoreCase);
  }

  public enum Mode {
    OPEN,
    ALLOWLIST
  }
}
