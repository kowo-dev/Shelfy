package com.shelfy.api.federation;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

@Component
@ConditionalOnBooleanProperty(name = {"app.federation.enabled", "app.federation.authorized-fetch"})
@RequiredArgsConstructor
public class AuthorizedFetchFilter extends OncePerRequestFilter {

  private static final String INSTANCE_ACTOR = "/ap/actor";

  private final InboxService inbox;

  @Override
  protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
    // Decoded like the controllers see it, so /%61p/users/... still needs a signature
    String path = UrlPathHelper.defaultInstance.getPathWithinApplication(request);
    boolean read =
        HttpMethod.GET.matches(request.getMethod()) || HttpMethod.HEAD.matches(request.getMethod());
    return !read || !path.startsWith("/ap/") || path.equals(INSTANCE_ACTOR);
  }

  @Override
  protected void doFilterInternal(
      @NonNull HttpServletRequest request,
      @NonNull HttpServletResponse response,
      @NonNull FilterChain filterChain)
      throws ServletException, IOException {
    String path =
        request.getQueryString() == null
            ? request.getRequestURI()
            : request.getRequestURI() + "?" + request.getQueryString();
    HttpStatus status = inbox.authorizeFetch(request.getMethod(), path, request::getHeader);
    if (status != HttpStatus.OK) {
      response.setStatus(status.value());
      if (status == HttpStatus.UNAUTHORIZED) {
        response.setHeader("WWW-Authenticate", "Signature headers=\"(request-target) host date\"");
      }
      return;
    }
    filterChain.doFilter(request, response);
  }
}
