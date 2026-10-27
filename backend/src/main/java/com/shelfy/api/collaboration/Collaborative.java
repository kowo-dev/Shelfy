package com.shelfy.api.collaboration;

import com.shelfy.api.auth.CollectionVisibility;
import java.util.UUID;

public interface Collaborative {
  UUID getId();

  UUID getUserId();

  String getName();

  CollectionVisibility getVisibility();
}
