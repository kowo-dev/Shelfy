package com.shelfy.api.collection;

import com.shelfy.api.activity.ActivityType;
import com.shelfy.api.activity.UserActivityService;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.dto.AddToCollectionRequestDto;
import com.shelfy.api.collection.dto.BothLovedItemDto;
import com.shelfy.api.collection.dto.BulkUpdateCollectionItemRequestDto;
import com.shelfy.api.collection.dto.CollectionFilter;
import com.shelfy.api.collection.dto.CollectionItemResponseDto;
import com.shelfy.api.collection.dto.CollectionStatsResponseDto;
import com.shelfy.api.collection.dto.CommonCollectionItemResponseDto;
import com.shelfy.api.collection.dto.EpisodeSummaryDto;
import com.shelfy.api.collection.dto.MediaReferenceDto;
import com.shelfy.api.collection.dto.MediaResponseDto;
import com.shelfy.api.collection.dto.PublicCollectionItemResponseDto;
import com.shelfy.api.collection.dto.ShelfCompareResponseDto;
import com.shelfy.api.collection.dto.UpdateCollectionItemRequestDto;
import com.shelfy.api.common.Paging;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class CollectionService {
  private static final int BOTH_LOVED_MIN_RATING = 8;
  private static final int BOTH_LOVED_LIMIT = 4;

  static final String EPISODE_TOTAL = "episodeTotal";

  private final MediaRepository mediaRepository;
  private final UserMediaRepository userMediaRepository;
  private final ViewerPreferences viewerPreferences;
  private final MediaResolver mediaResolver;
  private final CanonicalWorkService canonicalWorkService;
  private final UserActivityService userActivityService;
  private final UserMediaEpisodeRepository episodeRepository;
  private final EpisodeTotalBackfill episodeTotalBackfill;
  private final EpisodeProgressService episodeProgressService;
  private final WatchLogService watchLogService;
  private final RichTextContentValidator richTextContentValidator;
  private final ObjectMapper objectMapper;
  private final TransactionTemplate transactionTemplate;

  private record ItemSnapshot(UserMediaStatus status, Integer rating, Map<String, Object> note) {
    static ItemSnapshot of(UserMediaEntity item) {
      return new ItemSnapshot(item.getStatus(), item.getRating(), item.getNote());
    }
  }

  private void recordChanges(UserMediaEntity item, ItemSnapshot before) {
    if (item.getStatus() != before.status()) {
      userActivityService.record(
          item, ActivityType.STATUS_CHANGED, Map.of("status", item.getStatus().getValue()));
    }
    if (!Objects.equals(before.rating(), item.getRating())) {
      userActivityService.record(
          item,
          ActivityType.RATED,
          Map.of(
              "rating",
              item.getRating() == null ? "" : item.getRating(),
              "previous",
              before.rating() == null ? "" : before.rating()));
    }
    if (noteChanged(before.note(), item.getNote())) {
      userActivityService.record(
          item,
          ActivityType.REVIEWED,
          Map.of("action", before.note() == null ? "added" : "updated"));
    }
  }

  private boolean noteChanged(Map<String, Object> before, Map<String, Object> after) {
    return !Objects.equals(objectMapper.valueToTree(before), objectMapper.valueToTree(after));
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<CollectionItemResponseDto> getCollection(
      UUID userId, CollectionFilter filter, Pageable pageable) {
    Page<UserMediaEntity> page = findCollectionPage(userId, filter, userId, pageable);
    Map<UUID, EpisodeSummaryDto> summaries =
        episodeSummaries(page.getContent().stream().map(UserMediaEntity::getId).toList());
    page.getContent().stream()
        .filter(item -> summaries.containsKey(item.getId()))
        .map(UserMediaEntity::getMedia)
        .filter(media -> !(media.getMetadata().get(EPISODE_TOTAL) instanceof Number))
        .forEach(media -> episodeTotalBackfill.fill(media.getId()));
    return PagedResponseDto.from(
        page.map(item -> toCollectionItemResponse(item, summaries.get(item.getId()))));
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<PublicCollectionItemResponseDto> getPublicCollection(
      UUID userId, CollectionFilter filter, UUID viewerId, Pageable pageable) {
    return PagedResponseDto.from(
        findCollectionPage(userId, filter, viewerId, pageable)
            .map(this::toPublicCollectionItemResponse));
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<CommonCollectionItemResponseDto> getCommonCollection(
      UUID targetId, UUID callerId, CollectionFilter filter, Pageable pageable) {
    Page<UserMediaEntity> page =
        userMediaRepository.findCommonByUserIdAndFilters(
            callerId,
            targetId,
            filter.statusesOrNull(),
            filter.mediaTypesOrNull(),
            filter.includesUnrated(),
            filter.minRating(),
            filter.maxRating(),
            filter.search(),
            viewerPreferences.allowsAdultContent(callerId),
            filter.onlyWithNote(),
            pageable);
    List<UUID> workIds =
        page.getContent().stream().map(item -> item.getMedia().getCanonicalWork().getId()).toList();
    Map<UUID, UserMediaEntity> mineByWork = new HashMap<>();
    if (!workIds.isEmpty()) {
      userMediaRepository
          .findByUserIdAndCanonicalWorkIdIn(callerId, workIds)
          .forEach(
              mine -> mineByWork.putIfAbsent(mine.getMedia().getCanonicalWork().getId(), mine));
    }
    Map<UUID, EpisodeSummaryDto> summaries =
        episodeSummaries(mineByWork.values().stream().map(UserMediaEntity::getId).toList());
    return PagedResponseDto.from(
        page.map(
            theirs -> {
              UserMediaEntity mine = mineByWork.get(theirs.getMedia().getCanonicalWork().getId());
              return new CommonCollectionItemResponseDto(
                  toPublicCollectionItemResponse(theirs),
                  toCollectionItemResponse(mine, summaries.get(mine.getId())));
            }));
  }

  @Transactional(readOnly = true)
  public ShelfCompareResponseDto compareShelves(UUID targetId, UUID callerId) {
    boolean adultContentAllowed = viewerPreferences.allowsAdultContent(callerId);
    long common = userMediaRepository.countCommon(callerId, targetId, adultContentAllowed);
    if (common == 0) {
      return new ShelfCompareResponseDto(0, null, List.of());
    }
    Double gap = userMediaRepository.averageRatingGap(callerId, targetId, adultContentAllowed);
    List<BothLovedItemDto> loved = new ArrayList<>();
    Set<UUID> seenWorks = new HashSet<>();
    for (Object[] row :
        userMediaRepository.findBothLoved(
            callerId,
            targetId,
            adultContentAllowed,
            BOTH_LOVED_MIN_RATING,
            PageRequest.of(0, 12))) {
      MediaEntity media = (MediaEntity) row[0];
      if (loved.size() < BOTH_LOVED_LIMIT && seenWorks.add(media.getCanonicalWork().getId())) {
        loved.add(new BothLovedItemDto(toMediaResponse(media), (Integer) row[1], (Integer) row[2]));
      }
    }
    return new ShelfCompareResponseDto(common, gap, loved);
  }

  private Page<UserMediaEntity> findCollectionPage(
      UUID userId, CollectionFilter filter, UUID viewerId, Pageable pageable) {
    return userMediaRepository.findByUserIdAndFilters(
        userId,
        filter.statusesOrNull(),
        filter.mediaTypesOrNull(),
        filter.includesUnrated(),
        filter.minRating(),
        filter.maxRating(),
        filter.search(),
        viewerPreferences.allowsAdultContent(viewerId),
        filter.onlyWithNote(),
        pageable);
  }

  @Transactional(readOnly = true)
  public CollectionStatsResponseDto getStatsByMediaType(UUID userId) {
    Map<String, Long> countsByMediaType = new HashMap<>();
    Map<String, Long> countsByStatus = new HashMap<>();
    Map<String, Map<String, Long>> countsByMediaTypeAndStatus = new HashMap<>();
    for (UserMediaRepository.MediaTypeStatusCount count :
        userMediaRepository.countByUserIdGroupByMediaTypeAndStatus(userId)) {
      String mediaType = count.getMediaType().getValue();
      String status = count.getStatus().getValue();
      countsByMediaType.merge(mediaType, count.getCount(), Long::sum);
      countsByStatus.merge(status, count.getCount(), Long::sum);
      countsByMediaTypeAndStatus
          .computeIfAbsent(mediaType, key -> new HashMap<>())
          .put(status, count.getCount());
    }
    long total = countsByMediaType.values().stream().mapToLong(Long::longValue).sum();
    Double averageRating = userMediaRepository.findAverageRating(userId);
    return new CollectionStatsResponseDto(
        countsByMediaType, total, countsByStatus, countsByMediaTypeAndStatus, averageRating);
  }

  @Transactional(readOnly = true)
  public CollectionItemResponseDto getItem(UUID userId, UUID itemId) {
    return withEpisodeSummary(getOwnedItem(userId, itemId));
  }

  @Transactional(readOnly = true)
  public Optional<CollectionItemResponseDto> findByExternalReference(
      UUID userId, String provider, MediaType mediaType, String externalId) {
    return mediaRepository
        .findByExternalIdAndProviderAndMediaType(externalId, provider, mediaType)
        .flatMap(media -> userMediaRepository.findByUserIdAndMediaId(userId, media.getId()))
        .map(this::toCollectionItemResponse);
  }

  @Transactional(readOnly = true)
  public Map<String, CollectionItemResponseDto> findByExternalReferences(
      UUID userId, List<MediaReferenceDto> references) {
    Map<ProviderAndMediaType, List<String>> externalIdsByGroup =
        references.stream()
            .collect(
                Collectors.groupingBy(
                    ref -> new ProviderAndMediaType(ref.provider(), ref.mediaType()),
                    Collectors.mapping(MediaReferenceDto::externalId, Collectors.toList())));

    List<MediaEntity> mediaList = new ArrayList<>();
    for (Map.Entry<ProviderAndMediaType, List<String>> entry : externalIdsByGroup.entrySet()) {
      mediaList.addAll(
          mediaRepository.findByProviderAndMediaTypeAndExternalIdIn(
              entry.getKey().provider(), entry.getKey().mediaType(), entry.getValue()));
    }
    if (mediaList.isEmpty()) {
      return Map.of();
    }

    List<UUID> mediaIds = mediaList.stream().map(MediaEntity::getId).toList();
    List<UserMediaEntity> userMediaList =
        userMediaRepository.findByUserIdAndMediaIdIn(userId, mediaIds);

    Map<String, CollectionItemResponseDto> result = new HashMap<>();
    for (UserMediaEntity item : userMediaList) {
      result.put(referenceKey(item.getMedia()), toCollectionItemResponse(item));
    }
    return result;
  }

  private String referenceKey(MediaEntity media) {
    return media.getProvider()
        + ":"
        + media.getMediaType().getValue()
        + ":"
        + media.getExternalId();
  }

  public CollectionItemResponseDto addItem(UUID userId, AddToCollectionRequestDto request) {
    MediaEntity media =
        mediaResolver.findOrCreate(request.externalId(), request.provider(), request.mediaType());
    return transactionTemplate.execute(status -> insertItem(userId, media, request));
  }

  private CollectionItemResponseDto insertItem(
      UUID userId, MediaEntity media, AddToCollectionRequestDto request) {
    if (userMediaRepository.existsByUserIdAndMediaId(userId, media.getId())) {
      throw new ConflictException(
          ErrorCode.MEDIA_ALREADY_IN_COLLECTION, "Media already in collection");
    }
    UserMediaEntity item =
        new UserMediaEntity(
            userId, media, request.status(), request.rating(), defaultMap(request.progress()));
    UserMediaEntity saved = userMediaRepository.saveAndFlush(item);
    userActivityService.record(saved, ActivityType.ADDED, Map.of());
    if (saved.getStatus() == UserMediaStatus.DONE) {
      episodeProgressService.fillOnCompletion(saved);
      watchLogService.logCompletion(saved, request.completedOn());
      return withEpisodeSummary(saved);
    }
    return toCollectionItemResponse(saved);
  }

  @Transactional
  public CollectionItemResponseDto updateItem(
      UUID userId, UUID itemId, UpdateCollectionItemRequestDto request) {
    UserMediaEntity item = getOwnedItem(userId, itemId);
    ItemSnapshot before = ItemSnapshot.of(item);
    applyStatusAndRating(item, request.status(), request.rating(), request.clearRating());
    if (request.progress() != null) {
      item.setProgress(request.progress());
    }
    if (Boolean.TRUE.equals(request.clearNote())) {
      item.setNote(null);
      item.setReviewedAt(null);
    } else if (request.note() != null) {
      richTextContentValidator.validate(request.note());
      item.setNote(request.note());
      if (item.getReviewedAt() == null) {
        item.setReviewedAt(Instant.now());
      }
    }
    if (request.containsSpoilers() != null) {
      item.setContainsSpoilers(request.containsSpoilers());
    }

    UserMediaEntity saved = userMediaRepository.save(item);
    if (saved.getStatus() == UserMediaStatus.DONE && before.status() != UserMediaStatus.DONE) {
      episodeProgressService.fillOnCompletion(saved);
      watchLogService.logCompletion(saved, request.completedOn());
    }
    watchLogService.syncLatest(
        saved,
        !Objects.equals(before.rating(), saved.getRating()),
        noteChanged(before.note(), saved.getNote()) || request.containsSpoilers() != null);
    recordChanges(saved, before);
    return withEpisodeSummary(saved);
  }

  private void applyStatusAndRating(
      UserMediaEntity item, UserMediaStatus status, Integer rating, Boolean clearRating) {
    if (status != null) {
      item.setStatus(status);
    }
    if (Boolean.TRUE.equals(clearRating)) {
      item.setRating(null);
    } else if (rating != null) {
      item.setRating(rating);
    }
  }

  @Transactional
  public List<CollectionItemResponseDto> bulkUpdateItems(
      UUID userId, BulkUpdateCollectionItemRequestDto request) {
    List<UserMediaEntity> items = getOwnedItems(userId, request.ids());
    Map<UUID, ItemSnapshot> before = new HashMap<>();
    for (UserMediaEntity item : items) {
      before.put(item.getId(), ItemSnapshot.of(item));
      applyStatusAndRating(item, request.status(), request.rating(), request.clearRating());
    }
    List<UserMediaEntity> saved = userMediaRepository.saveAll(items);
    saved.forEach(
        item -> {
          ItemSnapshot snapshot = before.get(item.getId());
          watchLogService.syncLatest(
              item, !Objects.equals(snapshot.rating(), item.getRating()), false);
          recordChanges(item, snapshot);
        });
    return saved.stream().map(this::toCollectionItemResponse).toList();
  }

  @Transactional
  public void removeItem(UUID userId, UUID itemId) {
    UserMediaEntity item = getOwnedItem(userId, itemId);
    userActivityService.deleteForMedia(item.getId());
    userMediaRepository.delete(item);
  }

  @Transactional
  public void bulkRemoveItems(UUID userId, List<UUID> ids) {
    List<UserMediaEntity> items = getOwnedItems(userId, ids);
    userActivityService.deleteForMedia(items.stream().map(UserMediaEntity::getId).toList());
    userMediaRepository.deleteAll(items);
  }

  @Transactional
  public void clearCollection(UUID userId) {
    List<UUID> itemIds =
        userMediaRepository.findAllByUserId(userId).stream().map(UserMediaEntity::getId).toList();
    userActivityService.deleteForMedia(itemIds);
    userMediaRepository.deleteAllByUserId(userId);
  }

  private UserMediaEntity getOwnedItem(UUID userId, UUID itemId) {
    return userMediaRepository
        .findByIdAndUserId(itemId, userId)
        .orElseThrow(
            () ->
                new ResourceNotFoundException(
                    ErrorCode.COLLECTION_ITEM_NOT_FOUND, "Collection item not found"));
  }

  private List<UserMediaEntity> getOwnedItems(UUID userId, List<UUID> ids) {
    List<UserMediaEntity> items = userMediaRepository.findByIdInAndUserId(ids, userId);
    if (items.size() != ids.size()) {
      throw new ResourceNotFoundException(
          ErrorCode.COLLECTION_ITEM_NOT_FOUND, "Collection item not found");
    }
    return items;
  }

  @Transactional
  public MediaEntity findOrCreateMedia(
      String externalId,
      String provider,
      MediaType mediaType,
      String title,
      String coverUrl,
      Map<String, Object> metadata,
      boolean isAdult,
      Set<ExternalMediaReference> externalReferences) {
    return mediaRepository
        .findByExternalIdAndProviderAndMediaType(externalId, provider, mediaType)
        .orElseGet(
            () ->
                mediaRepository.save(
                    new MediaEntity(
                        externalId,
                        provider,
                        mediaType,
                        canonicalWorkService.resolve(
                            mediaType, references(provider, externalId, externalReferences)),
                        title,
                        coverUrl,
                        defaultMap(metadata),
                        isAdult)));
  }

  private Set<ExternalMediaReference> references(
      String provider, String externalId, Set<ExternalMediaReference> aliases) {
    Set<ExternalMediaReference> references = new LinkedHashSet<>(aliases);
    references.add(new ExternalMediaReference(provider, externalId));
    return references;
  }

  private Map<String, Object> defaultMap(Map<String, Object> map) {
    return map == null ? Map.of() : map;
  }

  @Transactional(readOnly = true)
  public List<CollectionItemResponseDto> getOngoingItems(UUID userId, int limit) {
    return userMediaRepository
        .findByUserIdAndStatusOrderByUpdatedAtDesc(
            userId, UserMediaStatus.ONGOING, Paging.of(0, limit))
        .stream()
        .map(this::toCollectionItemResponse)
        .toList();
  }

  private CollectionItemResponseDto withEpisodeSummary(UserMediaEntity item) {
    return toCollectionItemResponse(
        item, episodeSummaries(List.of(item.getId())).get(item.getId()));
  }

  private Map<UUID, EpisodeSummaryDto> episodeSummaries(List<UUID> itemIds) {
    if (itemIds.isEmpty()) {
      return Map.of();
    }
    return episodeRepository.summarize(itemIds).stream()
        .collect(
            Collectors.toMap(
                UserMediaEpisodeRepository.EpisodeSummaryRow::getUserMediaId,
                row ->
                    new EpisodeSummaryDto(
                        (int) row.getWatched(),
                        null,
                        row.getLastPosition() / UserMediaEpisodeRepository.POSITION_BASE,
                        row.getLastPosition() % UserMediaEpisodeRepository.POSITION_BASE)));
  }

  public CollectionItemResponseDto toCollectionItemResponse(UserMediaEntity item) {
    return toCollectionItemResponse(item, null);
  }

  private CollectionItemResponseDto toCollectionItemResponse(
      UserMediaEntity item, EpisodeSummaryDto episodeSummary) {
    return new CollectionItemResponseDto(
        item.getId(),
        item.getUserId(),
        toMediaResponse(item.getMedia()),
        item.getStatus(),
        item.getRating(),
        item.getNote(),
        item.isContainsSpoilers(),
        item.getProgress(),
        item.getCreatedAt(),
        item.getUpdatedAt(),
        episodeSummary == null
            ? null
            : episodeSummary.withTotal(
                item.getMedia().getMetadata().get(EPISODE_TOTAL) instanceof Number total
                    ? total.intValue()
                    : null));
  }

  private PublicCollectionItemResponseDto toPublicCollectionItemResponse(UserMediaEntity item) {
    return new PublicCollectionItemResponseDto(
        item.getId(),
        toMediaResponse(item.getMedia()),
        item.getStatus(),
        item.getRating(),
        item.getCreatedAt(),
        item.getUpdatedAt());
  }

  private MediaResponseDto toMediaResponse(MediaEntity media) {
    return MediaResponseDto.of(media);
  }
}
