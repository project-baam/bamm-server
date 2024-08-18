import { ErrorCode } from 'src/common/constants/error-codes';
import { ApplicationException } from './application-exceptions.base';
import { SignInProvider } from 'src/module/iam/domain/enums/sign-in-provider.enum';

export class ContentNotFoundError extends ApplicationException {
  constructor(resource: string = '$resource', id: string | number = '$id') {
    const message = `${resource} #${id} not found`;
    super(ErrorCode.ContentNotFound, message);
  }
}

export class DuplicateValueError extends ApplicationException {
  constructor(
    resource: string = '$resource',
    property: string = '$property',
    value: string | number = '$value',
  ) {
    const message = `Duplicate *${property}* for *${resource}*: *${value}*`;
    super(ErrorCode.DuplicateValue, message);
  }
}

export class MissingAuthTokenError extends ApplicationException {
  constructor() {
    super(
      ErrorCode.MissingAuthToken,
      'Access token is missing in the request header.',
    );
  }
}

export class InvalidAccessTokenError extends ApplicationException {
  constructor() {
    super(ErrorCode.InvalidAccessToken, 'Invalid Access Token');
  }
}

export class InvalidatedRefreshTokenError extends ApplicationException {
  constructor() {
    super(
      ErrorCode.InvalidRefreshToken,
      'Access denied. Your refresh token might have been stolen',
    );
  }
}

export class IncorrectLoginInfo extends ApplicationException {
  constructor() {
    super(
      ErrorCode.IncorrectLoginInfo,
      'The email address or password is incorrect',
    );
  }
}

export class NeisError extends ApplicationException {
  constructor(message?: string) {
    super(ErrorCode.NeisError, message);
  }
}

class SocialAuthenticationError extends ApplicationException {
  constructor(provider: string, details?: string) {
    const message = `Authentication failed with ${provider}. ${details || ''}`;
    super(ErrorCode.SocialAuthenticationFailed, message);
  }
}

export class KakaoAuthError extends SocialAuthenticationError {
  constructor(details?: string) {
    super(SignInProvider.KAKAO, details);
  }
}

// export class AppleAuthError extends SocialAuthenticationError {
//   constructor(details?: string) {
//     super(SignInProvider.APPLE, details);
//   }
// }

export class IncompleteProfileError extends ApplicationException {
  constructor() {
    super(ErrorCode.IncompleteProfile, '필수 프로필 정보 누락');
  }
}

export class InvalidFileNameExtensionError extends ApplicationException {
  constructor() {
    super(
      ErrorCode.InvalidFileNameExtension,
      'Invalid Filename Extension. Only JPG, PNG, JPEG and GIF files are allowed.',
    );
  }
}

export class InvalidFileNameCharatersError extends ApplicationException {
  constructor() {
    super(
      ErrorCode.InvalidFilenameCharacters,
      'File names can only contain English letters (a-z, A-Z), numbers (0-9), Korean characters, underscores (_), hyphens (-), and periods (.)',
    );
  }
}

export class MissingRequiredFieldsError extends ApplicationException {
  constructor(properties?: string[]) {
    super(
      ErrorCode.MissingRequiredFields,
      `Missing required fields:[ ${properties?.join(', ')}] must all be provided together.`,
    );
  }
}
