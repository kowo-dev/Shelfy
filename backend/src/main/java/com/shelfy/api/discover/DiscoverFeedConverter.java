package com.shelfy.api.discover;

import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

@Component
public class DiscoverFeedConverter implements Converter<String, DiscoverFeed> {

  @Override
  public DiscoverFeed convert(String source) {
    return DiscoverFeed.fromSlug(source);
  }
}
