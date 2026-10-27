package com.shelfy.api.versus;

import com.shelfy.api.versus.dto.ResolveVersusClipRequestDto;
import com.shelfy.api.versus.dto.VersusEntryResponseDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/versus/clips")
@RequiredArgsConstructor
public class VersusClipController {
  private final VersusPoolService poolService;
  private final ClipResolver clipResolver;

  @PostMapping("/resolve")
  public VersusEntryResponseDto resolve(@Valid @RequestBody ResolveVersusClipRequestDto request) {
    return poolService.previewClip(request.url());
  }

  @GetMapping("/thumbnail")
  public ResponseEntity<byte[]> getThumbnail(@RequestParam("src") String src) {
    return clipResolver.fetchThumbnail(src);
  }
}
