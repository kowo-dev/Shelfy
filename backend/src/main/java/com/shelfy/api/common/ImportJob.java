package com.shelfy.api.common;

public interface ImportJob {

  void start();

  void total(int total);

  void progress(int imported, int skipped);

  void complete();

  void fail(String code);
}
