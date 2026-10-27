package com.shelfy.api.search;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SearchConfig {

  @Bean(destroyMethod = "close")
  public ExecutorService searchExecutor() {
    return Executors.newVirtualThreadPerTaskExecutor();
  }
}
