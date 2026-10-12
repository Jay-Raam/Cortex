import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/chat_screen.dart';

void main() {
  runApp(const ProviderScope(child: KrakenAiApp()));
}

class KrakenAiApp extends StatelessWidget {
  const KrakenAiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kraken',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.light,
        scaffoldBackgroundColor: const Color(0xFFF7F7F5),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFF111111),
          secondary: Color(0xFF222222),
          surface: Color(0xFFFFFFFF),
          background: Color(0xFFF7F7F5),
        ),
        fontFamily: 'sans-serif',
        useMaterial3: true,
      ),
      home: const ChatScreen(),
    );
  }
}
