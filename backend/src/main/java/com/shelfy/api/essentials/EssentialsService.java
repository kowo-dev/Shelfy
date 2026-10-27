package com.shelfy.api.essentials;

import com.shelfy.api.collection.UserMediaEntity;
import com.shelfy.api.collection.UserMediaRepository;
import com.shelfy.api.collection.dto.MediaResponseDto;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import com.shelfy.api.common.exception.ResourceNotFoundException;
import com.shelfy.api.essentials.dto.EssentialEntryResponseDto;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EssentialsService {

  private final EssentialEntryRepository essentialEntryRepository;
  private final UserMediaRepository userMediaRepository;

  @Transactional(readOnly = true)
  public List<EssentialEntryResponseDto> getEssentials(UUID userId, boolean adultContentAllowed) {
    return essentialEntryRepository.findByUserIdOrderBySlotAsc(userId).stream()
        .map(entry -> toResponse(entry).maskedIfAdult(adultContentAllowed))
        .toList();
  }

  @Transactional
  public List<EssentialEntryResponseDto> replace(
      UUID userId, List<UUID> userMediaIds, boolean adultContentAllowed) {
    if (new HashSet<>(userMediaIds).size() != userMediaIds.size()) {
      throw new BadRequestException(
          ErrorCode.VALIDATION_FAILED, "A title can only hold one Essentials slot");
    }
    Map<UUID, UserMediaEntity> owned =
        userMediaRepository.findAllById(userMediaIds).stream()
            .filter(item -> item.getUserId().equals(userId))
            .collect(Collectors.toMap(UserMediaEntity::getId, Function.identity()));
    if (owned.size() != userMediaIds.size()) {
      throw new ResourceNotFoundException(
          ErrorCode.COLLECTION_ITEM_NOT_FOUND, "Collection item not found");
    }
    essentialEntryRepository.deleteByUserId(userId);
    essentialEntryRepository.flush();
    essentialEntryRepository.saveAll(
        IntStream.range(0, userMediaIds.size())
            .mapToObj(
                slot -> new EssentialEntryEntity(userId, owned.get(userMediaIds.get(slot)), slot))
            .toList());
    return getEssentials(userId, adultContentAllowed);
  }

  private EssentialEntryResponseDto toResponse(EssentialEntryEntity entry) {
    return new EssentialEntryResponseDto(
        entry.getSlot(),
        entry.getUserMedia().getId(),
        MediaResponseDto.of(entry.getUserMedia().getMedia()));
  }
}
