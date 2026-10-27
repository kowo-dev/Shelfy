package com.shelfy.api.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import jakarta.servlet.ServletException;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {

  private final RateLimitFilter filter = new RateLimitFilter();

  @Test
  void login_isLimitedPerClientIp() throws Exception {
    for (int i = 0; i < 10; i++) {
      assertEquals(200, call("POST", "/api/v1/auth/login", "10.0.0.1"));
    }
    assertEquals(429, call("POST", "/api/v1/auth/login", "10.0.0.1"));
    assertEquals(200, call("POST", "/api/v1/auth/login", "10.0.0.2"));
  }

  @Test
  void percentEncodedPaths_countAgainstTheSameBudget() throws Exception {
    for (int i = 0; i < 10; i++) {
      assertEquals(200, call("POST", "/api/v1/auth/%6Cogin", "10.0.7.1"));
    }
    assertEquals(429, call("POST", "/api/v1/auth/login", "10.0.7.1"));
    assertEquals(429, call("POST", "/api/v1/auth/%6C%6Fgin", "10.0.7.1"));
  }

  @Test
  void search_hasItsOwnBudget() throws Exception {
    for (int i = 0; i < 60; i++) {
      assertEquals(200, call("GET", "/api/v1/search", "10.0.1.1"));
    }
    assertEquals(429, call("GET", "/api/v1/search", "10.0.1.1"));
    assertEquals(200, call("POST", "/api/v1/auth/login", "10.0.1.1"));
  }

  @Test
  void providerProxies_shareOneBudget() throws Exception {
    for (int i = 0; i < 120; i++) {
      assertEquals(200, call("GET", "/api/v1/tmdb/movies/1", "10.0.4.1"));
      assertEquals(200, call("GET", "/api/v1/igdb/games/1", "10.0.4.1"));
    }
    assertEquals(429, call("GET", "/api/v1/anilist/anime/1", "10.0.4.1"));
    assertEquals(200, call("GET", "/api/v1/discover/movies/trending", "10.0.4.1"));
  }

  @Test
  void federationInboxes_shareOneBudgetPerClientIp() throws Exception {
    for (int i = 0; i < 300; i++) {
      assertEquals(200, call("POST", "/ap/inbox", "10.0.5.1"));
      assertEquals(200, call("POST", "/ap/users/1b4e28ba/inbox", "10.0.5.1"));
    }
    assertEquals(429, call("POST", "/ap/inbox", "10.0.5.1"));
    assertEquals(200, call("POST", "/ap/inbox", "10.0.5.2"));
    assertEquals(200, call("GET", "/ap/users/1b4e28ba", "10.0.5.1"));
  }

  @Test
  void remoteFollowLookups_areLimitedPerClientIp() throws Exception {
    for (int i = 0; i < 20; i++) {
      assertEquals(200, call("GET", "/api/v1/federation/remote-follow", "10.0.6.1"));
    }
    assertEquals(429, call("GET", "/api/v1/federation/remote-follow", "10.0.6.1"));
    assertEquals(200, call("GET", "/api/v1/federation/remote-follow", "10.0.6.2"));
  }

  @Test
  void otherRoutes_areNeverLimited() throws Exception {
    for (int i = 0; i < 200; i++) {
      assertEquals(200, call("GET", "/api/v1/lists", "10.0.2.1"));
    }
  }

  @Test
  void proxyClientIp_separatesClientsBehindTheSameProxy() throws Exception {
    for (int i = 0; i < 10; i++) {
      assertEquals(200, call("POST", "/api/v1/auth/login", "172.18.0.2", "10.0.3.1"));
    }
    assertEquals(429, call("POST", "/api/v1/auth/login", "172.18.0.2", "10.0.3.1"));
    assertEquals(200, call("POST", "/api/v1/auth/login", "172.18.0.2", "10.0.3.2"));
  }

  @Test
  void explorationAndFacetLookups_shareTheSearchBudget() throws Exception {
    for (int i = 0; i < 30; i++) {
      assertEquals(200, call("GET", "/api/v1/search/explore", "10.0.9.1"));
      assertEquals(200, call("GET", "/api/v1/search/facets", "10.0.9.1"));
    }
    assertEquals(429, call("GET", "/api/v1/search", "10.0.9.1"));
  }

  private int call(String method, String path, String ip) throws ServletException, IOException {
    return call(method, path, ip, null);
  }

  private int call(String method, String path, String ip, String proxiedIp)
      throws ServletException, IOException {
    MockHttpServletRequest request = new MockHttpServletRequest(method, path);
    request.setRemoteAddr(ip);
    if (proxiedIp != null) {
      request.addHeader("X-Shelfy-Client-IP", proxiedIp);
    }
    MockHttpServletResponse response = new MockHttpServletResponse();
    filter.doFilter(request, response, new MockFilterChain());
    return response.getStatus();
  }
}
