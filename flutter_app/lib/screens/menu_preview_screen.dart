import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/restaurant_provider.dart';
import '../models/menu_item.dart';
import 'campaign_config_screen.dart';

class MenuPreviewScreen extends StatefulWidget {
  const MenuPreviewScreen({super.key});

  @override
  State<MenuPreviewScreen> createState() => _MenuPreviewScreenState();
}

class _MenuPreviewScreenState extends State<MenuPreviewScreen> {
  String _selectedCategory = 'All';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A2E),
        foregroundColor: Colors.white,
        title: const Text(
          'Menu Preview',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        elevation: 0,
      ),
      body: Consumer<RestaurantProvider>(
        builder: (context, provider, _) {
          final items = provider.menuItems;
          if (items.isEmpty) {
            return _buildEmpty(context);
          }

          // Build category list
          final cats = [
            'All',
            ...{...items.map((i) => i.category ?? 'Other')}
          ];
          final filtered = _selectedCategory == 'All'
              ? items
              : items
                  .where((i) => (i.category ?? 'Other') == _selectedCategory)
                  .toList();

          return Column(
            children: [
              _buildHeader(context, provider, items),
              _buildCategoryChips(cats),
              Expanded(child: _buildGrid(filtered)),
              _buildProceedButton(context, provider),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHeader(
      BuildContext context, RestaurantProvider provider, List<MenuItem> items) {
    final bestsellerCount = items.where((i) => i.isBestseller).length;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1A1A2E), Color(0xFF16213E)],
        ),
      ),
      child: Row(
        children: [
          _statPill('${items.length}', 'Items', const Color(0xFFFF6B35)),
          const SizedBox(width: 12),
          _statPill('$bestsellerCount', 'Bestsellers', const Color(0xFF4ECDC4)),
          const SizedBox(width: 12),
          _statPill(
            '${({...items.map((i) => i.category ?? 'Other')}).length}',
            'Categories',
            const Color(0xFFE040FB),
          ),
        ],
      ),
    );
  }

  Widget _statPill(String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Text(value,
              style: TextStyle(
                  color: color, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(width: 4),
          Text(label,
              style:
                  TextStyle(color: color.withValues(alpha: 0.8), fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildCategoryChips(List<String> cats) {
    return Container(
      height: 52,
      color: const Color(0xFF16213E),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        itemCount: cats.length,
        itemBuilder: (context, i) {
          final cat = cats[i];
          final selected = cat == _selectedCategory;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() => _selectedCategory = cat),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFFFF6B35)
                      : const Color(0xFF1A1A2E),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: selected ? const Color(0xFFFF6B35) : Colors.white24,
                  ),
                ),
                child: Text(
                  cat,
                  style: TextStyle(
                    color: selected ? Colors.white : Colors.white70,
                    fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildGrid(List<MenuItem> items) {
    if (items.isEmpty) {
      return const Center(
        child: Text('No items in this category',
            style: TextStyle(color: Colors.white38, fontSize: 16)),
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.85,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: items.length,
      itemBuilder: (context, i) => _buildMenuCard(items[i]),
    );
  }

  Widget _buildMenuCard(MenuItem item) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A2E),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: item.isBestseller ? const Color(0xFFFF6B35) : Colors.white12,
          width: item.isBestseller ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image or placeholder
          Expanded(
            child: ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(14),
                topRight: Radius.circular(14),
              ),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  item.imageUrl != null && item.imageUrl!.isNotEmpty
                      ? Image.network(item.imageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              _imagePlaceholder(item.name))
                      : _imagePlaceholder(item.name),
                  if (item.isBestseller)
                    Positioned(
                      top: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFF6B35),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text('⭐ BEST',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold)),
                      ),
                    ),
                  if (item.price != null)
                    Positioned(
                      bottom: 6,
                      right: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.7),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text('₹${item.price!.toStringAsFixed(0)}',
                            style: const TextStyle(
                                color: Color(0xFFFF6B35),
                                fontSize: 12,
                                fontWeight: FontWeight.bold)),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (item.category != null)
                  Text(
                    item.category!,
                    style: const TextStyle(color: Colors.white38, fontSize: 11),
                    maxLines: 1,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _imagePlaceholder(String name) {
    final colors = [
      [const Color(0xFFFF6B35), const Color(0xFFFFB347)],
      [const Color(0xFF4ECDC4), const Color(0xFF2E8B8B)],
      [const Color(0xFF6B2D8B), const Color(0xFFE040FB)],
      [const Color(0xFF1B4332), const Color(0xFF52B788)],
    ];
    final colorPair = colors[name.length % colors.length];
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
            colors: colorPair,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('🍽️', style: TextStyle(fontSize: 32)),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                name,
                style: const TextStyle(color: Colors.white70, fontSize: 11),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('🍽️', style: TextStyle(fontSize: 64)),
          const SizedBox(height: 16),
          const Text('No menu items found',
              style: TextStyle(color: Colors.white70, fontSize: 18)),
          const SizedBox(height: 8),
          const Text('Go back and scrape a restaurant',
              style: TextStyle(color: Colors.white38, fontSize: 14)),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF6B35)),
            child: const Text('Go Back', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildProceedButton(
      BuildContext context, RestaurantProvider provider) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A2E),
        border: Border(top: BorderSide(color: Colors.white12)),
      ),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: () => Navigator.push(context,
              MaterialPageRoute(builder: (_) => const CampaignConfigScreen())),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFFF6B35),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.auto_awesome, color: Colors.white),
              SizedBox(width: 8),
              Text('Configure Campaign',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold)),
            ],
          ),
        ),
      ),
    );
  }
}
