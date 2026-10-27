package com.shelfy.api.auth;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class TokenRetentionCleanupJob {

  private static final Logger LOG = LoggerFactory.getLogger(TokenRetentionCleanupJob.class);

  private final RefreshTokenRepository refreshTokenRepository;
  private final EmailVerificationTokenRepository emailVerificationTokenRepository;
  private final PasswordResetTokenRepository passwordResetTokenRepository;
  private final EmailChangeTokenRepository emailChangeTokenRepository;

  @Scheduled(cron = "0 30 3 * * *")
  @Transactional
  public void purgeExpiredTokens() {
    Instant cutoff = Instant.now();
    int refreshTokens = refreshTokenRepository.deleteExpiredBefore(cutoff);
    int emailVerificationTokens = emailVerificationTokenRepository.deleteExpiredBefore(cutoff);
    int passwordResetTokens = passwordResetTokenRepository.deleteExpiredBefore(cutoff);
    int emailChangeTokens = emailChangeTokenRepository.deleteExpiredBefore(cutoff);
    LOG.info(
        "Purged expired auth tokens: {} refresh, {} email verification, {} password reset, {} email change",
        refreshTokens,
        emailVerificationTokens,
        passwordResetTokens,
        emailChangeTokens);
  }
}
