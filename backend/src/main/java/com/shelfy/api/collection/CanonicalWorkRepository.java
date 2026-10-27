package com.shelfy.api.collection;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CanonicalWorkRepository extends JpaRepository<CanonicalWorkEntity, UUID> {}
