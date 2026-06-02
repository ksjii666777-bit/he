import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

class AuthCheckRequested extends AuthEvent {}

class LoginSubmitted extends AuthEvent {
  final String email;
  final String password;

  const LoginSubmitted(this.email, this.password);

  @override
  List<Object?> get props => [email, password];
}

class RegisterSubmitted extends AuthEvent {
  final String email;
  final String password;
  final String name;
  final int age;
  final String countryCode;
  final String nativeLanguage;
  final String learningGoal;
  final int dailyStudyMin;

  const RegisterSubmitted({
    required this.email,
    required this.password,
    required this.name,
    required this.age,
    required this.countryCode,
    required this.nativeLanguage,
    required this.learningGoal,
    required this.dailyStudyMin,
  });

  @override
  List<Object?> get props => [
        email,
        password,
        name,
        age,
        countryCode,
        nativeLanguage,
        learningGoal,
        dailyStudyMin,
      ];
}

class ConsentSubmitted extends AuthEvent {
  final bool voiceRecording;
  final bool dataProcessing;

  const ConsentSubmitted(this.voiceRecording, this.dataProcessing);

  @override
  List<Object?> get props => [voiceRecording, dataProcessing];
}

class LogoutRequested extends AuthEvent {}
