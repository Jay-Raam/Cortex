import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nexa_ai_mobile/main.dart';

void main() {
  testWidgets('Nexa AI mobile app loads chat screen', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: NexaAiApp(),
      ),
    );

    // Verify presence of input field
    expect(find.text('Message Nexa...'), findsOneWidget);
  });
}
