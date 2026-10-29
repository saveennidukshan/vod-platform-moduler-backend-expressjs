export class BaseResponse {
  constructor(message, success) {
    this.success = success;
    this.message = message;
  }
  send(res, code = 200) {
    res.status(code).json(this);
  }
}

export class SuccessResponse extends BaseResponse {
  constructor(message) {
    super(message, true);
  }
}

export class BadResponse extends BaseResponse {
  constructor(message) {
    super(message, false);
  }
}

export class TokenResponse extends SuccessResponse {
  constructor(message, tokens) {
    super(message);
    this.tokens = tokens;
  }
}

export class DataResponse extends SuccessResponse {
  constructor(message, data) {
    super(message);
    this.data = data;
  }
}

export class AvatarUploadResponse extends SuccessResponse {
  constructor(message, url) {
    super(message);
    this.url = url;
  }
}
