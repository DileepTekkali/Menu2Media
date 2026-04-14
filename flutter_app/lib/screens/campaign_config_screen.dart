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

  final _campaignTypes = {
    'daily': 'Daily Specials',
    'weekend': 'Weekend Deals',
    'festive': 'Festive Specials',
    'combo': 'Combo Offers',
  };

  final _platforms = {
    'instagram': {'icon': Icons.camera_alt, 'label': 'Instagram'},
    'facebook': {'icon': Icons.facebook, 'label': 'Facebook'},
    'whatsapp': {'icon': Icons.chat, 'label': 'WhatsApp'},
  };

  void _generateCampaign() async {
    final restaurantProvider = context.read<RestaurantProvider>();
    final campaignProvider = context.read<CampaignProvider>();

    if (restaurantProvider.restaurant == null) return;

    await campaignProvider.createCampaign(
      restaurantId: restaurantProvider.restaurant!.id,
      campaignType: _campaignType,
      formats: _getFormatsForPlatforms(),
      dishCount: _dishCount,
    );

    if (campaignProvider.error == null && mounted) {
      await campaignProvider.loadCampaignCreatives(
        campaignProvider.activeCampaign!.id,
      );

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => const CreativesGalleryScreen(),
          ),
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
        formats.add('instagram_square');
      }
    }
    return formats;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Configure Campaign')),
      body: Consumer<CampaignProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return LoadingIndicator(
              message: _getProgressMessage(provider.progress),
              progress: provider.progress,
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildSection('Campaign Type', _buildCampaignTypeSelector()),
                const SizedBox(height: 24),
                _buildSection('Platforms', _buildPlatformSelector()),
                const SizedBox(height: 24),
                _buildSection('Number of Dishes', _buildDishCountSlider()),
                const SizedBox(height: 24),
                _buildPreview(),
                const SizedBox(height: 32),
                SizedBox(
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _generateCampaign,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).primaryColor,
                      foregroundColor: Colors.white,
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.auto_awesome),
                        SizedBox(width: 8),
                        Text(
                          'Generate Creatives',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _getProgressMessage(double progress) {
    if (progress < 0.3) return 'Selecting dishes...';
    if (progress < 0.5) return 'Generating captions...';
    if (progress < 0.7) return 'Creating images...';
    if (progress < 0.9) return 'Building creatives...';
    return 'Almost done...';
  }

  Widget _buildSection(String title, Widget content) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        content,
      ],
    );
  }

  Widget _buildCampaignTypeSelector() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _campaignTypes.entries.map((entry) {
        final isSelected = _campaignType == entry.key;
        return ChoiceChip(
          label: Text(entry.value),
          selected: isSelected,
          onSelected: (selected) {
            if (selected) {
              setState(() => _campaignType = entry.key);
            }
          },
        );
      }).toList(),
    );
  }

  Widget _buildPlatformSelector() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _platforms.entries.map((entry) {
        final isSelected = _selectedPlatforms.contains(entry.key);
        return FilterChip(
          avatar: Icon(entry.value['icon'] as IconData, size: 18),
          label: Text(entry.value['label'] as String),
          selected: isSelected,
          onSelected: (selected) {
            setState(() {
              if (selected) {
                _selectedPlatforms.add(entry.key);
              } else {
                _selectedPlatforms.remove(entry.key);
              }
            });
          },
        );
      }).toList(),
    );
  }

  Widget _buildDishCountSlider() {
    return Column(
      children: [
        Slider(
          value: _dishCount.toDouble(),
          min: 3,
          max: 10,
          divisions: 7,
          label: '$_dishCount dishes',
          onChanged: (value) {
            setState(() => _dishCount = value.round());
          },
        ),
        Text(
          '$_dishCount dishes will be selected for this campaign',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _buildPreview() {
    final restaurantProvider = context.read<RestaurantProvider>();
    final formats = _getFormatsForPlatforms();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Campaign Preview',
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            _buildPreviewRow(
              'Restaurant',
              restaurantProvider.restaurant?.name ?? '-',
            ),
            _buildPreviewRow('Campaign', _campaignTypes[_campaignType] ?? '-'),
            _buildPreviewRow('Platforms', _selectedPlatforms.join(', ')),
            _buildPreviewRow('Formats', '${formats.length} formats'),
            _buildPreviewRow(
              'Est. Creatives',
              '${_dishCount * formats.length}',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreviewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          Text(value, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
