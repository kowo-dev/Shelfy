import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@app/core/services/translate/translate';
import { ApiError } from '@app/core/errors/api-error';

@Injectable({ providedIn: 'root' })
export class ErrorMessageService {
  private readonly translate = inject(TranslateService);

  private readonly fallbackKeys: Record<string, string> = {
    INVALID_CREDENTIALS: 'auth.errors.invalid_credentials',
    EMAIL_ALREADY_IN_USE: 'auth.errors.email_already_used',
    REGISTRATION_CLOSED: 'auth.errors.registration_closed',
    USERNAME_ALREADY_IN_USE: 'auth.errors.username_taken',
    VALIDATION_FAILED: 'auth.errors.validation_failed',
    UNAUTHORIZED: 'auth.errors.unauthorized',
    USER_NOT_FOUND: 'auth.errors.user_not_found',
    ADULT_CONTENT_CONFIRMATION_REQUIRED: 'settings.errors.adult_content_confirmation_required',
    PASSWORD_RESET_TOKEN_INVALID: 'auth.errors.reset_token_invalid',
    EMAIL_NOT_VERIFIED: 'auth.errors.email_not_verified',
    EMAIL_VERIFICATION_TOKEN_INVALID: 'auth.errors.verification_token_invalid',
    EMAIL_CHANGE_TOKEN_INVALID: 'auth.errors.email_change_token_invalid',
    AVATAR_FILE_TOO_LARGE: 'settings.avatar_banner.avatar.errors.too_large',
    AVATAR_INVALID_FILE_TYPE: 'settings.avatar_banner.avatar.errors.invalid_type',
    AVATAR_UPLOAD_FAILED: 'settings.avatar_banner.avatar.errors.upload_failed',
    COLLECTION_ITEM_NOT_FOUND: 'collection.errors.item_not_found',
    COMMENT_NOT_FOUND: 'comments.errors.not_found',
    MEDIA_ALREADY_IN_COLLECTION: 'collection.errors.media_already_in_collection',
    STATUS_NOT_APPLICABLE_TO_MEDIA_TYPE: 'collection.errors.status_not_applicable',
    REMOTE_FOLLOW_INVALID_ADDRESS: 'auth.remote_follow.errors.invalid_address',
    REMOTE_FOLLOW_ACCOUNT_NOT_FOUND: 'auth.remote_follow.errors.account_not_found',
    REMOTE_FOLLOW_SERVER_UNREACHABLE: 'auth.remote_follow.errors.server_unreachable',
    REMOTE_FOLLOW_UNSUPPORTED: 'auth.remote_follow.errors.unsupported',
    CANNOT_FOLLOW_SELF: 'profile.follow.cannot_follow_self',
    ALREADY_FOLLOWING: 'profile.follow.already_following',
    CANNOT_INVITE_SELF_AS_COLLABORATOR: 'lists.collab.errors.cannot_invite_self',
    LIST_COLLABORATOR_MUST_FOLLOW: 'lists.collab.errors.must_follow',
    VERSUS_COLLABORATOR_MUST_FOLLOW: 'lists.collab.errors.must_follow',
    LIST_COLLABORATOR_ALREADY_EXISTS: 'lists.collab.errors.already_invited',
    LIST_COLLABORATOR_NOT_FOUND: 'lists.collab.errors.not_found',
    LIST_ITEM_NOT_FOUND: 'lists.collab.errors.item_not_found',
    LIST_ITEM_ALREADY_EXISTS: 'lists.collab.errors.item_already_exists',
    LIST_TOO_LARGE: 'lists.collab.errors.too_large',
    LIST_ORDER_STALE: 'lists.collab.errors.order_stale',
    STEAM_NOT_CONNECTED: 'settings.import.errors.not_connected',
    STEAM_ALREADY_LINKED: 'settings.import.errors.already_linked',
    STEAM_IMPORT_IN_PROGRESS: 'settings.import.errors.in_progress',
    STEAM_PROVIDER_UNAVAILABLE: 'settings.import.errors.provider_unavailable',
    LETTERBOXD_IMPORT_IN_PROGRESS: 'settings.import.errors.in_progress',
    LETTERBOXD_INVALID_FILE: 'settings.import.letterboxd.errors.invalid_file',
    VERSUS_POOL_NOT_FOUND: 'versus.errors.pool_not_found',
    VERSUS_POOL_TOO_SMALL: 'versus.errors.pool_too_small',
    VERSUS_ITEM_ALREADY_EXISTS: 'versus.errors.item_already_exists',
    VERSUS_ITEM_NOT_FOUND: 'versus.errors.item_not_found',
    VERSUS_CLIP_INVALID_URL: 'versus.errors.clip_invalid_url',
    VERSUS_CLIP_UNAVAILABLE: 'versus.errors.clip_unavailable',
    VERSUS_SESSION_NOT_FOUND: 'versus.errors.session_not_found',
    VERSUS_SESSION_ALREADY_COMPLETED: 'versus.errors.session_already_completed',
    VERSUS_MATCH_NOT_FOUND: 'versus.errors.match_not_found',
    VERSUS_INVALID_PICK: 'versus.errors.invalid_pick',
    INTERNAL_SERVER_ERROR: 'errors.internal_server_error',
    UNKNOWN_ERROR: 'errors.unknown_error',
  };

  fromApiError(error: unknown): string {
    const code = error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
    const key = this.fallbackKeys[code] ?? this.fallbackKeys['UNKNOWN_ERROR'];
    return this.translate.get(key);
  }

  fromError(error: unknown): string {
    if (error instanceof ApiError) {
      return this.fromApiError(error);
    }
    return error instanceof Error ? error.message : this.translate.get('errors.unknown_error');
  }
}
