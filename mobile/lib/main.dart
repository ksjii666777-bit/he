import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'app.dart';
import 'features/auth/bloc/auth_bloc.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/data/auth_api.dart';
import 'core/api/api_client.dart';
import 'core/storage/secure_storage.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  final storage = SecureStorage();
  final apiClient = ApiClient(
    baseUrl: const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:3000',
    ),
  );
  final authApi = AuthApi(apiClient);
  final authRepository = AuthRepository(authApi, storage);

  runApp(
    BlocProvider(
      create: (_) => AuthBloc(authRepository)..add(AuthCheckRequested()),
      child: const HeApp(),
    ),
  );
}
