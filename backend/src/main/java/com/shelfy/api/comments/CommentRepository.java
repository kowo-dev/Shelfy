package com.shelfy.api.comments;

import com.shelfy.api.common.IdCount;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<CommentEntity, UUID> {
  List<CommentEntity> findByAuthorIdOrderByCreatedAtAsc(UUID authorId);

  List<CommentEntity> findByTargetTypeAndTargetId(CommentTargetType targetType, UUID targetId);

  long countByTargetTypeAndTargetIdAndDeletedAtIsNull(CommentTargetType targetType, UUID targetId);

  boolean existsByParentId(UUID parentId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      "select distinct c.author.id from CommentEntity c where c.targetType = :targetType "
          + "and c.targetId = :targetId and c.author.domain is null")
  List<UUID> findLocalAuthorIds(
      @Param("targetType") CommentTargetType targetType, @Param("targetId") UUID targetId);

  @Query("select c from CommentEntity c where c.id = :id")
  Optional<CommentEntity> findByIdForVote(UUID id);

  @Query(
      "select c.targetId as id, count(c) as count from CommentEntity c"
          + " where c.targetType = :targetType and c.targetId in :targetIds and c.deletedAt is null"
          + " group by c.targetId")
  List<IdCount> countByTargets(
      @Param("targetType") CommentTargetType targetType,
      @Param("targetIds") Collection<UUID> targetIds);

  @Query(
      "select c from CommentEntity c join fetch c.author"
          + " where c.targetType = :targetType and c.targetId in :targetIds")
  List<CommentEntity> findWithAuthorsByTargets(
      @Param("targetType") CommentTargetType targetType,
      @Param("targetIds") Collection<UUID> targetIds);
}
