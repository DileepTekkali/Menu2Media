import 'package:flutter_test/flutter_test.dart';

import 'package:restaurant_creatives/main.dart';

void main() {
  testWidgets('home screen renders restaurant URL form',
      (WidgetTester tester) async {
    await tester.pumpWidget(const RestaurantCreativesApp());

    expect(find.text('Restaurant Website URL'), findsOneWidget);
    expect(find.text('Restaurant Name (optional)'), findsOneWidget);
    expect(find.text('Start Scraping'), findsOneWidget);
  });
}
