package com.shelfy.api.auth;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

  Optional<UserEntity> findByEmailIgnoreCase(String email);

  Optional<UserEntity> findByUsernameIgnoreCaseAndDomainIsNull(String username);

  Optional<UserEntity> findByUsernameIgnoreCase(String username);

  Optional<UserEntity> findBySteamId(String steamId);

  @Query("select u.adultContentAllowed from UserEntity u where u.id = :id")
  Optional<Boolean> findAllowAdultContentById(@Param("id") UUID id);

  List<UserEntity> findByUsernameIgnoreCaseInAndDomainIsNull(Collection<String> usernames);

  boolean existsByEmailIgnoreCase(String email);

  boolean existsByUsernameIgnoreCaseAndDomainIsNull(String username);

  boolean existsByUsernameIgnoreCaseAndDomainIsNullAndIdNot(String username, UUID id);

  long countByDomainIsNull();

  @Query(
      "select u from UserEntity u"
          + " where (unaccent(lower(u.username)) like unaccent(lower(concat('%', :query, '%')))"
          + " or unaccent(lower(coalesce(u.displayName, ''))) like"
          + " unaccent(lower(concat('%', :query, '%'))))"
          + " and u.id <> :excludeUserId")
  Page<UserEntity> searchByUsername(
      @Param("query") String query, @Param("excludeUserId") UUID excludeUserId, Pageable pageable);
}
