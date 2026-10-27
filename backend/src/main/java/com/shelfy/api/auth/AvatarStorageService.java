package com.shelfy.api.auth;

import com.shelfy.api.common.exception.ApiException;
import com.shelfy.api.common.exception.BadRequestException;
import com.shelfy.api.common.exception.ErrorCode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class AvatarStorageService {

  private static final Logger LOG = LoggerFactory.getLogger(AvatarStorageService.class);

  private static final Map<String, String> EXTENSION_BY_CONTENT_TYPE =
      Map.of(
          "image/jpeg", "jpg",
          "image/png", "png",
          "image/webp", "webp");
  private static final Set<String> ALLOWED_CONTENT_TYPES = EXTENSION_BY_CONTENT_TYPE.keySet();
  private static final int WEBP_SIGNATURE_LENGTH = 12;
  private static final long MAX_PIXELS = 4096L * 4096L;

  private final AvatarStorageProperties properties;

  public String store(UUID userId, MultipartFile file) {
    validate(file);
    String extension = EXTENSION_BY_CONTENT_TYPE.get(file.getContentType());
    String filename = userId + "-" + Instant.now().toEpochMilli() + "." + extension;

    try {
      Path directory = Path.of(properties.directory());
      Files.createDirectories(directory);
      try (InputStream in = file.getInputStream()) {
        Files.copy(in, directory.resolve(filename), StandardCopyOption.REPLACE_EXISTING);
      }
    } catch (IOException e) {
      LOG.error("Failed to store avatar for userId={}", userId, e);
      throw new ApiException(
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCode.AVATAR_UPLOAD_FAILED,
          "Could not store the uploaded avatar");
    }

    return filename;
  }

  public void delete(String filename) {
    if (filename == null) {
      return;
    }
    try {
      Files.deleteIfExists(Path.of(properties.directory()).resolve(filename));
    } catch (IOException e) {
      LOG.warn("Failed to delete avatar file {}", filename, e);
    }
  }

  public String urlFor(String filename) {
    if (filename == null) {
      return null;
    }
    return properties.publicBaseUrl() + "/uploads/avatars/" + filename;
  }

  private void validate(MultipartFile file) {
    if (file.isEmpty()) {
      throw new BadRequestException(ErrorCode.AVATAR_INVALID_FILE_TYPE, "The file is empty");
    }
    if (file.getSize() > properties.maxSizeBytes()) {
      throw new BadRequestException(ErrorCode.AVATAR_FILE_TOO_LARGE, "The file is too large");
    }
    String contentType = file.getContentType();
    if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
      throw new BadRequestException(
          ErrorCode.AVATAR_INVALID_FILE_TYPE, "Only JPEG, PNG and WebP images are allowed");
    }
    if ("image/webp".equals(contentType)) {
      validateWebp(file);
    } else {
      validateWithImageIo(file);
    }
  }

  private void validateWithImageIo(MultipartFile file) {
    try (InputStream in = file.getInputStream();
        ImageInputStream imageIn = ImageIO.createImageInputStream(in)) {
      Iterator<ImageReader> readers = imageIn == null ? null : ImageIO.getImageReaders(imageIn);
      if (readers == null || !readers.hasNext()) {
        throw new BadRequestException(
            ErrorCode.AVATAR_INVALID_FILE_TYPE, "The file is not a valid image");
      }
      ImageReader reader = readers.next();
      try {
        reader.setInput(imageIn);
        if ((long) reader.getWidth(0) * reader.getHeight(0) > MAX_PIXELS) {
          throw new BadRequestException(ErrorCode.AVATAR_FILE_TOO_LARGE, "The image is too large");
        }
        reader.read(0);
      } finally {
        reader.dispose();
      }
    } catch (IOException e) {
      throw new BadRequestException(
          ErrorCode.AVATAR_INVALID_FILE_TYPE, "Could not read the uploaded file");
    }
  }

  private void validateWebp(MultipartFile file) {
    byte[] header;
    try (InputStream in = file.getInputStream()) {
      header = in.readNBytes(WEBP_SIGNATURE_LENGTH);
    } catch (IOException e) {
      throw new BadRequestException(
          ErrorCode.AVATAR_INVALID_FILE_TYPE, "Could not read the uploaded file");
    }
    if (!isWebpSignature(header)) {
      throw new BadRequestException(
          ErrorCode.AVATAR_INVALID_FILE_TYPE, "The file is not a valid image");
    }
  }

  private static boolean isWebpSignature(byte[] header) {
    if (header.length < WEBP_SIGNATURE_LENGTH) {
      return false;
    }
    boolean hasRiff = header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F';
    boolean hasWebp =
        header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P';
    return hasRiff && hasWebp;
  }
}
