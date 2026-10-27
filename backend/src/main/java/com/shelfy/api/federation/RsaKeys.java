package com.shelfy.api.federation;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

public final class RsaKeys {

  private static final int KEY_SIZE = 2048;

  private RsaKeys() {}

  public static KeyPair generate() {
    try {
      KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
      generator.initialize(KEY_SIZE);
      return generator.generateKeyPair();
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("RSA is not available", e);
    }
  }

  public static String publicPem(PublicKey key) {
    return pem("PUBLIC KEY", key.getEncoded());
  }

  public static String privatePem(PrivateKey key) {
    return pem("PRIVATE KEY", key.getEncoded());
  }

  public static PublicKey parsePublic(String pem) {
    try {
      return KeyFactory.getInstance("RSA")
          .generatePublic(new X509EncodedKeySpec(decode(pem, "PUBLIC KEY")));
    } catch (GeneralSecurityException | IllegalArgumentException e) {
      throw new IllegalArgumentException("Invalid RSA public key", e);
    }
  }

  public static PrivateKey parsePrivate(String pem) {
    try {
      return KeyFactory.getInstance("RSA")
          .generatePrivate(new PKCS8EncodedKeySpec(decode(pem, "PRIVATE KEY")));
    } catch (GeneralSecurityException | IllegalArgumentException e) {
      throw new IllegalArgumentException("Invalid RSA private key", e);
    }
  }

  private static String pem(String type, byte[] der) {
    String body =
        Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(der);
    return "-----BEGIN " + type + "-----\n" + body + "\n-----END " + type + "-----\n";
  }

  private static byte[] decode(String pem, String type) {
    String body =
        pem.replace("-----BEGIN " + type + "-----", "")
            .replace("-----END " + type + "-----", "")
            .replaceAll("\\s", "");
    return Base64.getDecoder().decode(body);
  }
}
