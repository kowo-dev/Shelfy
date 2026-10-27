package com.shelfy.api.auth.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PasswordLengthValidationTest {

  private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

  private Set<ConstraintViolation<RegisterRequestDto>> register(String password) {
    return validator.validate(new RegisterRequestDto("a@b.co", "camille", password));
  }

  @Test
  void asciiPasswordUpToSeventyTwoBytesIsAccepted() {
    assertTrue(register("a".repeat(12)).isEmpty());
    assertTrue(register("a".repeat(72)).isEmpty());
  }

  @Test
  void asciiPasswordOverSeventyTwoBytesIsRejected() {
    Set<ConstraintViolation<RegisterRequestDto>> violations = register("a".repeat(73));

    assertEquals(1, violations.size());
    assertEquals("password", violations.iterator().next().getPropertyPath().toString());
  }

  @Test
  void accentedCharactersCountTwoBytesEach() {
    assertTrue(register("é".repeat(36)).isEmpty());
    assertEquals(1, register("é".repeat(37)).size());
  }

  @Test
  void resetPasswordAppliesTheSameLimit() {
    assertTrue(validator.validate(new ResetPasswordRequestDto("t", "a".repeat(72))).isEmpty());
    assertEquals(1, validator.validate(new ResetPasswordRequestDto("t", "a".repeat(73))).size());
  }
}
