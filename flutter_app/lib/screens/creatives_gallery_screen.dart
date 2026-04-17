import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/campaign_provider.dart';
import '../providers/restaurant_provider.dart';
import '../services/api_service.dart';
import '../widgets/creative_card.dart';
import '../widgets/loading_indicator.dart';
import '../models/creative.dart';

class CreativesGalleryScreen extends StatefulWidget {
  const CreativesGalleryScreen({super.key});

  @override
  State<CreativesGalleryScreen> createState() => _CreativesGalleryScreenState();
}

class _CreativesGalleryScreenState extends State<CreativesGalleryScreen> {
  String _filterFormat = 'all';

  final _formatFilters = {
    'all': 'All',
    'square': 'Square',
    'story': 'Story',
    'landscape': 'Landscape',
  };

  List<Creative> _filtered(List<Creative> all) {
    if (_filterFormat == 'all') return all;
    return all.where((c) => c.format == _filterFormat).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A2E),
        foregroundColor: Colors.white,
        title: const Text('Your Creatives',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.download_rounded, color: Colors.white),
            tooltip: 'Download All as ZIP',
            onPressed: () => _downloadAll(context),
          ),
        ],
      ),
      body: Consumer<CampaignProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const LoadingIndicator(message: 'Loading creatives...');
          }

          if (provider.currentCreatives.isEmpty) {
            return _buildEmptyState(context);
          }

          final filtered = _filtered(provider.currentCreatives);

          return Column(
            children: [
              _buildSummaryBar(context, provider),
              _buildFormatFilter(),
              Expanded(child: _buildGrid(context, filtered, provider)),
              _buildBottomActions(context, provider),
            ],
          );
        },
      ),
    );
  }

  Widget _buildSummaryBar(BuildContext context, CampaignProvider provider) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1A1A2E), Color(0xFF16213E)],
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFF6B35).withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle,
                color: Color(0xFFFF6B35), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${provider.currentCreatives.length} Creatives Generated',
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 15),
                ),
                Text(
                  provider.activeCampaign?.campaignType.toUpperCase() ??
                      'CAMPAIGN',
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF4ECDC4).withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                  color: const Color(0xFF4ECDC4).withValues(alpha: 0.5)),
            ),
            child: Text(
              provider.activeCampaign?.platform.toUpperCase() ?? '',
              style: const TextStyle(
                  color: Color(0xFF4ECDC4),
                  fontSize: 11,
                  fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormatFilter() {
    return Container(
      height: 50,
      color: const Color(0xFF16213E),
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        children: _formatFilters.entries.map((e) {
          final selected = _filterFormat == e.key;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => setState(() => _filterFormat = e.key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                decoration: BoxDecoration(
                  color: selected
                      ? const Color(0xFFFF6B35)
                      : const Color(0xFF1A1A2E),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: selected ? const Color(0xFFFF6B35) : Colors.white24,
                  ),
                ),
                child: Text(e.value,
                    style: TextStyle(
                        color: selected ? Colors.white : Colors.white60,
                        fontWeight:
                            selected ? FontWeight.bold : FontWeight.normal,
                        fontSize: 13)),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildGrid(BuildContext context, List<Creative> creatives,
      CampaignProvider provider) {
    if (creatives.isEmpty) {
      return const Center(
        child: Text(
          'No creatives for this format',
          style: TextStyle(color: Colors.white38, fontSize: 16),
        ),
      );
    }
    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.78,
      ),
      itemCount: creatives.length,
      itemBuilder: (context, index) {
        final creative = creatives[index];
        return CreativeCard(
          creative: creative,
          onTap: () => _showCreativeDetail(context, creative),
        );
      },
    );
  }

  Widget _buildBottomActions(BuildContext context, CampaignProvider provider) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A2E),
        border: Border(top: BorderSide(color: Colors.white12)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () {
                context.read<RestaurantProvider>().clear();
                context.read<CampaignProvider>().clear();
                Navigator.popUntil(context, (route) => route.isFirst);
              },
              icon: const Icon(Icons.add_circle_outline,
                  color: Color(0xFF4ECDC4)),
              label: const Text('New Campaign',
                  style: TextStyle(color: Color(0xFF4ECDC4))),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFF4ECDC4)),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () => _downloadAll(context),
              icon: const Icon(Icons.download_rounded, color: Colors.white),
              label: const Text('Download ZIP',
                  style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF6B35),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showCreativeDetail(BuildContext context, Creative creative) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1A1A2E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.9,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF6B35).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(creative.formatDisplayName,
                    style: const TextStyle(
                        color: Color(0xFFFF6B35), fontSize: 12)),
              ),
              const SizedBox(height: 12),
              if (creative.imageUrl.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.network(creative.imageUrl, fit: BoxFit.contain),
                ),
              const SizedBox(height: 20),
              if (creative.captionHeadline != null) ...[
                Text(creative.captionHeadline!,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
              ],
              if (creative.captionBody != null)
                Text(creative.captionBody!,
                    style:
                        const TextStyle(color: Colors.white70, fontSize: 15)),
              if (creative.ctaText != null) ...[
                const SizedBox(height: 12),
                Text(creative.ctaText!,
                    style: const TextStyle(
                        color: Color(0xFFFF6B35), fontWeight: FontWeight.bold)),
              ],
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _launchUrl(creative.imageUrl),
                      icon: const Icon(Icons.share, color: Color(0xFF4ECDC4)),
                      label: const Text('Share',
                          style: TextStyle(color: Color(0xFF4ECDC4))),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF4ECDC4)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _launchUrl(creative.imageUrl),
                      icon: const Icon(Icons.download, color: Colors.white),
                      label: const Text('Download',
                          style: TextStyle(color: Colors.white)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF6B35),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _launchUrl(String urlStr) async {
    final uri = Uri.parse(urlStr);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _downloadAll(BuildContext context) async {
    final provider = context.read<CampaignProvider>();

    if (provider.activeCampaign?.zipUrl != null) {
      await _launchUrl(provider.activeCampaign!.zipUrl!);
      return;
    }

    if (provider.activeCampaign != null) {
      // Use the ZIP download endpoint
      final zipUrl =
          '${ApiService.baseUrl}/api/download/${provider.activeCampaign!.id}';
      await _launchUrl(zipUrl);
      return;
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No campaign active to download'),
          backgroundColor: Color(0xFFFF6B35),
        ),
      );
    }
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('🖼️', style: TextStyle(fontSize: 64)),
          const SizedBox(height: 16),
          const Text('No creatives yet',
              style: TextStyle(
                  color: Colors.white70,
                  fontSize: 20,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Generate creatives to see them here',
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
}
