import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/restaurant_provider.dart';
import '../providers/campaign_provider.dart';
import '../widgets/loading_indicator.dart';
import 'creatives_gallery_screen.dart';

class CampaignConfigScreen extends StatefulWidget {
  const CampaignConfigScreen({super.key});

  @override
  State<CampaignConfigScreen> createState() => _CampaignConfigScreenState();
}

class _CampaignConfigScreenState extends State<CampaignConfigScreen> {
  String _campaignType = 'daily';
  final Set<String> _selectedPlatforms = {'instagram'};
  int _dishCount = 5;
  String _tone = 'casual';
  String _theme = 'casual';
  List<String> _selectedColors = ['#FF6B35', '#2E4057'];

  final _campaignTypes = {
    'daily': {'label': 'Daily Specials', 'icon': '☀️'},
    'new_arrivals': {'label': 'New Arrivals', 'icon': '🆕'},
    'weekend': {'label': 'Weekend Deals', 'icon': '🎉'},
    'festive': {'label': 'Festive Specials', 'icon': '✨'},
    'combo': {'label': 'Combo Offers', 'icon': '🤝'},
  };

  final _platforms = {
    'instagram': {'icon': Icons.camera_alt, 'label': 'Instagram'},
    'facebook': {'icon': Icons.facebook, 'label': 'Facebook'},
    'whatsapp': {'icon': Icons.chat, 'label': 'WhatsApp'},
  };

  final _tones = {
    'casual': '😊 Casual',
    'formal': '🎩 Formal',
    'festive': '🎊 Festive',
    'playful': '🎈 Playful',
  };

  final _themes = {
    'casual': '☕ Casual Cafe',
    'luxury': '🍷 Luxury Dining',
    'fast_food': '🍔 Fast Food',
    'indian_ethnic': '🪔 Indian Ethnic',
  };

  final List<Map<String, dynamic>> _colorPalettes = [
    {
      'name': 'Spice',
      'colors': ['#FF6B35', '#2E4057']
    },
    {
      'name': 'Ocean',
      'colors': ['#0077B6', '#00B4D8']
    },
    {
      'name': 'Forest',
      'colors': ['#1B4332', '#52B788']
    },
    {
      'name': 'Sunset',
      'colors': ['#F72585', '#7209B7']
    },
    {
      'name': 'Gold',
      'colors': ['#B5451B', '#F4A261']
    },
    {
      'name': 'Night',
      'colors': ['#0D1B2A', '#E43F6F']
    },
  ];

