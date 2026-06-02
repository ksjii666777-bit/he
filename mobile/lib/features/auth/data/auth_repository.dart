import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'auth_api.dart';

class AuthRepository {
  final AuthApi _api;
  final FlutterSecureStorage _storage;

  AuthRepository(this._api, this._storage);

  Future<bool> isLoggedIn() async {
    final token = await _storage.read(key: 'access_token');
    return token != null;
  }

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
    final result = await _api.register(
      email: email,
      password: password,
      name: name,
      age: age,
      countryCode: countryCode,
      nativeLanguage: nativeLanguage,
      learningGoal: learningGoal,
      dailyStudyMin: dailyStudyMin,
    );
    await _storeTokens(result['accessToken'], result['refreshToken']);
    return result['user'];
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final result = await _api.login(email: email, password: password);
    await _storeTokens(result['accessToken'], result['refreshToken']);
    return result['user'];
  }

  Future<void> logout() async {
    try {
      await _api.logout();
    } catch (_) {}
    await _storage.deleteAll();
  }

  Future<void> grantConsent({
    required bool voiceRecording,
    required bool dataProcessing,
  }) async {
    await _api.grantConsent(
      voiceRecording: voiceRecording,
      dataProcessing: dataProcessing,
    );
  }

  Future<void> _storeTokens(String? access, String? refresh) async {
    if (access != null) {
      await _storage.write(key: 'access_token', value: access);
    }
    if (refresh != null) {
      await _storage.write(key: 'refresh_token', value: refresh);
    }
  }
}
