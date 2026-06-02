import 'package:flutter_bloc/flutter_bloc.dart';
import 'auth_event.dart';
import 'auth_state.dart';
import '../data/auth_repository.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final AuthRepository _repository;

  AuthBloc(this._repository) : super(AuthInitial()) {
    on<AuthCheckRequested>(_onCheckAuth);
    on<LoginSubmitted>(_onLogin);
    on<RegisterSubmitted>(_onRegister);
    on<ConsentSubmitted>(_onConsent);
    on<LogoutRequested>(_onLogout);
  }

  Future<void> _onCheckAuth(
      AuthCheckRequested event, Emitter<AuthState> emit) async {
    final loggedIn = await _repository.isLoggedIn();
    if (loggedIn) {
      emit(const Authenticated({}));
    } else {
      emit(AuthUnauthenticated());
    }
  }

  Future<void> _onLogin(
      LoginSubmitted event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final user = await _repository.login(
        email: event.email,
        password: event.password,
      );
      emit(Authenticated(user));
    } catch (e) {
      emit(AuthError('Login failed: ${e.toString()}'));
    }
  }

  Future<void> _onRegister(
      RegisterSubmitted event, Emitter<AuthState> emit) async {
    emit(AuthLoading());
    try {
      final user = await _repository.register(
        email: event.email,
        password: event.password,
        name: event.name,
        age: event.age,
        countryCode: event.countryCode,
        nativeLanguage: event.nativeLanguage,
        learningGoal: event.learningGoal,
        dailyStudyMin: event.dailyStudyMin,
      );
      emit(ConsentRequired(user));
    } catch (e) {
      emit(AuthError('Registration failed: ${e.toString()}'));
    }
  }

  Future<void> _onConsent(
      ConsentSubmitted event, Emitter<AuthState> emit) async {
    try {
      await _repository.grantConsent(
        voiceRecording: event.voiceRecording,
        dataProcessing: event.dataProcessing,
      );
      final current = state;
      if (current is ConsentRequired) {
        emit(Authenticated(current.user));
      }
    } catch (e) {
      emit(AuthError('Consent failed: ${e.toString()}'));
    }
  }

  Future<void> _onLogout(
      LogoutRequested event, Emitter<AuthState> emit) async {
    await _repository.logout();
    emit(AuthUnauthenticated());
  }
}
