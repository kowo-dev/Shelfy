package com.shelfy.api.common.mail;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {

  private final JavaMailSender mailSender;
  private final String fromAddress;

  public MailService(JavaMailSender mailSender, MailProperties mailProperties) {
    this.mailSender = mailSender;
    this.fromAddress = mailProperties.from();
  }

  public void send(String to, String subject, String body) {
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(fromAddress);
    message.setTo(to);
    message.setSubject(subject);
    message.setText(body);
    mailSender.send(message);
  }
}
