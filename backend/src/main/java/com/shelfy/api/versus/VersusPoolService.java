package com.shelfy.api.versus;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaResolver;
import com.shelfy.api.collection.dto.MediaReferenceDto;
import com.shelfy.api.comments.CommentService;
import com.shelfy.api.comments.CommentTargetType;
import com.shelfy.api.common.ContributorDirectory;
import com.shelfy.api.common.IdCount;
import com.shelfy.api.common.dto.EditableCreationResponseDto;
import com.shelfy.api.common.dto.PagedResponseDto;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ConflictException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ForbiddenException;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.community.CommunityFilter;
import com.shelfy.api.federation.CollectionPublisher;
import com.shelfy.api.federation.InteractionPublisher;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import com.shelfy.api.people.VisibilityPolicy;
import com.shelfy.api.versus.dto.AddVersusClipRequestDto;
import com.shelfy.api.versus.dto.CreateVersusPoolRequestDto;
import com.shelfy.api.versus.dto.UpdateVersusClipRequestDto;
import com.shelfy.api.versus.dto.VersusEntryResponseDto;
import com.shelfy.api.versus.dto.VersusPoolResponseDto;
import com.shelfy.api.versus.dto.VersusPoolSourceDto;
import com.shelfy.api.versus.dto.VersusPoolSummaryResponseDto;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class VersusPoolService {
  private static final int MIN_PUBLISHED_ENTRIES = 4;
  private static final int COMMENT_PAGE_SIZE = 10;
  private static final int MAX_PROFILE_POOLS_PAGE_SIZE = 100;
  private static final UUID NIL_UUID = new UUID(0L, 0L);
  private final VersusPoolRepository repository;
  private final MediaResolver mediaResolver;
  private final TransactionTemplate transactionTemplate;
  private final VisibilityPolicy visibilityPolicy;
  private final UserRepository userRepository;
  private final AvatarStorageService avatarStorageService;
  private final VersusPoolLikeRepository likeRepository;
  private final CommentService commentService;
  private final ClipResolver clipResolver;
  private final VersusEntryMapper entryMapper;
  private final VersusSessionRepository sessionRepository;
  private final ViewerPreferences viewerPreferences;
  private final VersusPoolAccess poolAccess;
  private final VersusPoolCollaboratorService collaboratorService;
  private final VersusPoolCollaboratorRepository collaboratorRepository;
  private final NotificationService notificationService;
  private final ContributorDirectory contributors;
  private final CollectionPublisher collectionPublisher;
  private final InteractionPublisher interactionPublisher;

  @Transactional
  public VersusPoolResponseDto create(UUID userId, CreateVersusPoolRequestDto request) {
    VersusPoolEntity pool =
        new VersusPoolEntity(
            userId,
            request.name().trim(),
            blankToNull(request.description()),
            request.visibility());
    return toResponse(userId, published(repository.save(pool), userId));
  }

  @Transactional
  public VersusPoolResponseDto update(
      UUID userId, UUID poolId, CreateVersusPoolRequestDto request) {
    VersusPoolEntity pool = getOwned(userId, poolId);
    if (request.visibility() != CollectionVisibility.PRIVATE
        && pool.getItems().size() < MIN_PUBLISHED_ENTRIES) {
      throw new BadRequestException(
          ErrorCode.VERSUS_POOL_TOO_SMALL,
          "A versus needs at least " + MIN_PUBLISHED_ENTRIES + " contenders to be published");
    }
    pool.update(request.name().trim(), blankToNull(request.description()), request.visibility());
    return toResponse(userId, published(repository.save(pool), userId));
  }

  @Transactional(readOnly = true)
  public VersusPoolResponseDto get(UUID viewerId, UUID poolId) {
    VersusPoolEntity pool = getVisible(viewerId, poolId);
    return toResponse(viewerId, pool);
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<VersusPoolSummaryResponseDto> listForProfile(
      UUID viewerId, String username, int page, int size, String query) {
    UserEntity owner =
        userRepository
            .findByUsernameIgnoreCase(username)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
    if (!visibilityPolicy.canViewProfile(viewerId, owner)) {
      throw new ForbiddenException(ErrorCode.PROFILE_PRIVATE, "This profile is private");
    }
    int boundedSize = Math.clamp(size, 1, MAX_PROFILE_POOLS_PAGE_SIZE);
    int boundedPage = Math.max(page, 0);
    var pools =
        repository.findVisibleByOwner(
            owner.getId(),
            viewerId == null ? NIL_UUID : viewerId,
            CommunityFilter.likePattern(query),
            PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "updatedAt")));
    return new PagedResponseDto<>(
        toSummaries(pools.getContent(), Map.of(owner.getId(), owner), viewerId),
        boundedPage,
        boundedSize,
        pools.getTotalElements());
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<VersusPoolSummaryResponseDto> browse(
      UUID viewerId, CommunityFilter filter, Pageable pageable) {
    var page = repository.browse(viewerId, filter, pageable);
    Map<UUID, UserEntity> ownersById =
        userRepository
            .findAllById(
                page.getContent().stream().map(VersusPoolEntity::getUserId).distinct().toList())
            .stream()
            .collect(Collectors.toMap(UserEntity::getId, owner -> owner));
    return new PagedResponseDto<>(
        toSummaries(page.getContent(), ownersById, viewerId),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements());
  }

  public VersusPoolResponseDto addItem(UUID userId, UUID poolId, MediaReferenceDto reference) {
    requireEditable(userId, poolId);
    MediaEntity media = resolve(reference);
    return transactionTemplate.execute(
        status -> {
          VersusPoolEntity pool = getEditable(userId, poolId);
          if (pool.containsMedia(media.getId())) {
            throw new ConflictException(
                ErrorCode.VERSUS_ITEM_ALREADY_EXISTS, "This media is already in the pool");
          }
          pool.appendItem(media, userId);
          return toResponse(userId, published(repository.save(pool), userId));
        });
  }

  public VersusPoolResponseDto addItems(UUID userId, UUID poolId, List<MediaReferenceDto> items) {
    requireEditable(userId, poolId);
    List<MediaEntity> media = mediaResolver.findOrCreateAll(items);
    return transactionTemplate.execute(
        status -> {
          VersusPoolEntity pool = getEditable(userId, poolId);
          for (MediaEntity entry : media) {
            if (!pool.containsMedia(entry.getId())) {
              pool.appendItem(entry, userId);
            }
          }
          return toResponse(userId, published(repository.save(pool), userId));
        });
  }

  public VersusEntryResponseDto previewClip(String url) {
    return entryMapper.preview(clipResolver.resolve(url));
  }

  public VersusPoolResponseDto addClip(UUID userId, UUID poolId, AddVersusClipRequestDto request) {
    requireEditable(userId, poolId);
    ClipInfo clip = clipResolver.resolve(request.url());
    MediaEntity linkedMedia = resolve(request.linkedMedia());
    return transactionTemplate.execute(
        status -> {
          VersusPoolEntity pool = getEditable(userId, poolId);
          if (pool.containsClip(clip)) {
            throw new ConflictException(
                ErrorCode.VERSUS_ITEM_ALREADY_EXISTS, "This clip is already in the pool");
          }
          Integer start =
              request.startSeconds() != null ? request.startSeconds() : clip.startSeconds();
          pool.appendClip(clip, start, linkedMedia, userId);
          return toResponse(userId, published(repository.save(pool), userId));
        });
  }

  public VersusPoolResponseDto updateClip(
      UUID userId, UUID poolId, UUID entryId, UpdateVersusClipRequestDto request) {
    requireEditable(userId, poolId);
    MediaEntity linkedMedia = resolve(request.linkedMedia());
    return transactionTemplate.execute(
        status -> {
          VersusPoolEntity pool = getEditable(userId, poolId);
          VersusPoolItemEntity entry =
              pool.getItems().stream()
                  .filter(item -> item.getId().equals(entryId) && item.isClip())
                  .findFirst()
                  .orElseThrow(
                      () ->
                          new ResourceNotFoundException(
                              ErrorCode.VERSUS_ITEM_NOT_FOUND, "Clip not found"));
          entry.updateClip(request.startSeconds(), linkedMedia);
          return toResponse(userId, published(repository.save(pool), userId));
        });
  }

  private void requireEditable(UUID userId, UUID poolId) {
    transactionTemplate.executeWithoutResult(status -> getEditable(userId, poolId));
  }

  @Transactional
  public void delete(UUID userId, UUID poolId) {
    VersusPoolEntity pool = getOwned(userId, poolId);
    commentService.deleteAllForTarget(CommentTargetType.VERSUS_POOL, poolId);
    notificationService.deleteForTargets("VERSUS_POOL", List.of(poolId));
    collectionPublisher.poolDeleted(pool);
    repository.delete(pool);
  }

  private VersusPoolEntity published(VersusPoolEntity pool, UUID editorId) {
    collectionPublisher.poolChanged(pool, editorId);
    notificationService.create(
        pool.getUserId(),
        editorId,
        NotificationType.COLLABORATION_EDITED,
        "VERSUS_POOL",
        pool.getId(),
        Map.of());
    return pool;
  }

  @Transactional
  public VersusPoolResponseDto duplicate(UUID userId, UUID poolId, String name) {
    VersusPoolEntity source = getVisible(userId, poolId);
    String copyName = name == null || name.isBlank() ? source.getName() : name.trim();
    VersusPoolEntity copy =
        new VersusPoolEntity(
            userId, copyName, source.getDescription(), CollectionVisibility.PRIVATE);
    copy.copiedFrom(source.getId());
    source.getItems().stream()
        .sorted(Comparator.comparing(VersusPoolItemEntity::getAddedAt))
        .forEach(copy::appendCopyOf);
    return toResponse(userId, published(repository.save(copy), userId));
  }

  private MediaEntity resolve(MediaReferenceDto reference) {
    return reference == null
        ? null
        : mediaResolver.findOrCreate(
            reference.externalId(), reference.provider(), reference.mediaType());
  }

  @Transactional
  public VersusPoolResponseDto removeItem(UUID userId, UUID poolId, UUID entryId) {
    VersusPoolEntity pool = getEditable(userId, poolId);
    if (!pool.removeItem(entryId)) {
      throw new ResourceNotFoundException(ErrorCode.VERSUS_ITEM_NOT_FOUND, "Item not found");
    }
    sessionRepository.deleteByPoolIdAndStatus(poolId, VersusSessionStatus.IN_PROGRESS);
    return toResponse(userId, published(repository.save(pool), userId));
  }

  @Transactional
  public VersusPoolResponseDto removeItems(UUID userId, UUID poolId, List<UUID> entryIds) {
    VersusPoolEntity pool = getEditable(userId, poolId);
    if (pool.removeItems(entryIds) > 0) {
      sessionRepository.deleteByPoolIdAndStatus(poolId, VersusSessionStatus.IN_PROGRESS);
    }
    return toResponse(userId, published(repository.save(pool), userId));
  }

  @Transactional
  public VersusPoolResponseDto like(UUID userId, UUID poolId) {
    VersusPoolEntity pool = getVisible(userId, poolId);
    if (pool.getUserId().equals(userId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot like your own pool");
    }
    if (!likeRepository.existsByPoolIdAndUserId(poolId, userId)) {
      likeRepository.save(new VersusPoolLikeEntity(pool, userId));
      interactionPublisher.collectionLiked(
          userId, CommentTargetType.VERSUS_POOL, pool.getId(), pool.getUserId(), true);
      notificationService.create(
          pool.getUserId(),
          userId,
          NotificationType.CREATION_LIKED,
          "VERSUS_POOL",
          poolId,
          Map.of());
    }
    return toResponse(userId, pool);
  }

  @Transactional
  public VersusPoolResponseDto unlike(UUID userId, UUID poolId) {
    VersusPoolEntity pool = getVisible(userId, poolId);
    if (pool.getUserId().equals(userId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot unlike your own pool");
    }
    if (likeRepository.existsByPoolIdAndUserId(poolId, userId)) {
      likeRepository.deleteByPoolIdAndUserId(poolId, userId);
      interactionPublisher.collectionLiked(
          userId, CommentTargetType.VERSUS_POOL, pool.getId(), pool.getUserId(), false);
      notificationService.retract(
          pool.getUserId(), userId, NotificationType.CREATION_LIKED, "VERSUS_POOL", poolId);
    }
    return toResponse(userId, pool);
  }

  VersusPoolEntity findVisibleEntity(UUID viewerId, UUID poolId) {
    return getVisible(viewerId, poolId);
  }

  private VersusPoolEntity getVisible(UUID viewerId, UUID poolId) {
    VersusPoolEntity pool =
        repository
            .findById(poolId)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.VERSUS_POOL_NOT_FOUND, "Pool not found"));
    if (!canView(viewerId, pool)) {
      throw new ResourceNotFoundException(ErrorCode.VERSUS_POOL_NOT_FOUND, "Pool not found");
    }
    return pool;
  }

  private VersusPoolEntity getOwned(UUID userId, UUID poolId) {
    VersusPoolEntity pool =
        repository
            .findById(poolId)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.VERSUS_POOL_NOT_FOUND, "Pool not found"));
    if (!pool.getUserId().equals(userId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot edit this pool");
    }
    pool.getItems().size();
    return pool;
  }

  boolean canView(UUID viewer, VersusPoolEntity pool) {
    return poolAccess.canView(viewer, pool);
  }

  private static final int MAX_EDITABLE = 100;

  @Transactional(readOnly = true)
  public List<EditableCreationResponseDto> listEditable(UUID userId, MediaReferenceDto reference) {
    if (userId == null) {
      return List.of();
    }
    UUID mediaId =
        reference == null
            ? null
            : mediaResolver
                .findExisting(reference.provider(), reference.mediaType(), reference.externalId())
                .map(MediaEntity::getId)
                .orElse(null);
    boolean adultContentAllowed = allowsAdultContent(userId);
    return repository.findEditableBy(userId, PageRequest.of(0, MAX_EDITABLE)).stream()
        .map(
            pool ->
                new EditableCreationResponseDto(
                    pool.getId(),
                    pool.getName(),
                    pool.getVisibility(),
                    pool.getItems().size(),
                    pool.getItems().stream()
                        .map(
                            item ->
                                entryMapper
                                    .toDto(item)
                                    .maskedIfAdult(adultContentAllowed)
                                    .coverUrl())
                        .filter(Objects::nonNull)
                        .limit(4)
                        .toList(),
                    pool.getUserId().equals(userId),
                    pool.getItems().stream().anyMatch(VersusPoolItemEntity::isClip),
                    pool.getItems().stream()
                        .filter(
                            item ->
                                mediaId != null
                                    && !item.isClip()
                                    && item.getMedia().getId().equals(mediaId))
                        .map(VersusPoolItemEntity::getId)
                        .findFirst()
                        .orElse(null)))
        .toList();
  }

  private VersusPoolEntity getEditable(UUID userId, UUID poolId) {
    VersusPoolEntity pool =
        repository
            .findById(poolId)
            .orElseThrow(
                () ->
                    new ResourceNotFoundException(
                        ErrorCode.VERSUS_POOL_NOT_FOUND, "Pool not found"));
    if (!poolAccess.canEditItems(userId, pool)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot edit this pool");
    }
    pool.getItems().size();
    return pool;
  }

  private VersusPoolSourceDto source(UUID viewerId, VersusPoolEntity pool) {
    if (pool.getSourcePoolId() == null) {
      return null;
    }
    return repository
        .findById(pool.getSourcePoolId())
        .filter(source -> canView(viewerId, source))
        .map(
            source ->
                new VersusPoolSourceDto(
                    source.getId(),
                    source.getName(),
                    userRepository
                        .findById(source.getUserId())
                        .map(UserEntity::getUsername)
                        .orElse(null)))
        .orElse(null);
  }

  boolean allowsAdultContent(UUID viewer) {
    return viewerPreferences.allowsAdultContent(viewer);
  }

  private VersusPoolResponseDto toResponse(UUID viewerId, VersusPoolEntity pool) {
    UserEntity owner = userRepository.findById(pool.getUserId()).orElse(null);
    boolean adultContentAllowed = allowsAdultContent(viewerId);
    var authors =
        contributors.resolve(
            pool.getItems().stream().map(VersusPoolItemEntity::getAddedBy).toList());
    return new VersusPoolResponseDto(
        pool.getId(),
        pool.getUserId(),
        pool.getName(),
        pool.getDescription(),
        pool.getVisibility(),
        pool.getItems().stream()
            .map(
                item ->
                    entryMapper
                        .toDto(item)
                        .withAddedBy(authors.get(item.getAddedBy()))
                        .maskedIfAdult(adultContentAllowed))
            .toList(),
        poolAccess.canEditItems(viewerId, pool),
        pool.getUserId().equals(viewerId),
        likeRepository.existsByPoolIdAndUserId(pool.getId(), viewerId),
        likeRepository.countByPoolId(pool.getId()),
        commentService.listTopByRelevance(
            CommentTargetType.VERSUS_POOL, pool.getId(), viewerId, COMMENT_PAGE_SIZE),
        commentService.count(CommentTargetType.VERSUS_POOL, pool.getId()),
        owner == null ? null : owner.getUsername(),
        owner == null ? null : avatarStorageService.urlFor(owner.getAvatarFilename()),
        collaboratorService.listCollaborators(pool.getId()),
        pool.getUserId().equals(viewerId)
            ? collaboratorService.listPendingInvites(pool.getId())
            : List.of(),
        viewerId == null
            ? null
            : collaboratorRepository
                .findByPoolIdAndUserId(pool.getId(), viewerId)
                .map(VersusPoolCollaboratorEntity::getStatus)
                .orElse(null),
        source(viewerId, pool),
        pool.getCreatedAt(),
        pool.getUpdatedAt());
  }

  private List<VersusPoolSummaryResponseDto> toSummaries(
      List<VersusPoolEntity> pools, Map<UUID, UserEntity> owners, UUID viewerId) {
    List<UUID> ids = pools.stream().map(VersusPoolEntity::getId).toList();
    Map<UUID, Long> likes =
        ids.isEmpty() ? Map.of() : IdCount.toMap(likeRepository.countByPoolIds(ids));
    Map<UUID, Long> comments = commentService.count(CommentTargetType.VERSUS_POOL, ids);
    boolean adultContentAllowed = allowsAdultContent(viewerId);
    return pools.stream()
        .map(
            pool ->
                toSummary(
                    pool,
                    owners.get(pool.getUserId()),
                    likes.getOrDefault(pool.getId(), 0L),
                    comments.getOrDefault(pool.getId(), 0L),
                    adultContentAllowed))
        .toList();
  }

  private VersusPoolSummaryResponseDto toSummary(
      VersusPoolEntity pool,
      UserEntity owner,
      long likeCount,
      long commentCount,
      boolean adultContentAllowed) {
    return new VersusPoolSummaryResponseDto(
        pool.getId(),
        pool.getUserId(),
        pool.getName(),
        pool.getDescription(),
        pool.getVisibility(),
        pool.getItems().size(),
        pool.getItems().stream()
            .sorted(Comparator.comparing(VersusPoolItemEntity::getAddedAt))
            .limit(4)
            .map(item -> entryMapper.toDto(item).maskedIfAdult(adultContentAllowed))
            .toList(),
        likeCount,
        commentCount,
        owner == null ? null : owner.getUsername(),
        owner == null ? null : avatarStorageService.urlFor(owner.getAvatarFilename()),
        pool.getCreatedAt(),
        pool.getUpdatedAt());
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
