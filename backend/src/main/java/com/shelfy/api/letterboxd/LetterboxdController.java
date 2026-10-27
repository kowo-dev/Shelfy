package com.shelfy.api.letterboxd;

import com.shelfy.api.letterboxd.dto.LetterboxdImportEntryResponseDto;
import com.shelfy.api.letterboxd.dto.LetterboxdImportStatusResponseDto;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/letterboxd")
@RequiredArgsConstructor
public class LetterboxdController {

  private final LetterboxdImportService letterboxdImportService;

  @PostMapping("/import")
  public LetterboxdImportStatusResponseDto startImport(
      @AuthenticationPrincipal UUID userId, @RequestParam("file") MultipartFile file) {
    return toStatusResponse(letterboxdImportService.startImport(userId, file));
  }

  @GetMapping("/import/latest")
  public LetterboxdImportStatusResponseDto getLatestImport(@AuthenticationPrincipal UUID userId) {
    return toStatusResponse(letterboxdImportService.getLatestJob(userId));
  }

  @GetMapping("/import/{jobId}")
  public LetterboxdImportStatusResponseDto importStatus(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID jobId) {
    return toStatusResponse(letterboxdImportService.getJob(userId, jobId));
  }

  @GetMapping("/import/{jobId}/entries")
  public List<LetterboxdImportEntryResponseDto> importEntries(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID jobId) {
    return letterboxdImportService.getEntries(userId, jobId).stream()
        .map(
            entry ->
                new LetterboxdImportEntryResponseDto(
                    entry.getLetterboxdTitle(),
                    entry.getLetterboxdYear(),
                    entry.getStatus(),
                    entry.getReason(),
                    entry.getReasonDetail()))
        .toList();
  }

  private LetterboxdImportStatusResponseDto toStatusResponse(LetterboxdImportJobEntity job) {
    return new LetterboxdImportStatusResponseDto(
        job.getId(),
        job.getStatus(),
        job.getEntriesTotal(),
        job.getEntriesImported(),
        job.getEntriesSkipped(),
        job.getErrorMessage());
  }

  private UUID userId(@AuthenticationPrincipal UUID userId) {
    return userId;
  }
}
