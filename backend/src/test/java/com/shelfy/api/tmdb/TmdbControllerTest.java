package com.shelfy.api.tmdb;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.auth.ViewerPreferences;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TmdbControllerTest {

  private final TmdbService tmdbService = mock(TmdbService.class);
  private final ViewerPreferences viewerPreferences = mock(ViewerPreferences.class);
  private final TmdbController controller = new TmdbController(tmdbService, viewerPreferences);

  @Test
  void getPerson_usesAuthenticatedUsersAdultContentPreference() {
    UUID userId = UUID.randomUUID();
    when(viewerPreferences.allowsAdultContent(userId)).thenReturn(false);

    controller.getPerson(userId, 6384L);

    verify(tmdbService).getPerson(6384L, false);
  }
}
