package com.shelfy.api.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
class AfterCommitTest {

  @Autowired private TransactionTemplate transactionTemplate;

  @Test
  void runsOnlyOnceTheTransactionCommits() {
    List<String> events = new ArrayList<>();

    transactionTemplate.executeWithoutResult(
        status -> {
          AfterCommit.run(() -> events.add("mail"));
          events.add("still in transaction");
        });

    assertEquals(List.of("still in transaction", "mail"), events);
  }

  @Test
  void neverRunsForARolledBackTransaction() {
    List<String> events = new ArrayList<>();

    assertThrows(
        IllegalStateException.class,
        () ->
            transactionTemplate.executeWithoutResult(
                status -> {
                  AfterCommit.run(() -> events.add("mail"));
                  throw new IllegalStateException("constraint violated");
                }));

    assertEquals(List.of(), events);
  }

  @Test
  void runsRightAwayOutsideATransaction() {
    List<String> events = new ArrayList<>();

    AfterCommit.run(() -> events.add("mail"));

    assertEquals(List.of("mail"), events);
  }
}
