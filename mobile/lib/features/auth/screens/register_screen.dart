import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../bloc/auth_bloc.dart';
import '../bloc/auth_event.dart';
import '../bloc/auth_state.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _ageController = TextEditingController();
  final _countryController = TextEditingController();
  String _nativeLanguage = 'hi';
  String _learningGoal = 'general';
  int _dailyStudyMin = 15;
  bool _obscurePassword = true;

  final _languages = ['hi', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'bn', 'pa', 'en'];
  final _goals = [
    'general',
    'travel',
    'career',
    'exams',
    'migration',
  ];

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _ageController.dispose();
    _countryController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<AuthBloc>().add(
            RegisterSubmitted(
              email: _emailController.text.trim(),
              password: _passwordController.text,
              name: _nameController.text.trim(),
              age: int.parse(_ageController.text.trim()),
              countryCode: _countryController.text.trim().toUpperCase(),
              nativeLanguage: _nativeLanguage,
              learningGoal: _learningGoal,
              dailyStudyMin: _dailyStudyMin,
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: BlocListener<AuthBloc, AuthState>(
          listener: (context, state) {
            if (state is ConsentRequired) {
              context.go('/onboarding');
            }
            if (state is AuthError) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(state.message)),
              );
            }
          },
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 24),
                  Text(
                    'Create account',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Start your language learning journey',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: Colors.grey[600],
                        ),
                  ),
                  const SizedBox(height: 32),
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Name',
                      prefixIcon: Icon(Icons.person_outlined),
                    ),
                    validator: (v) =>
                        v?.isEmpty ?? true ? 'Name is required' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                    validator: (v) =>
                        v?.isEmpty ?? true ? 'Email is required' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    decoration: InputDecoration(
                      labelText: 'Password (min 8 chars)',
                      prefixIcon: const Icon(Icons.lock_outlined),
                      suffixIcon: IconButton(
                        icon: Icon(_obscurePassword
                            ? Icons.visibility_off
                            : Icons.visibility),
                        onPressed: () =>
                            setState(() => _obscurePassword = !_obscurePassword),
                      ),
                    ),
                    validator: (v) =>
                        (v?.length ?? 0) < 8
                            ? 'Password must be at least 8 characters'
                            : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _ageController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Age',
                      prefixIcon: Icon(Icons.calendar_today),
                    ),
                    validator: (v) {
                      final age = int.tryParse(v ?? '');
                      if (age == null || age < 5 || age > 120) {
                        return 'Enter a valid age (5-120)';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _countryController,
                    decoration: const InputDecoration(
                      labelText: 'Country Code (e.g. IN, US)',
                      prefixIcon: Icon(Icons.public),
                    ),
                    validator: (v) =>
                        (v?.length ?? 0) < 2 ? 'Enter a country code' : null,
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: _nativeLanguage,
                    decoration: const InputDecoration(
                      labelText: 'Native Language',
                      prefixIcon: Icon(Icons.language),
                    ),
                    items: _languages
                        .map((l) => DropdownMenuItem(value: l, child: Text(l.toUpperCase())))
                        .toList(),
                    onChanged: (v) => setState(() => _nativeLanguage = v!),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: _learningGoal,
                    decoration: const InputDecoration(
                      labelText: 'Learning Goal',
                      prefixIcon: Icon(Icons.flag_outlined),
                    ),
                    items: _goals
                        .map((g) => DropdownMenuItem(
                            value: g,
                            child: Text(g[0].toUpperCase() + g.substring(1))))
                        .toList(),
                    onChanged: (v) => setState(() => _learningGoal = v!),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    initialValue: '15',
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Study minutes per day',
                      prefixIcon: Icon(Icons.timer_outlined),
                    ),
                    validator: (v) {
                      final min = int.tryParse(v ?? '');
                      if (min == null || min < 5 || min > 180) {
                        return 'Enter 5-180 minutes';
                      }
                      return null;
                    },
                    onChanged: (v) {
                      final parsed = int.tryParse(v);
                      if (parsed != null) _dailyStudyMin = parsed;
                    },
                  ),
                  const SizedBox(height: 32),
                  BlocBuilder<AuthBloc, AuthState>(
                    builder: (context, state) {
                      return ElevatedButton(
                        onPressed: state is AuthLoading ? null : _submit,
                        child: state is AuthLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Create Account'),
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('Already have an account? Sign in'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
