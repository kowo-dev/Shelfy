package com.shelfy.api.common;

import java.util.UUID;
import java.util.function.Consumer;
import org.springframework.data.repository.CrudRepository;

public final class ImportJobTracker<J extends ImportJob> {

  private final CrudRepository<J, UUID> repository;

  public ImportJobTracker(CrudRepository<J, UUID> repository) {
    this.repository = repository;
  }

  public void start(UUID jobId) {
    update(jobId, ImportJob::start);
  }

  public void total(UUID jobId, int total) {
    update(jobId, job -> job.total(total));
  }

  public void progress(UUID jobId, int imported, int skipped) {
    update(jobId, job -> job.progress(imported, skipped));
  }

  public void complete(UUID jobId) {
    update(jobId, ImportJob::complete);
  }

  public void fail(UUID jobId, String code) {
    update(jobId, job -> job.fail(code));
  }

  private void update(UUID jobId, Consumer<J> change) {
    J job =
        repository
            .findById(jobId)
            .orElseThrow(() -> new IllegalStateException("Import job not found: " + jobId));
    change.accept(job);
    repository.save(job);
  }
}
