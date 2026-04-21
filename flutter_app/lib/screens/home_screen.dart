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
      backgroundColor: const Color(0xFF0A0A12),
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
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeroSection(context, provider),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Input card
                _buildInputCard(context, provider),

                if (provider.hasData) ...[
                  const SizedBox(height: 20),
                  _buildSuccessCard(context, provider),
                ],

                const SizedBox(height: 32),
                _buildHowItWorks(),
                const SizedBox(height: 16),
                _buildFeaturesRow(),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Hero ───────────────────────────────────────────────────────────────────
  Widget _buildHeroSection(BuildContext context, RestaurantProvider provider) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 36, 24, 28),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F0F1E), Color(0xFF141428), Color(0xFF0A1628)],
          stops: [0.0, 0.5, 1.0],
        ),
      ),
      child: Column(
        children: [
          // Top bar
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFF6B35).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: const Color(0xFFFF6B35).withValues(alpha: 0.4)),
                    ),
                    child: const Text('🍴', style: TextStyle(fontSize: 18)),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Menu2Media',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
              Builder(
                builder: (ctx) => GestureDetector(
                  onTap: () => Navigator.push(ctx,
                      MaterialPageRoute(
                          builder: (_) => const CampaignsListScreen())),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.1)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.history_rounded,
                            color: Colors.white54, size: 15),
                        SizedBox(width: 6),
                        Text('History',
                            style:
                                TextStyle(color: Colors.white54, fontSize: 13)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 36),

          // Headline with gradient
          ShaderMask(
            shaderCallback: (bounds) => const LinearGradient(
              colors: [Color(0xFFFF6B35), Color(0xFFFFAB76), Color(0xFF4ECDC4)],
              stops: [0.0, 0.5, 1.0],
            ).createShader(bounds),
            child: const Text(
              'Restaurant\nCreatives AI',
              style: TextStyle(
                fontSize: 44,
                fontWeight: FontWeight.w900,
                color: Colors.white,
                height: 1.1,
                letterSpacing: -0.5,
              ),
              textAlign: TextAlign.center,
            ),
          ),

          const SizedBox(height: 14),

          const Text(
            'Paste your restaurant URL and get\npremium social media banners instantly',
            style: TextStyle(
              color: Color(0xFF7A7A9A),
              fontSize: 14.5,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 22),

          // Platform chips
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _platformChip('📸', 'Instagram'),
              const SizedBox(width: 8),
              _platformChip('📘', 'Facebook'),
              const SizedBox(width: 8),
              _platformChip('💬', 'WhatsApp'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _platformChip(String emoji, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 12)),
          const SizedBox(width: 5),
          Text(label,
              style: const TextStyle(color: Color(0xFF6A6A8A), fontSize: 12)),
        ],
      ),
    );
  }

  // ── Input Card ─────────────────────────────────────────────────────────────
  Widget _buildInputCard(BuildContext context, RestaurantProvider provider) {
    return Container(
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF12121E),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF1E1E32)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: UrlInputForm(
        isLoading: provider.isLoading,
        onSubmit: (url, name) => provider.scrapeRestaurant(url, name),
      ),
    );
  }

  // ── Success Card ───────────────────────────────────────────────────────────
  Widget _buildSuccessCard(BuildContext context, RestaurantProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1F17),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: const Color(0xFF4ECDC4).withValues(alpha: 0.35), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF4ECDC4).withValues(alpha: 0.06),
            blurRadius: 16,
            spreadRadius: 1,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: const Color(0xFF4ECDC4).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle_rounded,
                    color: Color(0xFF4ECDC4), size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      provider.restaurant?.name ?? 'Restaurant',
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      '${provider.menuItems.length} menu items ready',
                      style: const TextStyle(
                          color: Color(0xFF4ECDC4), fontSize: 12),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF4ECDC4).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${provider.menuItems.length}',
                  style: const TextStyle(
                    color: Color(0xFF4ECDC4),
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const MenuPreviewScreen())),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF6B35),
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.auto_awesome_rounded,
                      color: Colors.white, size: 18),
                  SizedBox(width: 8),
                  Text('Preview & Configure Campaign',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── How It Works ───────────────────────────────────────────────────────────
  Widget _buildHowItWorks() {
    final steps = [
      {
        'icon': '🌐',
        'title': 'Paste URL',
        'desc': 'Enter any restaurant website URL',
        'color': const Color(0xFFFF6B35),
      },
      {
        'icon': '🤖',
        'title': 'AI Scrapes',
        'desc': 'Extract the full menu automatically',
        'color': const Color(0xFF4ECDC4),
      },
      {
        'icon': '🎨',
        'title': 'Configure',
        'desc': 'Choose format, theme & campaign type',
        'color': const Color(0xFFE040FB),
      },
      {
        'icon': '📲',
        'title': 'Download',
        'desc': 'Get branded social media creatives',
        'color': const Color(0xFFFFD700),
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Text(
              'How it works',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 17,
              ),
            ),
            SizedBox(width: 8),
            Expanded(
              child: Divider(color: Color(0xFF1E1E32), height: 1),
            ),
          ],
        ),
        const SizedBox(height: 16),
        ...steps.asMap().entries.map((e) {
          final step = e.value;
          final color = step['color'] as Color;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: color.withValues(alpha: 0.2)),
                  ),
                  child: Center(
                    child: Text(step['icon'] as String,
                        style: const TextStyle(fontSize: 20)),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        step['title'] as String,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        step['desc'] as String,
                        style: const TextStyle(
                            color: Color(0xFF5A5A7A), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '${e.key + 1}',
                      style: TextStyle(
                        color: color,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  // ── Feature Pills ──────────────────────────────────────────────────────────
  Widget _buildFeaturesRow() {
    final features = [
      {'icon': Icons.bolt_rounded, 'label': 'Instant', 'color': const Color(0xFFFFD700)},
      {'icon': Icons.palette_rounded, 'label': 'AI Design', 'color': const Color(0xFF4ECDC4)},
      {'icon': Icons.download_rounded, 'label': 'Export Ready', 'color': const Color(0xFFE040FB)},
    ];

    return Row(
      children: features.map((f) {
        final color = f['color'] as Color;
        return Expanded(
          child: Container(
            margin: features.indexOf(f) < features.length - 1
                ? const EdgeInsets.only(right: 10)
                : EdgeInsets.zero,
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: color.withValues(alpha: 0.15)),
            ),
            child: Column(
              children: [
                Icon(f['icon'] as IconData, color: color, size: 20),
                const SizedBox(height: 6),
                Text(
                  f['label'] as String,
                  style: TextStyle(
                    color: color.withValues(alpha: 0.9),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  // ── Error View ─────────────────────────────────────────────────────────────
  Widget _buildErrorView(BuildContext context, RestaurantProvider provider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF1F0A0A),
                shape: BoxShape.circle,
                border: Border.all(
                    color: const Color(0xFFFF4757).withValues(alpha: 0.4)),
              ),
              child: const Icon(Icons.link_off_rounded,
                  color: Color(0xFFFF4757), size: 40),
            ),
            const SizedBox(height: 20),
            const Text(
              'Scraping Failed',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF1A0E0E),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: const Color(0xFFFF4757).withValues(alpha: 0.2)),
              ),
              child: Text(
                provider.error ?? 'An unknown error occurred',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFAA7070), fontSize: 13),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: () => provider.clear(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFF6B35),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.refresh_rounded, color: Colors.white, size: 18),
                    SizedBox(width: 8),
                    Text('Try Again',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
