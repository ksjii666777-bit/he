import '../../../core/api/api_client.dart';

class AuthApi {
  final ApiClient _client;

  AuthApi(this._client);

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String name,
    required int age,
    required String countryCode,
    required String nativeLanguage,
    required String learningGoal,
    required int dailyStudyMin,
  }) async {
    final response = await _client.post('/v1/auth/register', data: {
      'email': email,
      'password': password,
      'name': name,
      'age': age,
      'countryCode': countryCode,
      'nativeLanguage': nativeLanguage,
      'learningGoal': learningGoal,
      'dailyStudyMin': dailyStudyMin,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await _client.post('/v1/auth/login', data: {
      'email': email,
      'password': password,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> refresh(String refreshToken) async {
    final response = await _client.post('/v1/auth/refresh', data: {
      'refreshToken': refreshToken,
    });
    return response.data;
  }

  Future<void> logout() async {
    await _client.post('/v1/auth/logout');
  }

  Future<Map<String, dynamic>> grantConsent({
    required bool voiceRecording,
    required bool dataProcessing,
  }) async {
    final response = await _client.post('/v1/auth/consent', data: {
      'voiceRecording': voiceRecording,
      'dataProcessing': dataProcessing,
    });
    return response.data;
  }
}
