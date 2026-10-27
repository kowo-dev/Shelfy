package com.shelfy.api.anilist;

import com.shelfy.api.anilist.dto.AnimeDetailResponseDto;
import com.shelfy.api.anilist.dto.BrowseMediaResponseDto;
import com.shelfy.api.anilist.dto.MangaDetailResponseDto;
import com.shelfy.api.anilist.dto.PersonDetailResponseDto;
import com.shelfy.api.anilist.dto.StudioDetailResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/anilist")
@RequiredArgsConstructor
public class AniListController {

  private final AniListService aniListService;

  @GetMapping("/anime/{id}")
  public AnimeDetailResponseDto getAnime(@PathVariable long id) {
    return aniListService.getAnime(id);
  }

  @GetMapping("/manga/{id}")
  public MangaDetailResponseDto getManga(@PathVariable long id) {
    return aniListService.getManga(id);
  }

  @GetMapping("/staff/{id}")
  public PersonDetailResponseDto getStaff(@PathVariable long id) {
    return aniListService.getStaff(id);
  }

  @GetMapping("/characters/{id}")
  public PersonDetailResponseDto getCharacter(@PathVariable long id) {
    return aniListService.getCharacter(id);
  }

  @GetMapping("/studios/{id}")
  public StudioDetailResponseDto getStudio(@PathVariable long id) {
    return aniListService.getStudio(id);
  }

  @GetMapping("/media/by-genre")
  public BrowseMediaResponseDto browseByGenre(
      @RequestParam String mediaType,
      @RequestParam String genre,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(required = false) String countryOfOrigin) {
    return aniListService.browseMedia(mediaType, genre, null, page, countryOfOrigin);
  }

  @GetMapping("/media/by-tag")
  public BrowseMediaResponseDto browseByTag(
      @RequestParam String mediaType,
      @RequestParam String tag,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(required = false) String countryOfOrigin) {
    return aniListService.browseMedia(mediaType, null, tag, page, countryOfOrigin);
  }
}
