package com.shelfy.api.versus;

import com.shelfy.api.collection.MediaType;
import com.shelfy.api.collection.dto.MediaReferenceDto;
import com.shelfy.api.comments.CommentEndpoints;
import com.shelfy.api.comments.CommentService;
import com.shelfy.api.comments.CommentTargetType;
import com.shelfy.api.common.Paging;
import com.shelfy.api.common.dto.EditableCreationResponseDto;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.community.CommunityScope;
import com.shelfy.api.community.CommunitySort;
import com.shelfy.api.versus.dto.AddVersusClipRequestDto;
import com.shelfy.api.versus.dto.AddVersusItemsRequestDto;
import com.shelfy.api.versus.dto.CreateVersusPoolRequestDto;
import com.shelfy.api.versus.dto.DuplicateVersusPoolRequestDto;
import com.shelfy.api.versus.dto.UpdateVersusClipRequestDto;
import com.shelfy.api.versus.dto.VersusEntryIdsRequestDto;
import com.shelfy.api.versus.dto.VersusPoolResponseDto;
import com.shelfy.api.versus.dto.VersusPoolResultsResponseDto;
import com.shelfy.api.versus.dto.VersusPoolSummaryResponseDto;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/versus/pools")
public class VersusPoolController extends CommentEndpoints {
  private final VersusPoolService poolService;
  private final VersusRankingService rankingService;

  public VersusPoolController(
      VersusPoolService poolService,
      VersusRankingService rankingService,
      CommentService commentService) {
    super(commentService, CommentTargetType.VERSUS_POOL);
    this.poolService = poolService;
    this.rankingService = rankingService;
  }

  @PostMapping
  public ResponseEntity<VersusPoolResponseDto> create(
      @AuthenticationPrincipal UUID userId,
      @Valid @RequestBody CreateVersusPoolRequestDto request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(poolService.create(userId, request));
  }

  @PutMapping("/{poolId}")
  public VersusPoolResponseDto update(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID poolId,
      @Valid @RequestBody CreateVersusPoolRequestDto request) {
    return poolService.update(userId, poolId, request);
  }

  @DeleteMapping("/{poolId}")
  public ResponseEntity<Void> delete(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID poolId) {
    poolService.delete(userId, poolId);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{poolId}/duplicate")
  public ResponseEntity<VersusPoolResponseDto> duplicate(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID poolId,
      @Valid @RequestBody(required = false) DuplicateVersusPoolRequestDto request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(poolService.duplicate(userId, poolId, request == null ? null : request.name()));
  }

  @GetMapping("/{poolId}")
  public VersusPoolResponseDto get(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID poolId) {
    return poolService.get(userId, poolId);
  }

  @GetMapping("/editable")
  public List<EditableCreationResponseDto> listEditable(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(required = false) String provider,
      @RequestParam(required = false) MediaType mediaType,
      @RequestParam(required = false) String externalId) {
    return poolService.listEditable(
        userId,
        provider == null || mediaType == null || externalId == null
            ? null
            : new MediaReferenceDto(provider, mediaType, externalId));
  }

  @GetMapping("/profile/{username}")
  public PagedResponseDto<VersusPoolSummaryResponseDto> listForProfile(
      @AuthenticationPrincipal UUID userId,
      @PathVariable String username,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size,
      @RequestParam(required = false) String q) {
    return poolService.listForProfile(userId, username, page, size, q);
  }

  @GetMapping
  public PagedResponseDto<VersusPoolSummaryResponseDto> browse(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "ALL") CommunityScope scope,
      @RequestParam(required = false) MediaType mediaType,
      @RequestParam(defaultValue = "RECENT") CommunitySort sort,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return poolService.browse(
        userId, new CommunityFilter(q, scope, mediaType, sort), Paging.of(page, size));
  }

  @PostMapping("/{poolId}/items")
  public VersusPoolResponseDto addItem(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID poolId,
      @Valid @RequestBody MediaReferenceDto request) {
    return poolService.addItem(userId, poolId, request);
  }

  @PostMapping("/{poolId}/items/batch")
  public VersusPoolResponseDto addItems(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID poolId,
      @Valid @RequestBody AddVersusItemsRequestDto request) {
    return poolService.addItems(userId, poolId, request.items());
  }

  @PostMapping("/{poolId}/clips")
  public VersusPoolResponseDto addClip(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID poolId,
      @Valid @RequestBody AddVersusClipRequestDto request) {
    return poolService.addClip(userId, poolId, request);
  }

  @PatchMapping("/{poolId}/items/{entryId}")
  public VersusPoolResponseDto updateClip(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID poolId,
      @PathVariable UUID entryId,
      @Valid @RequestBody UpdateVersusClipRequestDto request) {
    return poolService.updateClip(userId, poolId, entryId, request);
  }

  @PostMapping("/{poolId}/items/remove")
  public VersusPoolResponseDto removeItems(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID poolId,
      @Valid @RequestBody VersusEntryIdsRequestDto request) {
    return poolService.removeItems(userId, poolId, request.entryIds());
  }

  @DeleteMapping("/{poolId}/items/{entryId}")
  public VersusPoolResponseDto removeItem(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID poolId, @PathVariable UUID entryId) {
    return poolService.removeItem(userId, poolId, entryId);
  }

  @GetMapping("/{poolId}/results")
  public VersusPoolResultsResponseDto getResults(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID poolId) {
    poolService.get(userId, poolId);
    return rankingService.computeResults(poolId, poolService.allowsAdultContent(userId));
  }

  @PostMapping("/{poolId}/likes")
  public VersusPoolResponseDto like(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID poolId) {
    return poolService.like(userId, poolId);
  }

  @DeleteMapping("/{poolId}/likes")
  public VersusPoolResponseDto unlike(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID poolId) {
    return poolService.unlike(userId, poolId);
  }
}