  void _generateCampaign() async {
    final restaurantProvider = context.read<RestaurantProvider>();
    final campaignProvider = context.read<CampaignProvider>();

    if (restaurantProvider.restaurant == null) return;

    // Save branding to provider
    restaurantProvider.setBrandColors(_selectedColors);
    restaurantProvider.setTheme(_theme);
    restaurantProvider.setTone(_tone);

    await campaignProvider.createCampaign(
      restaurantId: restaurantProvider.restaurant!.id,
      campaignType: _campaignType,
      formats: _getFormatsForPlatforms(),
      dishCount: _dishCount,
      tone: _tone,
      colors: _selectedColors,
    );

    if (campaignProvider.error == null && mounted) {
      await campaignProvider.loadCampaignCreatives(
        campaignProvider.activeCampaign!.id,
      );
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const CreativesGalleryScreen()),
        );
      }
    }
  }

  List<String> _getFormatsForPlatforms() {
    final formats = <String>[];
    for (final platform in _selectedPlatforms) {
      if (platform == 'instagram') {
        formats.addAll(['instagram_square', 'instagram_story']);
      } else if (platform == 'facebook') {
        formats.add('facebook_post');
      } else if (platform == 'whatsapp') {
        formats.add('whatsapp_post');
      }
    }
    return formats.toSet().toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A2E),
        foregroundColor: Colors.white,
        title: const Text('Configure Campaign',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        elevation: 0,
      ),
      body: Consumer<CampaignProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return LoadingIndicator(
              message: _getProgressMessage(provider.progress),
              progress: provider.progress,
            );
          }

          if (provider.error != null) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline,
                        color: Color(0xFFFF6B35), size: 60),
                    const SizedBox(height: 16),
                    Text(provider.error!,
                        style: const TextStyle(color: Colors.white70),
                        textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () {
                        provider.clear();
                        Navigator.pop(context);
                      },
                      style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFFF6B35)),
                      child: const Text('Go Back',
                          style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              ),
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildSection('🎯 Campaign Type', _buildCampaignTypeSelector()),
                const SizedBox(height: 20),
                _buildSection('📱 Platforms', _buildPlatformSelector()),
                const SizedBox(height: 20),
                _buildSection('🍽️ Number of Dishes', _buildDishCountSlider()),
                const SizedBox(height: 20),
                _buildSection('🎨 Brand Colors', _buildColorPicker()),
                const SizedBox(height: 20),
                _buildSection('🖼️ Theme', _buildThemeSelector()),
                const SizedBox(height: 20),
                _buildSection('✍️ Caption Tone', _buildToneSelector()),
                const SizedBox(height: 20),
                _buildPreviewCard(),
                const SizedBox(height: 28),
                _buildGenerateButton(),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildSection(String title, Widget content) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        content,
      ],
    );
  }

  Widget _buildCampaignTypeSelector() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: _campaignTypes.entries.map((e) {
        final selected = _campaignType == e.key;
        return GestureDetector(
          onTap: () => setState(() => _campaignType = e.key),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color:
                  selected ? const Color(0xFFFF6B35) : const Color(0xFF1A1A2E),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selected ? const Color(0xFFFF6B35) : Colors.white24,
              ),
            ),
            child: Text('${e.value['icon']} ${e.value['label']}',
                style: TextStyle(
                    color: selected ? Colors.white : Colors.white60,
                    fontWeight:
                        selected ? FontWeight.bold : FontWeight.normal)),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildPlatformSelector() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: _platforms.entries.map((e) {
        final selected = _selectedPlatforms.contains(e.key);
        return GestureDetector(
          onTap: () => setState(() {
            if (selected) {
              _selectedPlatforms.remove(e.key);
            } else {
              _selectedPlatforms.add(e.key);
            }
          }),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: selected
                  ? const Color(0xFF4ECDC4).withValues(alpha: 0.2)
                  : const Color(0xFF1A1A2E),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selected ? const Color(0xFF4ECDC4) : Colors.white24,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(e.value['icon'] as IconData,
                    size: 18,
                    color: selected ? const Color(0xFF4ECDC4) : Colors.white54),
                const SizedBox(width: 6),
                Text(e.value['label'] as String,
                    style: TextStyle(
                        color:
                            selected ? const Color(0xFF4ECDC4) : Colors.white60,
                        fontWeight:
                            selected ? FontWeight.bold : FontWeight.normal)),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildDishCountSlider() {
    return Column(
      children: [
        SliderTheme(
          data: SliderThemeData(
            activeTrackColor: const Color(0xFFFF6B35),
            inactiveTrackColor: Colors.white12,
            thumbColor: const Color(0xFFFF6B35),
            overlayColor: const Color(0xFFFF6B35).withValues(alpha: 0.2),
            valueIndicatorColor: const Color(0xFFFF6B35),
            valueIndicatorTextStyle: const TextStyle(color: Colors.white),
          ),
          child: Slider(
            value: _dishCount.toDouble(),
            min: 3,
            max: 10,
            divisions: 7,
            label: '$_dishCount',
            onChanged: (v) => setState(() => _dishCount = v.round()),
          ),
        ),
        Text('$_dishCount dishes selected for this campaign',
            style: const TextStyle(color: Colors.white54, fontSize: 13)),
      ],
    );
  }

  Widget _buildColorPicker() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: _colorPalettes.map((palette) {
        final colors = palette['colors'] as List<String>;
        final selected = _selectedColors[0] == colors[0];
        return GestureDetector(
          onTap: () => setState(() => _selectedColors = colors),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 72,
            height: 44,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_hexColor(colors[0]), _hexColor(colors[1])],
              ),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selected ? Colors.white : Colors.transparent,
                width: selected ? 2.5 : 0,
              ),
              boxShadow: selected
                  ? [
                      BoxShadow(
                          color: _hexColor(colors[0]).withValues(alpha: 0.5),
                          blurRadius: 8)
                    ]
                  : [],
            ),
            child: selected
                ? const Center(
                    child: Icon(Icons.check, color: Colors.white, size: 20))
                : Center(
                    child: Text(palette['name'] as String,
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 10))),
          ),
        );
      }).toList(),
    );
  }

  Color _hexColor(String hex) {
    try {
      return Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16));
    } catch (_) {
      return const Color(0xFFFF6B35);
    }
  }

  Widget _buildThemeSelector() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: _themes.entries.map((e) {
        final selected = _theme == e.key;
        return GestureDetector(
          onTap: () => setState(() => _theme = e.key),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: selected
                  ? const Color(0xFFE040FB).withValues(alpha: 0.2)
                  : const Color(0xFF1A1A2E),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selected ? const Color(0xFFE040FB) : Colors.white24,
              ),
            ),
            child: Text(e.value,
                style: TextStyle(
                    color: selected ? const Color(0xFFE040FB) : Colors.white60,
                    fontWeight:
                        selected ? FontWeight.bold : FontWeight.normal)),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildToneSelector() {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: _tones.entries.map((e) {
        final selected = _tone == e.key;
        return GestureDetector(
          onTap: () => setState(() => _tone = e.key),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: selected
                  ? const Color(0xFF4ECDC4).withValues(alpha: 0.15)
                  : const Color(0xFF1A1A2E),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: selected ? const Color(0xFF4ECDC4) : Colors.white24,
              ),
            ),
            child: Text(e.value,
                style: TextStyle(
                    color: selected ? const Color(0xFF4ECDC4) : Colors.white60,
                    fontWeight:
                        selected ? FontWeight.bold : FontWeight.normal)),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildPreviewCard() {
    final restaurantProvider = context.read<RestaurantProvider>();
    final formats = _getFormatsForPlatforms();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('📋 Campaign Summary',
              style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 15)),
          const SizedBox(height: 12),
          _previewRow('Restaurant', restaurantProvider.restaurant?.name ?? '-'),
          _previewRow(
              'Campaign', _campaignTypes[_campaignType]?['label'] ?? '-'),
          _previewRow('Platforms', _selectedPlatforms.join(', ')),
          _previewRow('Tone', _tones[_tone] ?? '-'),
          _previewRow('Theme', _themes[_theme] ?? '-'),
          _previewRow('Formats', '${formats.length} format(s)'),
          _previewRow('Est. Creatives', '${_dishCount * formats.length}'),
        ],
      ),
    );
  }

  Widget _previewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(color: Colors.white54, fontSize: 13)),
          Text(value,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildGenerateButton() {
    return SizedBox(
      height: 56,
      child: ElevatedButton(
        onPressed: _selectedPlatforms.isEmpty ? null : _generateCampaign,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFFF6B35),
          disabledBackgroundColor: Colors.white12,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.auto_awesome, color: Colors.white),
            SizedBox(width: 10),
            Text('Generate Creatives',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  String _getProgressMessage(double progress) {
    if (progress < 0.2) return 'Selecting best dishes...';
    if (progress < 0.4) return 'Generating captions with AI...';
    if (progress < 0.65) return 'Creating food images...';
    if (progress < 0.85) return 'Building branded creatives...';
    return 'Finalizing campaign...';
  }
}
