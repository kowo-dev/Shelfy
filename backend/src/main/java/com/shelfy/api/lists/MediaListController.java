package com.shelfy.api.lists;

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
import com.shelfy.api.lists.dto.AddMediaListItemsRequestDto;
import com.shelfy.api.lists.dto.CreateMediaListRequestDto;
import com.shelfy.api.lists.dto.DuplicateMediaListRequestDto;
import com.shelfy.api.lists.dto.MediaListItemIdsRequestDto;
import com.shelfy.api.lists.dto.MediaListResponseDto;
import com.shelfy.api.lists.dto.MediaListSummaryResponseDto;
import com.shelfy.api.lists.dto.UpdateMediaListDetailsRequestDto;
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
@RequestMapping("/api/v1/lists")
public class MediaListController extends CommentEndpoints {
  private final MediaListService service;

  public MediaListController(MediaListService service, CommentService commentService) {
    super(commentService, CommentTargetType.LIST);
    this.service = service;
  }

  @PostMapping
  public ResponseEntity<MediaListResponseDto> create(
      @AuthenticationPrincipal UUID userId, @Valid @RequestBody CreateMediaListRequestDto request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, request));
  }

  @PutMapping("/{listId}")
  public MediaListResponseDto update(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID listId,
      @Valid @RequestBody CreateMediaListRequestDto request) {
    return service.update(userId, listId, request);
  }

  @PatchMapping("/{listId}")
  public MediaListResponseDto updateDetails(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID listId,
      @Valid @RequestBody UpdateMediaListDetailsRequestDto request) {
    return service.updateDetails(userId, listId, request);
  }

  @GetMapping
  public PagedResponseDto<MediaListSummaryResponseDto> browse(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(required = false) String q,
      @RequestParam(defaultValue = "ALL") CommunityScope scope,
      @RequestParam(required = false) MediaType mediaType,
      @RequestParam(defaultValue = "RECENT") CommunitySort sort,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.browse(
        userId, new CommunityFilter(q, scope, mediaType, sort), Paging.of(page, size));
  }

  @GetMapping("/editable")
  public List<EditableCreationResponseDto> listEditable(
      @AuthenticationPrincipal UUID userId,
      @RequestParam(required = false) String provider,
      @RequestParam(required = false) MediaType mediaType,
      @RequestParam(required = false) String externalId) {
    return service.listEditable(userId, reference(provider, mediaType, externalId));
  }

  static MediaReferenceDto reference(String provider, MediaType mediaType, String externalId) {
    return provider == null || mediaType == null || externalId == null
        ? null
        : new MediaReferenceDto(provider, mediaType, externalId);
  }

  @GetMapping("/profile/{username}")
  public PagedResponseDto<MediaListResponseDto> listForProfile(
      @AuthenticationPrincipal UUID userId,
      @PathVariable String username,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size,
      @RequestParam(required = false) String q) {
    return service.listForProfile(userId, username, page, size, q);
  }

  @DeleteMapping("/{listId}")
  public ResponseEntity<Void> delete(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID listId) {
    service.delete(userId, listId);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{listId}/duplicate")
  public ResponseEntity<MediaListResponseDto> duplicate(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID listId,
      @Valid @RequestBody(required = false) DuplicateMediaListRequestDto request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(service.duplicate(userId, listId, request == null ? null : request.name()));
  }

  @GetMapping("/{listId}")
  public MediaListResponseDto get(@AuthenticationPrincipal UUID userId, @PathVariable UUID listId) {
    return service.get(userId, listId);
  }

  @PostMapping("/{listId}/items")
  public MediaListResponseDto addItem(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID listId,
      @Valid @RequestBody MediaReferenceDto request) {
    return service.addItem(userId, listId, request);
  }

  @PostMapping("/{listId}/items/batch")
  public MediaListResponseDto addItems(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID listId,
      @Valid @RequestBody AddMediaListItemsRequestDto request) {
    return service.addItems(userId, listId, request.media());
  }

  @PostMapping("/{listId}/items/remove")
  public MediaListResponseDto removeItems(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID listId,
      @Valid @RequestBody MediaListItemIdsRequestDto request) {
    return service.removeItems(userId, listId, request.mediaIds());
  }

  @PutMapping("/{listId}/items/order")
  public MediaListResponseDto reorder(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID listId,
      @Valid @RequestBody MediaListItemIdsRequestDto request) {
    return service.reorder(userId, listId, request.mediaIds());
  }

  @DeleteMapping("/{listId}/items/{mediaId}")
  public MediaListResponseDto removeItem(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID listId, @PathVariable UUID mediaId) {
    return service.removeItem(userId, listId, mediaId);
  }

  @PostMapping("/{listId}/likes")
  public MediaListResponseDto like(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID listId) {
    return service.like(userId, listId);
  }

  @DeleteMapping("/{listId}/likes")
  public MediaListResponseDto unlike(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID listId) {
    return service.unlike(userId, listId);
  }
}
