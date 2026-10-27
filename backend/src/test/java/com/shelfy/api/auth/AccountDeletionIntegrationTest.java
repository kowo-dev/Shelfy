package com.shelfy.api.auth;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.shelfy.api.versus.VersusPoolEntity;
import com.shelfy.api.versus.VersusPoolRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootTest
class AccountDeletionIntegrationTest {

  @Autowired private AuthService authService;
  @Autowired private UserRepository users;
  @Autowired private VersusPoolRepository pools;
  @Autowired private PasswordEncoder passwordEncoder;

  @Test
  void deleteAccount_removesUsersWhoCreatedVersusPools() {
    String name = "d" + UUID.randomUUID().toString().substring(0, 12);
    UserEntity user =
        users.saveAndFlush(
            new UserEntity(name + "@example.com", name, passwordEncoder.encode("password-12345")));
    pools.saveAndFlush(
        new VersusPoolEntity(user.getId(), "pool", null, CollectionVisibility.PUBLIC));

    authService.deleteAccount(user.getId(), "password-12345");

    assertTrue(users.findById(user.getId()).isEmpty());
    assertTrue(pools.findByUserIdOrderByCreatedAtAsc(user.getId()).isEmpty());
  }
}
