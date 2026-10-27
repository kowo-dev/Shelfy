package com.shelfy.api.igdb;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.shelfy.api.auth.ViewerPreferences;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class IgdbControllerTest {

  private final IgdbService igdbService = mock(IgdbService.class);
  private final ViewerPreferences viewerPreferences = mock(ViewerPreferences.class);
  private final IgdbController controller = new IgdbController(igdbService, viewerPreferences);

  @Test
  void getCompanyGames_usesAuthenticatedUsersAdultContentPreference() {
    UUID userId = UUID.randomUUID();
    when(viewerPreferences.allowsAdultContent(userId)).thenReturn(true);

    controller.getCompanyGames(userId, 70L, 0);

    verify(igdbService).getCompanyGames(70L, true, 0);
  }
}
