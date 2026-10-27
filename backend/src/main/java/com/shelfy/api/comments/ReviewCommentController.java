package com.shelfy.api.comments;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reviews")
public class ReviewCommentController extends CommentEndpoints {

  public ReviewCommentController(CommentService commentService) {
    super(commentService, CommentTargetType.REVIEW);
  }
}
