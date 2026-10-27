package com.shelfy.api.auth.oauth;

public record OAuthStateTransaction(String state, String browserToken) {}
