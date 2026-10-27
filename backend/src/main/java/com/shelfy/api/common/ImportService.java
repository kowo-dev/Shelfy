package com.shelfy.api.common;

import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

public abstract class ImportService<J extends ImportJobEntity, E> {

  private final ImportJobRepository<J> jobRepository;
  private final ErrorCode inProgress;
  private final ErrorCode notFound;

  protected ImportService(
      ImportJobRepository<J> jobRepository, ErrorCode inProgress, ErrorCode notFound) {
    this.jobRepository = jobRepository;
    this.inProgress = inProgress;
    this.notFound = notFound;
  }

  protected abstract List<E> findEntries(UUID jobId);

  protected J launch(J newJob, Consumer<J> run) {
    J job;
    try {
      job = jobRepository.saveAndFlush(newJob);
    } catch (DataIntegrityViolationException ex) {
      throw new ConflictException(inProgress, "An import is already in progress");
    }
    try {
      run.accept(job);
    } catch (TaskRejectedException ex) {
      job.fail("Import queue is full");
      jobRepository.save(job);
      throw new ConflictException(inProgress, "Too many imports are running, retry later");
    }
    return job;
  }

  @EventListener(ApplicationReadyEvent.class)
  @Transactional
  public void failInterruptedJobs() {
    jobRepository.failActiveJobs(Instant.now());
  }

  @Transactional(readOnly = true)
  public J getJob(UUID userId, UUID jobId) {
    return jobRepository
        .findByIdAndUserId(jobId, userId)
        .orElseThrow(() -> new ResourceNotFoundException(notFound, "Import job not found"));
  }

  @Transactional(readOnly = true)
  public J getLatestJob(UUID userId) {
    return jobRepository
        .findFirstByUserIdOrderByCreatedAtDesc(userId)
        .orElseThrow(() -> new ResourceNotFoundException(notFound, "No import found"));
  }

  @Transactional(readOnly = true)
  public List<E> getEntries(UUID userId, UUID jobId) {
    getJob(userId, jobId);
    return findEntries(jobId);
  }
}
