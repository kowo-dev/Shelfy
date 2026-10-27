package com.shelfy.api.collection;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.shelfy.api.collection.EpisodeProgressService.Season;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class EpisodeProgressServiceTest {

  private static final List<Season> SHOW =
      List.of(new Season(0, 2, true), new Season(1, 2, true), new Season(2, 2, true));

  @Test
  void completedWhenAllAiredEpisodesWatchedIgnoringSpecials() {
    assertTrue(EpisodeProgressService.isCompleted(SHOW, Map.of(1, Set.of(1, 2), 2, Set.of(1, 2))));
  }

  @Test
  void notCompletedWhenOneEpisodeMissing() {
    assertFalse(EpisodeProgressService.isCompleted(SHOW, Map.of(1, Set.of(1, 2), 2, Set.of(1))));
  }

  @Test
  void notCompletedWhileASeasonIsStillAiringOrUnknown() {
    List<Season> airing = List.of(new Season(1, 2, true), new Season(2, 8, false));
    assertFalse(EpisodeProgressService.isCompleted(airing, Map.of(1, Set.of(1, 2))));
    assertFalse(EpisodeProgressService.isCompleted(List.of(), Map.of(1, Set.of(1))));
  }
}
