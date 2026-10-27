package com.shelfy.api.lists;

import com.shelfy.api.collaboration.CollaboratorController;
import com.shelfy.api.lists.dto.MediaListCollaboratorResponseDto;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/lists/{parentId}/collaborators")
public class MediaListCollaboratorController
    extends CollaboratorController<MediaListCollaboratorResponseDto> {

  public MediaListCollaboratorController(MediaListCollaboratorService service) {
    super(service);
  }
}
