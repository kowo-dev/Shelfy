package com.shelfy.api.federation;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.exception.ApiException;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

@Component
public class RemoteAvatars {

  private static final Logger LOG = LoggerFactory.getLogger(RemoteAvatars.class);
  private static final int MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

  private final RemoteFetcher fetcher;
  private final AvatarStorageService avatarStorageService;
  private final UserRepository userRepository;
  private final TransactionTemplate transactionTemplate;

  public RemoteAvatars(
      RemoteFetcher fetcher,
      AvatarStorageService avatarStorageService,
      UserRepository userRepository,
      PlatformTransactionManager transactionManager) {
    this.fetcher = fetcher;
    this.avatarStorageService = avatarStorageService;
    this.userRepository = userRepository;
    this.transactionTemplate = new TransactionTemplate(transactionManager);
    this.transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
  }

  public void refresh(UUID userId, String avatarUrl) {
    String stored;
    try {
      RemoteFetcher.Fetched image = fetcher.fetchImage(URI.create(avatarUrl), MAX_DOWNLOAD_BYTES);
      stored = avatarStorageService.store(userId, new BytesFile(image));
    } catch (RemoteFetcher.RemoteFetchException | ApiException | IllegalArgumentException e) {
      LOG.info("Skipping remote avatar {}: {}", avatarUrl, e.getMessage());
      return;
    }
    String previous =
        transactionTemplate.execute(
            status ->
                userRepository
                    .findById(userId)
                    .map(
                        user -> {
                          String old = user.getAvatarFilename();
                          user.setAvatarFilename(stored);
                          user.setAvatarUpdatedAt(Instant.now());
                          return old;
                        })
                    .orElse(stored));
    if (previous != null && !previous.equals(stored)) {
      avatarStorageService.delete(previous);
    }
  }

  private record BytesFile(RemoteFetcher.Fetched image) implements MultipartFile {

    @Override
    public String getName() {
      return "avatar";
    }

    @Override
    public String getOriginalFilename() {
      return "avatar";
    }

    @Override
    public String getContentType() {
      String type = image.contentType();
      if (type == null) {
        return null;
      }
      int semicolon = type.indexOf(';');
      return (semicolon < 0 ? type : type.substring(0, semicolon)).trim().toLowerCase(Locale.ROOT);
    }

    @Override
    public boolean isEmpty() {
      return image.body().length == 0;
    }

    @Override
    public long getSize() {
      return image.body().length;
    }

    @Override
    public byte[] getBytes() {
      return image.body();
    }

    @Override
    public InputStream getInputStream() {
      return new ByteArrayInputStream(image.body());
    }

    @Override
    public void transferTo(File dest) throws IOException {
      Files.write(dest.toPath(), image.body());
    }

    @Override
    public void transferTo(Path dest) throws IOException {
      Files.write(dest, image.body());
    }
  }
}
