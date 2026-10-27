package com.shelfy.api.anilist;

import java.util.List;

final class AniListStaffRoles {

  static final String AUTHOR = "author";
  static final String DIRECTOR = "director";

  static final List<String> AUTHOR_ROLES =
      List.of("Original Creator", "Original Story", "Story & Art", "Story", "Art");

  static final List<String> DIRECTOR_ROLES = List.of("Director", "Chief Director");

  private AniListStaffRoles() {}

  static boolean matches(String role, List<String> roles) {
    return role != null && roles.contains(baseRole(role));
  }

  static String baseRole(String role) {
    int detail = role.indexOf(" (");
    return (detail >= 0 ? role.substring(0, detail) : role).trim();
  }
}
