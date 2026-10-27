package com.shelfy.api.lists;

import com.shelfy.api.auth.AvatarStorageService;
import com.shelfy.api.auth.CollectionVisibility;
import com.shelfy.api.auth.UserEntity;
import com.shelfy.api.auth.UserRepository;
import com.shelfy.api.auth.ViewerPreferences;
import com.shelfy.api.collection.MediaEntity;
import com.shelfy.api.collection.MediaResolver;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.UserMediaStatus;
import com.shelfy.api.collection.dto.MediaReferenceDto;
import com.shelfy.api.collection.dto.MediaResponseDto;
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
import com.shelfy.api.lists.dto.CreateMediaListRequestDto;
import com.shelfy.api.lists.dto.ListCompletionResponseDto;
import com.shelfy.api.lists.dto.MediaListItemDto;
import com.shelfy.api.lists.dto.MediaListResponseDto;
import com.shelfy.api.lists.dto.MediaListSourceDto;
import com.shelfy.api.lists.dto.MediaListSummaryResponseDto;
import com.shelfy.api.lists.dto.UpdateMediaListDetailsRequestDto;
import com.shelfy.api.notifications.NotificationService;
import com.shelfy.api.notifications.NotificationType;
import com.shelfy.api.people.VisibilityPolicy;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class MediaListService {
  private static final UUID NIL_UUID = new UUID(0, 0);
  private static final int COMMENT_PAGE_SIZE = 10;
  private static final int MAX_PROFILE_LISTS_PAGE_SIZE = 100;
  private static final int MAX_ITEMS = 200;
  private static final int PREVIEW_SIZE = 4;
  private final MediaListRepository repository;
  private final MediaResolver mediaResolver;
  private final TransactionTemplate transactionTemplate;
  private final UserRepository userRepository;
  private final VisibilityPolicy visibilityPolicy;
  private final MediaListAccess listAccess;
  private final ViewerPreferences viewerPreferences;
  private final MediaListLikeRepository likeRepository;
  private final CommentService commentService;
  private final UserMediaRepository userMediaRepository;
  private final MediaListCollaboratorRepository collaboratorRepository;
  private final MediaListCollaboratorService collaboratorService;
  private final AvatarStorageService avatarStorageService;
  private final NotificationService notificationService;
  private final ContributorDirectory contributors;
  private final CollectionPublisher collectionPublisher;
  private final InteractionPublisher interactionPublisher;

  public MediaListResponseDto create(UUID userId, CreateMediaListRequestDto request) {
    validateReferences(request.media());
    List<MediaEntity> media = mediaResolver.findOrCreateAll(request.media());
    return transactionTemplate.execute(
        status -> {
          MediaListEntity list =
              new MediaListEntity(
                  userId,
                  request.name().trim(),
                  blankToNull(request.description()),
                  request.visibility(),
                  tags(request.tags()));
          addItems(list, media, Map.of(), userId);
          return toResponse(userId, published(repository.save(list), userId));
        });
  }

  public MediaListResponseDto update(UUID userId, UUID listId, CreateMediaListRequestDto request) {
    validateReferences(request.media());
    transactionTemplate.executeWithoutResult(status -> getOwned(userId, listId));
    List<MediaEntity> media = mediaResolver.findOrCreateAll(request.media());
    return transactionTemplate.execute(
        status -> {
          MediaListEntity list = getOwned(userId, listId);
          Map<UUID, UUID> authors = new HashMap<>();
          list.getItems()
              .forEach(
                  item -> {
                    if (item.getAddedBy() != null) {
                      authors.put(item.getMedia().getId(), item.getAddedBy());
                    }
                  });
          list.update(
              request.name().trim(),
              blankToNull(request.description()),
              request.visibility(),
              tags(request.tags()));
          repository.flush();
          addItems(list, media, authors, userId);
          return toResponse(userId, published(repository.save(list), userId));
        });
  }

  @Transactional
  public void delete(UUID userId, UUID listId) {
    MediaListEntity list = getOwned(userId, listId);
    commentService.deleteAllForTarget(CommentTargetType.LIST, listId);
    notificationService.deleteForTargets("LIST", List.of(listId));
    collectionPublisher.listDeleted(list);
    repository.delete(list);
  }

  private MediaListEntity published(MediaListEntity list, UUID editorId) {
    collectionPublisher.listChanged(list, editorId);
    notificationService.create(
        list.getUserId(),
        editorId,
        NotificationType.COLLABORATION_EDITED,
        "LIST",
        list.getId(),
        Map.of());
    return list;
  }

  @Transactional
  public MediaListResponseDto duplicate(UUID userId, UUID listId, String name) {
    MediaListEntity source = getVisible(userId, listId);
    String copyName = name == null || name.isBlank() ? source.getName() : name.trim();
    MediaListEntity copy =
        new MediaListEntity(
            userId,
            copyName,
            source.getDescription(),
            CollectionVisibility.PRIVATE,
            new LinkedHashSet<>(source.getTags()));
    copy.copiedFrom(source.getId());
    addItems(
        copy,
        source.getItems().stream()
            .sorted(Comparator.comparingInt(MediaListItemEntity::getPosition))
            .map(MediaListItemEntity::getMedia)
            .toList(),
        Map.of(),
        userId);
    return toResponse(userId, published(repository.save(copy), userId));
  }

  private MediaListEntity getOwned(UUID userId, UUID listId) {
    MediaListEntity list =
        repository
            .findById(listId)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.LIST_NOT_FOUND, "List not found"));
    if (!list.getUserId().equals(userId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot edit this list");
    }
    return list;
  }

  private void validateReferences(List<MediaReferenceDto> references) {
    if (references.stream()
            .map(
                r ->
                    new StringBuilder()
                        .append(r.provider())
                        .append(":")
                        .append(r.mediaType())
                        .append(":")
                        .append(r.externalId())
                        .toString())
            .distinct()
            .count()
        != references.size()) {
      throw new IllegalArgumentException("A list cannot contain the same media twice");
    }
  }

  private LinkedHashSet<String> tags(List<String> tags) {
    return tags == null
        ? new LinkedHashSet<>()
        : tags.stream()
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toCollection(LinkedHashSet::new));
  }

  private void addItems(
      MediaListEntity list, List<MediaEntity> media, Map<UUID, UUID> authors, UUID fallback) {
    for (int position = 0; position < media.size(); position++) {
      MediaEntity entry = media.get(position);
      list.addItem(entry, position, authors.getOrDefault(entry.getId(), fallback));
    }
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<MediaListResponseDto> listForProfile(
      UUID viewerId, String username, int page, int size, String query) {
    var owner =
        userRepository
            .findByUsernameIgnoreCase(username)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.USER_NOT_FOUND, "User not found"));
    UUID viewer = viewerOrNil(viewerId);
    int boundedSize = Math.clamp(size, 1, MAX_PROFILE_LISTS_PAGE_SIZE);
    int boundedPage = Math.max(page, 0);
    if (!visibilityPolicy.canViewProfile(viewerId, owner)) {
      throw new ForbiddenException(ErrorCode.PROFILE_PRIVATE, "This profile is private");
    }
    var lists =
        repository.findVisibleByOwner(
            owner.getId(),
            viewer,
            CommunityFilter.likePattern(query),
            PageRequest.of(boundedPage, boundedSize, Sort.by(Sort.Direction.DESC, "updatedAt")));
    return new PagedResponseDto<>(
        lists.getContent().stream().map(list -> toResponse(viewerId, list)).toList(),
        boundedPage,
        boundedSize,
        lists.getTotalElements());
  }

  @Transactional(readOnly = true)
  public PagedResponseDto<MediaListSummaryResponseDto> browse(
      UUID viewerId, CommunityFilter filter, Pageable pageable) {
    var page = repository.browse(viewerOrNil(viewerId), filter, pageable);
    boolean adultContentAllowed = viewerPreferences.allowsAdultContent(viewerId);
    Map<UUID, UserEntity> ownersById =
        userRepository
            .findAllById(
                page.getContent().stream().map(MediaListEntity::getUserId).distinct().toList())
            .stream()
            .collect(Collectors.toMap(UserEntity::getId, owner -> owner));
    List<UUID> ids = page.getContent().stream().map(MediaListEntity::getId).toList();
    Map<UUID, Long> likes =
        ids.isEmpty() ? Map.of() : IdCount.toMap(likeRepository.countByListIds(ids));
    Map<UUID, Long> comments = commentService.count(CommentTargetType.LIST, ids);
    Set<UUID> completedMedia = completedMediaIds(viewerId, page.getContent());
    return new PagedResponseDto<>(
        page.getContent().stream()
            .map(
                list ->
                    toSummary(
                        list,
                        ownersById.get(list.getUserId()),
                        likes.getOrDefault(list.getId(), 0L),
                        comments.getOrDefault(list.getId(), 0L),
                        adultContentAllowed,
                        viewerId == null
                            ? null
                            : (int)
                                list.getItems().stream()
                                    .filter(
                                        item -> completedMedia.contains(item.getMedia().getId()))
                                    .count()))
            .toList(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements());
  }

  private Set<UUID> completedMediaIds(UUID viewerId, List<MediaListEntity> lists) {
    if (viewerId == null || lists.isEmpty()) {
      return Set.of();
    }
    List<UUID> mediaIds =
        lists.stream()
            .flatMap(list -> list.getItems().stream())
            .map(item -> item.getMedia().getId())
            .distinct()
            .toList();
    if (mediaIds.isEmpty()) {
      return Set.of();
    }
    return userMediaRepository.findByUserIdAndMediaIdIn(viewerId, mediaIds).stream()
        .filter(item -> item.getStatus() == UserMediaStatus.DONE)
        .map(item -> item.getMedia().getId())
        .collect(Collectors.toSet());
  }

  private static UUID viewerOrNil(UUID viewerId) {
    return viewerId == null ? NIL_UUID : viewerId;
  }

  @Transactional(readOnly = true)
  public MediaListResponseDto get(UUID viewerId, UUID listId) {
    MediaListEntity list =
        repository
            .findById(listId)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.LIST_NOT_FOUND, "List not found"));
    if (!listAccess.canView(viewerId, list)) {
      throw new ResourceNotFoundException(ErrorCode.LIST_NOT_FOUND, "List not found");
    }
    return toResponse(viewerId, list);
  }

  public MediaListResponseDto addItem(UUID userId, UUID listId, MediaReferenceDto reference) {
    transactionTemplate.executeWithoutResult(status -> getEditable(userId, listId));
    MediaEntity media =
        mediaResolver.findOrCreate(
            reference.externalId(), reference.provider(), reference.mediaType());
    return transactionTemplate.execute(
        status -> {
          MediaListEntity list = getEditable(userId, listId);
          if (list.containsMedia(media.getId())) {
            throw new ConflictException(
                ErrorCode.LIST_ITEM_ALREADY_EXISTS, "This media is already in the list");
          }
          requireRoom(list, 1);
          list.appendItem(media, userId);
          return toResponse(userId, published(repository.save(list), userId));
        });
  }

  @Transactional
  public MediaListResponseDto updateDetails(
      UUID userId, UUID listId, UpdateMediaListDetailsRequestDto request) {
    MediaListEntity list = getOwned(userId, listId);
    list.updateDetails(
        request.name().trim(),
        blankToNull(request.description()),
        request.visibility(),
        tags(request.tags()));
    return toResponse(userId, published(repository.save(list), userId));
  }

  public MediaListResponseDto addItems(
      UUID userId, UUID listId, List<MediaReferenceDto> references) {
    transactionTemplate.executeWithoutResult(status -> getEditable(userId, listId));
    List<MediaEntity> media = mediaResolver.findOrCreateAll(references);
    return transactionTemplate.execute(
        status -> {
          MediaListEntity list = getEditable(userId, listId);
          List<MediaEntity> fresh =
              media.stream()
                  .filter(entry -> !list.containsMedia(entry.getId()))
                  .distinct()
                  .toList();
          requireRoom(list, fresh.size());
          fresh.forEach(entry -> list.appendItem(entry, userId));
          return toResponse(userId, published(repository.save(list), userId));
        });
  }

  @Transactional
  public MediaListResponseDto removeItems(UUID userId, UUID listId, Collection<UUID> mediaIds) {
    MediaListEntity list = getEditable(userId, listId);
    mediaIds.forEach(list::removeItemByMedia);
    return toResponse(userId, published(repository.save(list), userId));
  }

  @Transactional
  public MediaListResponseDto reorder(UUID userId, UUID listId, List<UUID> mediaIds) {
    MediaListEntity list = getEditable(userId, listId);
    if (!list.reorder(mediaIds)) {
      throw new ConflictException(
          ErrorCode.LIST_ORDER_STALE, "The list changed, reload it before reordering");
    }
    return toResponse(userId, published(repository.save(list), userId));
  }

  private void requireRoom(MediaListEntity list, int adding) {
    if (list.getItems().size() + adding > MAX_ITEMS) {
      throw new BadRequestException(
          ErrorCode.LIST_TOO_LARGE, "A list holds at most " + MAX_ITEMS + " titles");
    }
  }

  @Transactional
  public MediaListResponseDto removeItem(UUID userId, UUID listId, UUID mediaId) {
    MediaListEntity list = getEditable(userId, listId);
    if (!list.removeItemByMedia(mediaId)) {
      throw new ResourceNotFoundException(ErrorCode.LIST_ITEM_NOT_FOUND, "Item not found");
    }
    return toResponse(userId, published(repository.save(list), userId));
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
    boolean adultContentAllowed = viewerPreferences.allowsAdultContent(userId);
    return repository.findEditableBy(userId, PageRequest.of(0, MAX_EDITABLE)).stream()
        .map(
            list ->
                new EditableCreationResponseDto(
                    list.getId(),
                    list.getName(),
                    list.getVisibility(),
                    list.getItems().size(),
                    list.getItems().stream()
                        .sorted(Comparator.comparingInt(MediaListItemEntity::getPosition))
                        .map(item -> media(item.getMedia(), adultContentAllowed).coverUrl())
                        .filter(Objects::nonNull)
                        .limit(PREVIEW_SIZE)
                        .toList(),
                    list.getUserId().equals(userId),
                    false,
                    mediaId != null && list.containsMedia(mediaId) ? mediaId : null))
        .toList();
  }

  private MediaListEntity getEditable(UUID userId, UUID listId) {
    MediaListEntity list =
        repository
            .findById(listId)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.LIST_NOT_FOUND, "List not found"));
    if (!listAccess.canEditItems(userId, list)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot edit this list");
    }
    list.getItems().size();
    return list;
  }

  @Transactional
  public MediaListResponseDto like(UUID userId, UUID listId) {
    MediaListEntity list = getVisible(userId, listId);
    if (list.getUserId().equals(userId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot like your own list");
    }
    if (!likeRepository.existsByListIdAndUserId(listId, userId)) {
      likeRepository.save(new MediaListLikeEntity(list, userId));
      interactionPublisher.collectionLiked(
          userId, CommentTargetType.LIST, list.getId(), list.getUserId(), true);
      notificationService.create(
          list.getUserId(), userId, NotificationType.CREATION_LIKED, "LIST", listId, Map.of());
    }
    return toResponse(userId, list);
  }

  @Transactional
  public MediaListResponseDto unlike(UUID userId, UUID listId) {
    MediaListEntity list = getVisible(userId, listId);
    if (list.getUserId().equals(userId)) {
      throw new ForbiddenException(ErrorCode.UNAUTHORIZED, "You cannot unlike your own list");
    }
    if (likeRepository.existsByListIdAndUserId(listId, userId)) {
      likeRepository.deleteByListIdAndUserId(listId, userId);
      interactionPublisher.collectionLiked(
          userId, CommentTargetType.LIST, list.getId(), list.getUserId(), false);
      notificationService.retract(
          list.getUserId(), userId, NotificationType.CREATION_LIKED, "LIST", listId);
    }
    return toResponse(userId, list);
  }

  private MediaListEntity getVisible(UUID viewerId, UUID listId) {
    MediaListEntity list =
        repository
            .findById(listId)
            .orElseThrow(
                () -> new ResourceNotFoundException(ErrorCode.LIST_NOT_FOUND, "List not found"));
    if (!listAccess.canView(viewerId, list)) {
      throw new ResourceNotFoundException(ErrorCode.LIST_NOT_FOUND, "List not found");
    }
    return list;
  }

  private MediaListResponseDto toResponse(UUID viewerId, MediaListEntity list) {
    UserEntity owner = userRepository.findById(list.getUserId()).orElse(null);
    boolean adultContentAllowed = viewerPreferences.allowsAdultContent(viewerId);
    List<MediaListItemEntity> items =
        list.getItems().stream()
            .sorted(Comparator.comparingInt(MediaListItemEntity::getPosition))
            .toList();
    var authors =
        contributors.resolve(items.stream().map(MediaListItemEntity::getAddedBy).toList());
    return new MediaListResponseDto(
        list.getId(),
        list.getUserId(),
        list.getName(),
        list.getDescription(),
        list.getVisibility(),
        List.copyOf(list.getTags()),
        items.stream().map(i -> media(i.getMedia(), adultContentAllowed)).toList(),
        items.stream()
            .map(i -> new MediaListItemDto(i.getMedia().getId(), authors.get(i.getAddedBy())))
            .toList(),
        likeRepository.existsByListIdAndUserId(list.getId(), viewerId),
        likeRepository.countByListId(list.getId()),
        completion(viewerId, list),
        commentService.listTopByRelevance(
            CommentTargetType.LIST, list.getId(), viewerId, COMMENT_PAGE_SIZE),
        commentService.count(CommentTargetType.LIST, list.getId()),
        collaboratorService.listCollaborators(list.getId()),
        list.getUserId().equals(viewerId)
            ? collaboratorService.listPendingInvites(list.getId())
            : List.of(),
        listAccess.canEditItems(viewerId, list),
        collaboratorRepository
            .findByListIdAndUserId(list.getId(), viewerId)
            .map(MediaListCollaboratorEntity::getStatus)
            .orElse(null),
        owner == null ? null : owner.getUsername(),
        owner == null ? null : avatarStorageService.urlFor(owner.getAvatarFilename()),
        source(viewerId, list),
        list.getCreatedAt(),
        list.getUpdatedAt());
  }

  private MediaListSourceDto source(UUID viewerId, MediaListEntity list) {
    if (list.getSourceListId() == null) {
      return null;
    }
    return repository
        .findById(list.getSourceListId())
        .filter(source -> listAccess.canView(viewerId, source))
        .map(
            source ->
                new MediaListSourceDto(
                    source.getId(),
                    source.getName(),
                    userRepository
                        .findById(source.getUserId())
                        .map(UserEntity::getUsername)
                        .orElse(null)))
        .orElse(null);
  }

  private MediaListSummaryResponseDto toSummary(
      MediaListEntity list,
      UserEntity owner,
      long likeCount,
      long commentCount,
      boolean adultContentAllowed,
      Integer viewerCompleted) {
    return new MediaListSummaryResponseDto(
        list.getId(),
        list.getUserId(),
        list.getName(),
        list.getDescription(),
        list.getVisibility(),
        List.copyOf(list.getTags()),
        list.getItems().size(),
        previewMedia(list, adultContentAllowed),
        viewerCompleted,
        likeCount,
        commentCount,
        owner == null ? null : owner.getUsername(),
        owner == null ? null : avatarStorageService.urlFor(owner.getAvatarFilename()),
        list.getCreatedAt(),
        list.getUpdatedAt());
  }

  private List<MediaResponseDto> previewMedia(MediaListEntity list, boolean adultContentAllowed) {
    List<MediaResponseDto> ordered =
        list.getItems().stream()
            .sorted(Comparator.comparingInt(MediaListItemEntity::getPosition))
            .map(item -> media(item.getMedia(), adultContentAllowed))
            .toList();
    Set<Integer> chosen = new HashSet<>();
    for (int i = 0; i < ordered.size() && chosen.size() < PREVIEW_SIZE; i++) {
      if (ordered.get(i).coverUrl() != null) {
        chosen.add(i);
      }
    }
    for (int i = 0; i < ordered.size() && chosen.size() < PREVIEW_SIZE; i++) {
      chosen.add(i);
    }
    return IntStream.range(0, ordered.size())
        .filter(chosen::contains)
        .mapToObj(ordered::get)
        .toList();
  }

  private ListCompletionResponseDto completion(UUID userId, MediaListEntity list) {
    int total = list.getItems().size();
    var statuses = new EnumMap<UserMediaStatus, Integer>(UserMediaStatus.class);
    for (UserMediaStatus status : UserMediaStatus.values()) {
      statuses.put(status, 0);
    }
    if (total > 0) {
      userMediaRepository
          .findByUserIdAndMediaIdIn(
              userId, list.getItems().stream().map(item -> item.getMedia().getId()).toList())
          .forEach(item -> statuses.merge(item.getStatus(), 1, Integer::sum));
    }
    int inCollection = statuses.values().stream().mapToInt(Integer::intValue).sum();
    int completed = statuses.get(UserMediaStatus.DONE);
    int percentage = total == 0 ? 0 : Math.round(completed * 100f / total);
    return new ListCompletionResponseDto(
        total,
        inCollection,
        statuses.get(UserMediaStatus.PLANNED),
        statuses.get(UserMediaStatus.ONGOING),
        statuses.get(UserMediaStatus.DONE),
        statuses.get(UserMediaStatus.DROPPED),
        completed,
        percentage);
  }

  private MediaResponseDto media(MediaEntity media, boolean adultContentAllowed) {
    MediaResponseDto dto =
        new MediaResponseDto(
            media.getId(),
            media.getCanonicalWork().getId(),
            media.getExternalId(),
            media.getProvider(),
            media.getMediaType(),
            media.getTitle(),
            media.getCoverUrl(),
            media.getMetadata(),
            media.getCreatedAt(),
            media.isAdult());
    return adultContentAllowed || !dto.isAdult() ? dto : dto.masked();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
