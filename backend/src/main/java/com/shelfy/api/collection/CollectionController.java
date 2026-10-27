package com.shelfy.api.collection;

import com.shelfy.api.collection.dto.AddToCollectionRequestDto;
import com.shelfy.api.collection.dto.BulkDeleteRequestDto;
import com.shelfy.api.collection.dto.BulkUpdateCollectionItemRequestDto;
import com.shelfy.api.collection.dto.CollectionFilter;
import com.shelfy.api.collection.dto.CollectionItemResponseDto;
import com.shelfy.api.collection.dto.CollectionStatsResponseDto;
import com.shelfy.api.collection.dto.LookupBatchRequestDto;
import com.shelfy.api.collection.dto.NextEpisodeResponseDto;
import com.shelfy.api.collection.dto.UpdateCollectionItemRequestDto;
import com.shelfy.api.common.Paging;
import com.shelfy.api.common.dto.PagedResponseDto;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/collection")
@RequiredArgsConstructor
public class CollectionController {

  private final CollectionService collectionService;
  private final NextEpisodeService nextEpisodeService;

  @GetMapping
  public ResponseEntity<PagedResponseDto<CollectionItemResponseDto>> getCollection(
      @AuthenticationPrincipal UUID userId,
      @ModelAttribute CollectionFilter filter,
      @RequestParam(required = false) String sortBy,
      @RequestParam(defaultValue = "desc") String sortDirection,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    Pageable pageable = Paging.of(page, size, CollectionSort.resolve(sortBy, sortDirection));
    return ResponseEntity.ok(collectionService.getCollection(userId, filter, pageable));
  }

  @GetMapping("/stats")
  public ResponseEntity<CollectionStatsResponseDto> getStats(@AuthenticationPrincipal UUID userId) {
    return ResponseEntity.ok(collectionService.getStatsByMediaType(userId));
  }

  @GetMapping("/next-episodes")
  public ResponseEntity<List<NextEpisodeResponseDto>> getNextEpisodes(
      @AuthenticationPrincipal UUID userId) {
    return ResponseEntity.ok(nextEpisodeService.getNextEpisodes(userId));
  }

  @GetMapping("/{id}")
  public ResponseEntity<CollectionItemResponseDto> getItem(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(collectionService.getItem(userId, id));
  }

  @GetMapping("/lookup")
  public ResponseEntity<CollectionItemResponseDto> lookup(
      @AuthenticationPrincipal UUID userId,
      @RequestParam String provider,
      @RequestParam MediaType mediaType,
      @RequestParam String externalId) {
    return ResponseEntity.ok(
        collectionService
            .findByExternalReference(userId, provider, mediaType, externalId)
            .orElse(null));
  }

  @PostMapping("/lookup-batch")
  public ResponseEntity<Map<String, CollectionItemResponseDto>> lookupBatch(
      @AuthenticationPrincipal UUID userId, @Valid @RequestBody LookupBatchRequestDto request) {
    return ResponseEntity.ok(
        collectionService.findByExternalReferences(userId, request.references()));
  }

  @PostMapping
  public ResponseEntity<CollectionItemResponseDto> addItem(
      @AuthenticationPrincipal UUID userId, @Valid @RequestBody AddToCollectionRequestDto request) {
    CollectionItemResponseDto response = collectionService.addItem(userId, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  @PutMapping("/{id}")
  public ResponseEntity<CollectionItemResponseDto> updateItem(
      @AuthenticationPrincipal UUID userId,
      @PathVariable UUID id,
      @Valid @RequestBody UpdateCollectionItemRequestDto request) {
    return ResponseEntity.ok(collectionService.updateItem(userId, id, request));
  }

  @PatchMapping("/bulk")
  public ResponseEntity<List<CollectionItemResponseDto>> bulkUpdateItems(
      @AuthenticationPrincipal UUID userId,
      @Valid @RequestBody BulkUpdateCollectionItemRequestDto request) {
    return ResponseEntity.ok(collectionService.bulkUpdateItems(userId, request));
  }

  @PostMapping("/bulk-delete")
  public ResponseEntity<Void> bulkDeleteItems(
      @AuthenticationPrincipal UUID userId, @Valid @RequestBody BulkDeleteRequestDto request) {
    collectionService.bulkRemoveItems(userId, request.ids());
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> removeItem(
      @AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
    collectionService.removeItem(userId, id);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping
  public ResponseEntity<Void> clearCollection(@AuthenticationPrincipal UUID userId) {
    collectionService.clearCollection(userId);
    return ResponseEntity.noContent().build();
  }
}
