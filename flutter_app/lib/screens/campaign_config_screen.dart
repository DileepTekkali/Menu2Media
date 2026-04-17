import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/restaurant_provider.dart';
import '../providers/campaign_provider.dart';
import '../models/menu_item.dart';
import '../widgets/loading_indicator.dart';
import 'creatives_gallery_screen.dart';

class CampaignConfigScreen extends StatefulWidget {
  const CampaignConfigScreen({super.key});

  @override
  State<CampaignConfigScreen> createState() => _CampaignConfigScreenState();
}

class _CampaignConfigScreenState extends State<CampaignConfigScreen> {
  String _campaignType = 'daily';
  final Set<String> _selectedSizes = {'square'};
  final Set<String> _selectedDishIds = {};
  List<MenuItem> _menuItems = [];
  bool _loadingMenu = true;

  final _campaignTypes = {
    'daily': {'label': 'Daily Specials', 'icon': '☀️'},
    'new_arrivals': {'label': 'New Arrivals', 'icon': '🆕'},
    'weekend': {'label': 'Weekend Deals', 'icon': '🎉'},
    'festive': {'label': 'Festive Specials', 'icon': '✨'},
    'combo': {'label': 'Combo Offers', 'icon': '🤝'},
  };

  final _sizes = {
    'square': {
      'label': 'Square',
      'icon': Icons.crop_square,
      'desc': '1080×1080'
    },
    'story': {
      'label': 'Story',
      'icon': Icons.crop_portrait,
      'desc': '1080×1920'
    },
    'landscape': {
      'label': 'Landscape',
      'icon': Icons.crop_landscape,
      'desc': '1920×1080'
    },
  };

  @override
  void initState() {
    super.initState();
    _loadMenuItems();
  }

  Future<void> _loadMenuItems() async {
    final restaurantProvider = context.read<RestaurantProvider>();
    if (restaurantProvider.restaurant != null) {
      final items = await restaurantProvider.getMenuItems();
      setState(() {
        _menuItems = items;
        _loadingMenu = false;
      });
    }
  }

  void _toggleDish(String dishId) {
    setState(() {
      if (_selectedDishIds.contains(dishId)) {
        _selectedDishIds.remove(dishId);
      } else if (_selectedDishIds.length < 5) {
        _selectedDishIds.add(dishId);
      }
    });
  }

  void _toggleSize(String size) {
    setState(() {
      if (_selectedSizes.contains(size)) {
        if (_selectedSizes.length > 1) {
          _selectedSizes.remove(size);
        }
      } else {
        _selectedSizes.add(size);
      }
    });
  }

  void _generateCampaign() async {
    final restaurantProvider = context.read<RestaurantProvider>();
    final campaignProvider = context.read<CampaignProvider>();

    if (restaurantProvider.restaurant == null) return;
    if (_selectedDishIds.isEmpty) return;

    final selectedDishes = _menuItems
        .where((item) => _selectedDishIds.contains(item.id))
        .map((item) => {
              'id': item.id,
              'name': item.name,
              'description': item.description,
              'price': item.price,
              'category': item.category,
              'image_url': item.imageUrl,
            })
        .toList();

    await campaignProvider.createCampaignWithDishes(
      restaurantId: restaurantProvider.restaurant!.id,
      campaignType: _campaignType,
      dishes: selectedDishes,
      formats: _selectedSizes.toList(),
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
                _buildSection('📐 Image Sizes', _buildSizeSelector()),
                const SizedBox(height: 20),
                _buildSection(
                    '🍽️ Select Dishes (${_selectedDishIds.length}/5)',
                    _buildDishSelector()),
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

  Widget _buildSizeSelector() {
    return Row(
      children: _sizes.entries.map((e) {
        final selected = _selectedSizes.contains(e.key);
        return Expanded(
          child: GestureDetector(
            onTap: () => _toggleSize(e.key),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: EdgeInsets.only(right: e.key != 'landscape' ? 8 : 0),
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: selected
                    ? const Color(0xFF4ECDC4).withValues(alpha: 0.2)
                    : const Color(0xFF1A1A2E),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: selected ? const Color(0xFF4ECDC4) : Colors.white24,
                  width: selected ? 2 : 1,
                ),
              ),
              child: Column(
                children: [
                  Icon(
                    e.value['icon'] as IconData,
                    size: 32,
                    color: selected ? const Color(0xFF4ECDC4) : Colors.white54,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    e.value['label'] as String,
                    style: TextStyle(
                        color:
                            selected ? const Color(0xFF4ECDC4) : Colors.white60,
                        fontWeight:
                            selected ? FontWeight.bold : FontWeight.normal),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    e.value['desc'] as String,
                    style: const TextStyle(color: Colors.white38, fontSize: 10),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildDishSelector() {
    if (_loadingMenu) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFFF6B35)),
      );
    }

    if (_menuItems.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Text(
            'No menu items available. Please scrape restaurant first.',
            style: TextStyle(color: Colors.white54)),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF2A2A3E),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline,
                  color: Color(0xFF4ECDC4), size: 16),
              const SizedBox(width: 8),
              Text(
                'Select up to 5 dishes',
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.7), fontSize: 12),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ...(_menuItems.map((item) => _buildDishTile(item))),
      ],
    );
  }

  Widget _buildDishTile(MenuItem item) {
    final isSelected = _selectedDishIds.contains(item.id);
    final isDisabled = !isSelected && _selectedDishIds.length >= 5;

    return GestureDetector(
      onTap: isDisabled ? null : () => _toggleDish(item.id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFFF6B35).withValues(alpha: 0.2)
              : (isDisabled
                  ? const Color(0xFF12121E)
                  : const Color(0xFF1A1A2E)),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFFFF6B35) : Colors.white12,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color:
                    isSelected ? const Color(0xFFFF6B35) : Colors.transparent,
                border: Border.all(
                  color: isSelected ? const Color(0xFFFF6B35) : Colors.white38,
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check, color: Colors.white, size: 16)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14),
                  ),
                  if ((item.description ?? '').isNotEmpty)
                    Text(
                      item.description ?? '',
                      style:
                          const TextStyle(color: Colors.white54, fontSize: 12),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            if ((item.price ?? 0) > 0)
              Text(
                '\$${(item.price ?? 0).toStringAsFixed(2)}',
                style: const TextStyle(
                    color: Color(0xFF4ECDC4), fontWeight: FontWeight.w600),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreviewCard() {
    final restaurantProvider = context.read<RestaurantProvider>();
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
          _previewRow('Sizes',
              _selectedSizes.map((s) => _sizes[s]?['label'] ?? s).join(', ')),
          _previewRow('Dishes Selected', '${_selectedDishIds.length}'),
          _previewRow('Est. Creatives',
              '${_selectedDishIds.length * _selectedSizes.length}'),
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
    final canGenerate =
        _selectedSizes.isNotEmpty && _selectedDishIds.isNotEmpty;
    return SizedBox(
      height: 56,
      child: ElevatedButton(
        onPressed: canGenerate ? _generateCampaign : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFFF6B35),
          disabledBackgroundColor: Colors.white12,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.auto_awesome, color: Colors.white),
            const SizedBox(width: 10),
            Text(
              _selectedDishIds.isEmpty
                  ? 'Select dishes first'
                  : 'Generate Creatives',
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
    );
  }

  String _getProgressMessage(double progress) {
    if (progress < 0.2) return 'Preparing selected dishes...';
    if (progress < 0.4) return 'Generating captions with AI...';
    if (progress < 0.65) return 'Creating food images...';
    if (progress < 0.85) return 'Building branded creatives...';
    return 'Finalizing campaign...';
  }
}
