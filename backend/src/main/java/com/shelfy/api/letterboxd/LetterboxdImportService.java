package com.shelfy.api.letterboxd;

import com.shelfy.api.common.ImportService;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LetterboxdImportService
    extends ImportService<LetterboxdImportJobEntity, LetterboxdImportEntryEntity> {

  private final LetterboxdImportEntryRepository entryRepository;
  private final LetterboxdImportRunner runner;

  public LetterboxdImportService(
      LetterboxdImportJobRepository jobRepository,
      LetterboxdImportEntryRepository entryRepository,
      LetterboxdImportRunner runner) {
    super(
        jobRepository,
        ErrorCode.LETTERBOXD_IMPORT_IN_PROGRESS,
        ErrorCode.LETTERBOXD_IMPORT_NOT_FOUND);
    this.entryRepository = entryRepository;
    this.runner = runner;
  }

  public LetterboxdImportJobEntity startImport(UUID userId, MultipartFile file) {
    byte[] zipBytes = readAndValidate(file);
    return launch(
        new LetterboxdImportJobEntity(userId), job -> runner.run(job.getId(), userId, zipBytes));
  }

  @Override
  protected List<LetterboxdImportEntryEntity> findEntries(UUID jobId) {
    return entryRepository.findByImportIdOrderByLetterboxdTitleAsc(jobId);
  }

  private byte[] readAndValidate(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new BadRequestException(
          ErrorCode.LETTERBOXD_INVALID_FILE, "The uploaded export file is empty");
    }
    String filename = file.getOriginalFilename();
    boolean looksLikeZip =
        (filename != null && filename.toLowerCase(Locale.ROOT).endsWith(".zip"))
            || "application/zip".equals(file.getContentType())
            || "application/x-zip-compressed".equals(file.getContentType());
    if (!looksLikeZip) {
      throw new BadRequestException(
          ErrorCode.LETTERBOXD_INVALID_FILE, "Expected a Letterboxd export .zip file");
    }
    try {
      return file.getBytes();
    } catch (IOException ex) {
      throw new BadRequestException(
          ErrorCode.LETTERBOXD_INVALID_FILE, "Could not read the uploaded file");
    }
  }
}
