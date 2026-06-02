import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorBody = {
      error: {
        code: status,
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any).message || exception.message,
        requestId: request.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    };

    this.logger.warn(
      JSON.stringify({
        status,
        path: request.url,
        method: request.method,
        requestId: request.headers['x-request-id'],
        message: errorBody.error.message,
      }),
    );

    response.status(status).json(errorBody);
  }
}
