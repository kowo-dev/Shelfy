package com.shelfy.api.federation;

import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ConditionalOnBooleanProperty("app.federation.enabled")
@RequiredArgsConstructor
public class InboxController {

  private final InboxService inboxService;

  @PostMapping("/ap/inbox")
  public ResponseEntity<Void> receiveSharedInbox(HttpServletRequest request) throws IOException {
    return receive(request);
  }

  @PostMapping("/ap/users/{id}/inbox")
  public ResponseEntity<Void> receiveUserInbox(@PathVariable UUID id, HttpServletRequest request)
      throws IOException {
    return receive(request);
  }

  private ResponseEntity<Void> receive(HttpServletRequest request) throws IOException {
    if (request.getContentLengthLong() > RemoteFetcher.MAX_BODY_BYTES) {
      return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();
    }
    byte[] body;
    try (InputStream in = request.getInputStream()) {
      body = in.readNBytes(RemoteFetcher.MAX_BODY_BYTES + 1);
    }
    if (body.length > RemoteFetcher.MAX_BODY_BYTES) {
      return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).build();
    }
    String path =
        request.getQueryString() == null
            ? request.getRequestURI()
            : request.getRequestURI() + "?" + request.getQueryString();
    HttpStatus status = inboxService.receive("POST", path, request::getHeader, body);
    return ResponseEntity.status(status).build();
  }
}
