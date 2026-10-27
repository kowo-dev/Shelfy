package com.shelfy.api.comments;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentVoteRepository extends JpaRepository<CommentVoteEntity, UUID> {
  Optional<CommentVoteEntity> findByCommentIdAndUserId(UUID commentId, UUID userId);

  long countByCommentIdAndValue(UUID commentId, int value);

  @Query(
      "select v from CommentVoteEntity v where v.userId = :userId and v.comment.id in :commentIds")
  List<CommentVoteEntity> findByUserIdAndCommentIds(
      @Param("userId") UUID userId, @Param("commentIds") Collection<UUID> commentIds);
}
