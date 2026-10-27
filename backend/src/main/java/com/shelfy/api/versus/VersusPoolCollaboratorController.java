package com.shelfy.api.versus;

import com.shelfy.api.collaboration.CollaboratorController;
import com.shelfy.api.versus.dto.VersusPoolCollaboratorResponseDto;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/versus/pools/{parentId}/collaborators")
public class VersusPoolCollaboratorController
    extends CollaboratorController<VersusPoolCollaboratorResponseDto> {

  public VersusPoolCollaboratorController(VersusPoolCollaboratorService service) {
    super(service);
  }
}
