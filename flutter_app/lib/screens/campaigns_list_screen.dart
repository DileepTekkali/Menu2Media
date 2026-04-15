import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/campaign_provider.dart';
import '../providers/restaurant_provider.dart';
import '../services/api_service.dart';
import '../widgets/loading_indicator.dart';
import 'creatives_gallery_screen.dart';

class CampaignsListScreen extends StatefulWidget {
  const CampaignsListScreen({super.key});

  @override
  State<CampaignsListScreen> createState() => _CampaignsListScreenState();
}

class _CampaignsListScreenState extends State<CampaignsListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadCampaigns());
  }

  void _loadCampaigns() {
    final restaurantProvider = context.read<RestaurantProvider>();
    final campaignProvider = context.read<CampaignProvider>();
    if (restaurantProvider.restaurant != null) {
      campaignProvider.loadCampaigns(restaurantProvider.restaurant!.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A2E),
        foregroundColor: Colors.white,
        title: const Text('Campaign History',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _loadCampaigns,
          ),
        ],
      ),
      body: Consumer<CampaignProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading) {
            return const LoadingIndicator(message: 'Loading campaigns...');
          }
          if (provider.campaigns.isEmpty) {
            return _buildEmpty();
          }
          return _buildList(provider);
        },
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('📋', style: TextStyle(fontSize: 64)),
          const SizedBox(height: 16),
          const Text('No campaigns yet',
              style: TextStyle(
                  color: Colors.white70,
                  fontSize: 20,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text('Create your first campaign from home',
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

  Widget _buildList(CampaignProvider provider) {
    return RefreshIndicator(
      color: const Color(0xFFFF6B35),
      backgroundColor: const Color(0xFF1A1A2E),
      onRefresh: () async => _loadCampaigns(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: provider.campaigns.length,
        itemBuilder: (context, index) =>
            _buildCard(provider.campaigns[index], provider),
      ),
    );
  }

  Widget _buildCard(campaign, CampaignProvider provider) {
    final platformIcons = {
      'instagram': Icons.camera_alt,
      'facebook': Icons.facebook,
      'whatsapp': Icons.chat,
    };

    final typeEmojis = {
      'daily': '☀️',
      'new_arrivals': '🆕',
      'weekend': '🎉',
      'festive': '✨',
      'combo': '🤝',
    };

    return GestureDetector(
      onTap: () => _viewCampaign(campaign),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A2E),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: campaign.status == 'completed'
                ? const Color(0xFF4ECDC4).withValues(alpha: 0.3)
                : Colors.white12,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    '${typeEmojis[campaign.campaignType] ?? '📋'} ${campaign.campaignType.toUpperCase()}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15),
                  ),
                  const Spacer(),
                  _buildStatus(campaign.status),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(platformIcons[campaign.platform] ?? Icons.devices,
                      color: Colors.white54, size: 16),
                  const SizedBox(width: 6),
                  Text(campaign.platform.toUpperCase(),
                      style:
                          const TextStyle(color: Colors.white54, fontSize: 12)),
                  const SizedBox(width: 16),
                  const Icon(Icons.photo_library,
                      color: Colors.white54, size: 16),
                  const SizedBox(width: 6),
                  Text('${campaign.totalCreatives} creatives',
                      style:
                          const TextStyle(color: Colors.white54, fontSize: 12)),
                  const Spacer(),
                  Text(
                    _formatDate(campaign.createdAt),
                    style: const TextStyle(color: Colors.white38, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _viewCampaign(campaign),
                      icon: const Icon(Icons.visibility,
                          size: 16, color: Color(0xFF4ECDC4)),
                      label: const Text('View Creatives',
                          style: TextStyle(
                              color: Color(0xFF4ECDC4), fontSize: 13)),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF4ECDC4)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _downloadZip(campaign),
                      icon: const Icon(Icons.download,
                          size: 16, color: Colors.white),
                      label: const Text('Download ZIP',
                          style: TextStyle(color: Colors.white, fontSize: 13)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF6B35),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 8),
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

  Widget _buildStatus(String status) {
    final cfg = {
          'completed': {
            'color': const Color(0xFF4ECDC4),
            'icon': Icons.check_circle,
            'label': 'Done'
          },
          'processing': {
            'color': Colors.orange,
            'icon': Icons.hourglass_empty,
            'label': 'Processing'
          },
          'failed': {
            'color': Colors.redAccent,
            'icon': Icons.error,
            'label': 'Failed'
          },
        }[status] ??
        {'color': Colors.grey, 'icon': Icons.help_outline, 'label': status};

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: (cfg['color'] as Color).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border:
            Border.all(color: (cfg['color'] as Color).withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(cfg['icon'] as IconData, color: cfg['color'] as Color, size: 12),
          const SizedBox(width: 4),
          Text(cfg['label'] as String,
              style: TextStyle(
                  color: cfg['color'] as Color,
                  fontSize: 11,
                  fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final diff = DateTime.now().difference(date);
    if (diff.inDays == 0) return 'Today';
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${date.day}/${date.month}/${date.year}';
  }

  Future<void> _viewCampaign(campaign) async {
    final provider = context.read<CampaignProvider>();
    provider.setActiveCampaign(campaign);
    await provider.loadCampaignCreatives(campaign.id);
    if (mounted) {
      Navigator.push(context,
          MaterialPageRoute(builder: (_) => const CreativesGalleryScreen()));
    }
  }

  Future<void> _downloadZip(campaign) async {
    final zipUrl =
        campaign.zipUrl ?? '${ApiService.baseUrl}/api/download/${campaign.id}';
    final uri = Uri.parse(zipUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
