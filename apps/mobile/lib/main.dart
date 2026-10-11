import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/chat_screen.dart';

void main() {
  runApp(const ProviderScope(child: NexaAiApp()));
}

class NexaAiApp extends StatelessWidget {
  const NexaAiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nexa AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF090D12),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF10B981),
          secondary: Color(0xFF34D399),
          surface: Color(0xFF0F1722),
        ),
        useMaterial3: true,
      ),
      home: const ChatScreen(),
    );
  }
}
