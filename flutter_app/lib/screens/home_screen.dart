import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/restaurant_provider.dart';
import '../widgets/url_input_form.dart';
import '../widgets/loading_indicator.dart';
import 'menu_preview_screen.dart';
import 'campaigns_list_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F1A),
      body: SafeArea(
        child: Consumer<RestaurantProvider>(
          builder: (context, provider, _) {
            if (provider.isLoading) {
              return const LoadingIndicator(message: 'Scraping menu data...');
            }
            if (provider.error != null) {
              return _buildErrorView(context, provider);
            }
            return _buildInputView(context, provider);
          },
        ),
      ),
    );
  }

  Widget _buildInputView(BuildContext context, RestaurantProvider provider) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeroSection(context),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                UrlInputForm(
                  isLoading: provider.isLoading,
                  onSubmit: (url, name) => provider.scrapeRestaurant(url, name),
                ),
                if (provider.hasData) ...[
                  const SizedBox(height: 20),
                  _buildSuccessCard(context, provider),
                ],
                const SizedBox(height: 24),
                _buildHowItWorks(),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroSection(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 40, 24, 32),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1A1A2E), Color(0xFF16213E), Color(0xFF0F3460)],
        ),
      ),
      child: Column(
        children: [
          // Top row: logo + history button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF6B35).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: const Color(0xFFFF6B35).withValues(alpha: 0.5)),
                ),
                child: const Text('🍴', style: TextStyle(fontSize: 24)),
              ),
              Builder(
                  builder: (context) => GestureDetector(
                        onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const CampaignsListScreen())),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white24),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.history,
                                  color: Colors.white70, size: 16),
                              SizedBox(width: 6),
                              Text('History',
                                  style: TextStyle(
                                      color: Colors.white70, fontSize: 13)),
                            ],
                          ),
                        ),
                      )),
            ],
          ),
          const SizedBox(height: 32),
          // Headline
          ShaderMask(
            shaderCallback: (bounds) => const LinearGradient(
              colors: [Color(0xFFFF6B35), Color(0xFF4ECDC4)],
            ).createShader(bounds),
            child: const Text(
              'Restaurant\nCreatives AI',
              style: TextStyle(
                  fontSize: 42,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  height: 1.15),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'Paste your restaurant URL → Get stunning\nsocial media creatives in minutes',
            style: TextStyle(color: Colors.white60, fontSize: 15, height: 1.5),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          // Platform badges
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _platformBadge('📸 Instagram'),
              const SizedBox(width: 8),
              _platformBadge('📘 Facebook'),
              const SizedBox(width: 8),
              _platformBadge('💬 WhatsApp'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _platformBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white12),
      ),
      child: Text(label,
          style: const TextStyle(color: Colors.white60, fontSize: 12)),
    );
  }

  Widget _buildSuccessCard(BuildContext context, RestaurantProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(16),
        border:
            Border.all(color: const Color(0xFF4ECDC4).withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF4ECDC4).withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle,
                    color: Color(0xFF4ECDC4), size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  provider.restaurant?.name ?? 'Restaurant',
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '${provider.menuItems.length} menu items scraped successfully',
            style: const TextStyle(color: Colors.white54, fontSize: 13),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const MenuPreviewScreen())),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF6B35),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.preview, color: Colors.white),
                  SizedBox(width: 8),
                  Text('Preview Menu & Configure',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHowItWorks() {
    final steps = [
      {
        'icon': '🌐',
        'title': 'Paste URL',
        'desc': 'Enter any restaurant website URL'
      },
      {
        'icon': '🤖',
        'title': 'AI Scrapes',
        'desc': 'We extract the full menu automatically'
      },
      {
        'icon': '🎨',
        'title': 'Configure',
        'desc': 'Choose platform, theme & campaign type'
      },
      {
        'icon': '📲',
        'title': 'Download',
        'desc': 'Get branded social media creatives instantly'
      },
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('How it works',
            style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 18)),
        const SizedBox(height: 14),
        ...steps.asMap().entries.map((e) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1A1A2E),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white12),
                    ),
                    child: Center(
                        child: Text(e.value['icon']!,
                            style: const TextStyle(fontSize: 20))),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(e.value['title']!,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 14)),
                        Text(e.value['desc']!,
                            style: const TextStyle(
                                color: Colors.white38, fontSize: 12)),
                      ],
                    ),
                  ),
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF6B35).withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text('${e.key + 1}',
                          style: const TextStyle(
                              color: Color(0xFFFF6B35),
                              fontSize: 11,
                              fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }

  Widget _buildErrorView(BuildContext context, RestaurantProvider provider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('❌', style: TextStyle(fontSize: 64)),
            const SizedBox(height: 16),
            const Text('Scraping Failed',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(
              provider.error ?? 'An unknown error occurred',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60, fontSize: 14),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => provider.clear(),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF6B35),
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Try Again',
                  style: TextStyle(color: Colors.white, fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }
}
