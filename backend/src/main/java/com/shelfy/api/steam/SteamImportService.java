package com.shelfy.api.steam;

import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.common.ImportService;
import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class SteamImportService
    extends ImportService<SteamImportJobEntity, SteamImportEntryEntity> {

  private final SteamImportEntryRepository entryRepository;
  private final UserRepository userRepository;
  private final SteamImportRunner runner;

  public SteamImportService(
      SteamImportJobRepository jobRepository,
      SteamImportEntryRepository entryRepository,
      UserRepository userRepository,
      SteamImportRunner runner) {
    super(jobRepository, ErrorCode.STEAM_IMPORT_IN_PROGRESS, ErrorCode.STEAM_IMPORT_NOT_FOUND);
    this.entryRepository = entryRepository;
    this.userRepository = userRepository;
    this.runner = runner;
  }

  public SteamImportJobEntity startImport(UUID userId) {
    UserEntity user =
        userRepository
            .findById(userId)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
    if (user.getSteamId() == null) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST, ErrorCode.STEAM_NOT_CONNECTED, "Steam account not connected");
    }
    return launch(
        new SteamImportJobEntity(userId, user.getSteamId()),
        job -> runner.run(job.getId(), userId, user.getSteamId()));
  }

  @Override
  protected List<SteamImportEntryEntity> findEntries(UUID jobId) {
    return entryRepository.findByImportIdOrderBySteamNameAsc(jobId);
  }
}
