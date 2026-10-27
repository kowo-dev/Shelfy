package com.shelfy.api.config;

import com.shelfy.api.auth.JwtAuthenticationFilter;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

  @Value("${app.cors.allowed-origin}")
  private String allowedOrigin;

  private final JwtAuthenticationFilter jwtAuthenticationFilter;
  private final AuthenticationEntryPoint authenticationEntryPoint;

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf.disable())
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .exceptionHandling(
            exceptions -> exceptions.authenticationEntryPoint(authenticationEntryPoint))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        "/api/v1/auth/register",
                        "/api/v1/auth/login",
                        "/api/v1/auth/refresh",
                        "/api/v1/auth/logout",
                        "/api/v1/auth/forgot-password",
                        "/api/v1/auth/reset-password",
                        "/api/v1/auth/verify-email",
                        "/api/v1/auth/resend-verification",
                        "/api/v1/legal/info",
                        "/api/v1/federation/remote-follow",
                        "/api/v1/steam/oauth/callback",
                        "/api/v1/discover/**",
                        "/api/v1/tmdb/**",
                        "/api/v1/igdb/**",
                        "/api/v1/anilist/**",
                        "/api/v1/search",
                        "/uploads/avatars/**",
                        "/actuator/health",
                        "/.well-known/webfinger",
                        "/.well-known/host-meta",
                        "/.well-known/nodeinfo",
                        "/nodeinfo/**",
                        "/ap/**",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html")
                    .permitAll()
                    .requestMatchers(
                        HttpMethod.GET,
                        "/api/v1/search/explore",
                        "/api/v1/search/vocabulary",
                        "/api/v1/search/streaming",
                        "/api/v1/search/facets",
                        "/api/v1/users/reviews/media",
                        "/api/v1/people/search",
                        "/api/v1/collection/lookup",
                        "/api/v1/media/*/*/related",
                        "/api/v1/media/*/*/similar")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/v1/collection/lookup-batch")
                    .permitAll()
                    .requestMatchers(
                        HttpMethod.GET,
                        "/api/v1/lists",
                        "/api/v1/lists/*",
                        "/api/v1/lists/profile/*",
                        "/api/v1/lists/*/comments",
                        "/api/v1/versus/pools",
                        "/api/v1/versus/pools/*",
                        "/api/v1/versus/pools/profile/*",
                        "/api/v1/versus/pools/*/results",
                        "/api/v1/versus/sessions/*/result",
                        "/api/v1/versus/clips/thumbnail",
                        "/api/v1/users/reviews",
                        "/api/v1/users/reviews/*",
                        "/api/v1/users/reviews/*/watch-log",
                        "/api/v1/users/*/reviews",
                        "/api/v1/users/*/profile",
                        "/api/v1/users/*/collection",
                        "/api/v1/users/*/collection/stats",
                        "/api/v1/users/*/essentials",
                        "/api/v1/users/*/activity",
                        "/api/v1/follows/popular",
                        "/api/v1/reviews/*/comments")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(List.of(allowedOrigin));
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    configuration.setAllowedHeaders(List.of("*"));
    configuration.setAllowCredentials(true);
    configuration.setMaxAge(Duration.ofHours(2));
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }
}
