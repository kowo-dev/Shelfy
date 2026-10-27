package com.shelfy.api.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

  private static final Set<String> AUTH_PATHS =
      Set.of(
          "/api/v1/auth/login",
          "/api/v1/auth/register",
          "/api/v1/auth/forgot-password",
          "/api/v1/auth/reset-password",
          "/api/v1/auth/verify-email",
          "/api/v1/auth/resend-verification");
  private static final Rule AUTH_RULE = new Rule("auth", 10, Duration.ofMinutes(1));
  private static final Rule SEARCH_RULE = new Rule("search", 60, Duration.ofMinutes(1));

  private static final List<String> PROVIDER_PREFIXES =
      List.of("/api/v1/tmdb/", "/api/v1/igdb/", "/api/v1/anilist/", "/api/v1/media/");

  private static final Rule INBOX_RULE = new Rule("inbox", 600, Duration.ofMinutes(1));
  private static final Rule REMOTE_FOLLOW_RULE =
      new Rule("remote-follow", 20, Duration.ofMinutes(1));
  private static final Rule PROVIDER_RULE = new Rule("providers", 240, Duration.ofMinutes(1));
  private static final int CLEANUP_THRESHOLD = 10_000;
  private static final String CLIENT_IP_HEADER = "X-Shelfy-Client-IP";
  private static final String BODY =
      "{\"type\":\"about:blank\",\"title\":\"Too Many Requests\",\"status\":429,"
          + "\"detail\":\"Too many requests\",\"code\":\"RATE_LIMITED\"}";

  private final Map<String, Counter> counters = new ConcurrentHashMap<>();

  @Override
  protected void doFilterInternal(
      @NonNull HttpServletRequest request,
      @NonNull HttpServletResponse response,
      @NonNull FilterChain filterChain)
      throws ServletException, IOException {
    Rule rule = ruleFor(request);
    if (rule != null && !tryAcquire(rule, clientIp(request))) {
      response.setStatus(429);
      response.setHeader("Retry-After", String.valueOf(rule.window().toSeconds()));
      response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
      response.getOutputStream().write(BODY.getBytes(StandardCharsets.UTF_8));
      return;
    }
    filterChain.doFilter(request, response);
  }

  private static Rule ruleFor(HttpServletRequest request) {
    // Decoded like the controllers see it, so /api/v1/auth/%6Cogin counts as a login
    String path = UrlPathHelper.defaultInstance.getPathWithinApplication(request);
    if (HttpMethod.POST.matches(request.getMethod()) && AUTH_PATHS.contains(path)) {
      return AUTH_RULE;
    }
    if (HttpMethod.GET.matches(request.getMethod()) && isSearchPath(path)) {
      return SEARCH_RULE;
    }
    if (HttpMethod.POST.matches(request.getMethod()) && isInboxPath(path)) {
      return INBOX_RULE;
    }
    if (HttpMethod.GET.matches(request.getMethod())
        && "/api/v1/federation/remote-follow".equals(path)) {
      return REMOTE_FOLLOW_RULE;
    }
    if (PROVIDER_PREFIXES.stream().anyMatch(path::startsWith)) {
      return PROVIDER_RULE;
    }
    return null;
  }

  private static String clientIp(HttpServletRequest request) {
    String proxiedIp = request.getHeader(CLIENT_IP_HEADER);
    return proxiedIp == null || proxiedIp.isBlank() ? request.getRemoteAddr() : proxiedIp;
  }

  private static boolean isInboxPath(String path) {
    return "/ap/inbox".equals(path) || (path.startsWith("/ap/users/") && path.endsWith("/inbox"));
  }

  private static boolean isSearchPath(String path) {
    return "/api/v1/search".equals(path)
        || "/api/v1/search/explore".equals(path)
        || "/api/v1/search/facets".equals(path);
  }

  private boolean tryAcquire(Rule rule, String clientIp) {
    long now = System.currentTimeMillis();
    long windowMillis = rule.window().toMillis();
    if (counters.size() > CLEANUP_THRESHOLD) {
      counters.values().removeIf(counter -> now - counter.windowStart() >= counter.windowMillis());
    }
    Counter counter =
        counters.compute(
            rule.name() + ':' + clientIp,
            (key, current) ->
                current == null || now - current.windowStart() >= windowMillis
                    ? new Counter(now, windowMillis, 1)
                    : new Counter(current.windowStart(), windowMillis, current.count() + 1));
    return counter.count() <= rule.limit();
  }

  private record Rule(String name, int limit, Duration window) {}

  private record Counter(long windowStart, long windowMillis, int count) {}
}
