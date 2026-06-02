class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final String? requestId;

  ApiException(this.message, {this.statusCode, this.requestId});

  @override
  String toString() => 'ApiException($statusCode): $message';
}

class UnauthorizedException extends ApiException {
  UnauthorizedException([String? requestId])
      : super('Unauthorized', statusCode: 401, requestId: requestId);
}

class ConflictException extends ApiException {
  ConflictException([String? requestId])
      : super('Conflict', statusCode: 409, requestId: requestId);
}

class ServerException extends ApiException {
  ServerException([String? requestId])
      : super('Server error', statusCode: 500, requestId: requestId);
}
