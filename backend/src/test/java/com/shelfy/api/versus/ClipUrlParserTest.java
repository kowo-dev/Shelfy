package com.shelfy.api.versus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.shelfy.api.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ClipUrlParserTest {

  @ParameterizedTest
  @ValueSource(
      strings = {
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
      })
  void youtube_formsGiveTheVideoId(String url) {
    ClipUrlParser.ClipRef ref = ClipUrlParser.parse(url);
    assertEquals(ClipProvider.YOUTUBE, ref.provider());
    assertEquals("dQw4w9WgXcQ", ref.externalId());
  }

  @Test
  void youtube_startTimeIsRead() {
    assertEquals(90, ClipUrlParser.parse("https://youtu.be/dQw4w9WgXcQ?t=1m30s").startSeconds());
    assertEquals(42, ClipUrlParser.parse("https://youtu.be/dQw4w9WgXcQ?t=42").startSeconds());
    assertNull(ClipUrlParser.parse("https://youtu.be/dQw4w9WgXcQ?t=junk").startSeconds());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "not a url",
        "javascript:alert(1)",
        "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
        "https://evil.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/watch?v=short",
        "https://youtube.com/watch?v=dQw4w9WgXcQ%22onload",
        "https://vimeo.com/76979871",
        "https://player.vimeo.com/video/76979871",
        "https://soundcloud.com/artist/track-name",
        "https://on.soundcloud.com/xyz"
      })
  void anythingElse_isRejected(String url) {
    assertThrows(BadRequestException.class, () -> ClipUrlParser.parse(url));
  }

  @Test
  void thumbnails_mustComeFromTheProviderImageHosts() {
    assertTrue(ClipResolver.isAllowedThumbnail("https://i.ytimg.com/vi/x/hqdefault.jpg"));
    assertFalse(ClipResolver.isAllowedThumbnail("https://i1.sndcdn.com/artworks-x.jpg"));
    assertFalse(ClipResolver.isAllowedThumbnail("http://i.ytimg.com/vi/x/hqdefault.jpg"));
    assertFalse(ClipResolver.isAllowedThumbnail("https://169.254.169.254/latest/meta-data"));
    assertFalse(ClipResolver.isAllowedThumbnail("https://evil.com/i.ytimg.com.jpg"));
  }

  @Test
  void letterboxedYoutubeThumbnails_pointToTheWidescreenVersion() {
    assertEquals(
        "https://i.ytimg.com/vi/x/hq720.jpg",
        ClipResolver.widescreen("https://i.ytimg.com/vi/x/hqdefault.jpg"));
    assertEquals(
        "https://i.ytimg.com/vi/x/mqdefault.jpg",
        ClipResolver.widescreen("https://i.ytimg.com/vi/x/mqdefault.jpg"));
    assertEquals(
        "https://evil.com/vi/x/hqdefault.jpg",
        ClipResolver.widescreen("https://evil.com/vi/x/hqdefault.jpg"));
  }
}
