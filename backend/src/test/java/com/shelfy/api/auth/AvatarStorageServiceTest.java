package com.shelfy.api.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.shelfy.api.common.exception.BadRequestException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Path;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

class AvatarStorageServiceTest {

  @TempDir Path directory;

  private AvatarStorageService service() {
    return new AvatarStorageService(
        new AvatarStorageProperties(directory.toString(), "http://localhost", 2_097_152));
  }

  @Test
  void store_acceptsASmallPng() throws IOException {
    String filename = service().store(UUID.randomUUID(), png(64, 64));

    assertTrue(filename.endsWith(".png"));
    assertTrue(directory.resolve(filename).toFile().exists());
  }

  @Test
  void store_rejectsAFileThatDeclaresGigapixels() throws IOException {
    MockMultipartFile huge = png(5_000, 5_000);

    BadRequestException ex =
        assertThrows(BadRequestException.class, () -> service().store(UUID.randomUUID(), huge));

    assertEquals("The image is too large", ex.getMessage());
    assertEquals(0, directory.toFile().list().length);
  }

  private static MockMultipartFile png(int width, int height) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_BYTE_GRAY), "png", out);
    return new MockMultipartFile("file", "a.png", "image/png", out.toByteArray());
  }
}
