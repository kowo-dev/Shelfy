package com.shelfy.api.comments;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

@SpringBootTest
class CommentEndpointsMappingTest {

  @Autowired
  @Qualifier("requestMappingHandlerMapping")
  private RequestMappingHandlerMapping mapping;

  @Test
  void listsPoolsAndReviewsExposeTheSameCommentRoutes() {
    Set<String> routes =
        mapping.getHandlerMethods().keySet().stream()
            .flatMap(
                info ->
                    info.getPatternValues().stream()
                        .flatMap(
                            pattern ->
                                info.getMethodsCondition().getMethods().stream()
                                    .map(method -> method + " " + pattern)))
            .collect(Collectors.toSet());

    for (String base : List.of("/api/v1/lists", "/api/v1/versus/pools", "/api/v1/reviews")) {
      String comments = base + "/{targetId}/comments";
      assertThat(routes)
          .contains(
              "POST " + comments,
              "GET " + comments,
              "PUT " + comments + "/{commentId}",
              "DELETE " + comments + "/{commentId}",
              "PUT " + comments + "/{commentId}/vote",
              "DELETE " + comments + "/{commentId}/vote");
    }
  }
}
