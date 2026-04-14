import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/campaign_provider.dart';
import '../providers/restaurant_provider.dart';
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
    _loadCampaigns();
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
      appBar: AppBar(
        title: const Text('Campaigns'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
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
            return _buildEmptyState();
          }

          return _buildCampaignList(provider);
        },
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.campaign_outlined, size: 80, color: Colors.grey[400]),
          const SizedBox(height: 16),
          Text(
            'No campaigns yet',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(color: Colors.grey[600]),
          ),
          const SizedBox(height: 8),
          Text(
            'Create your first campaign from the home screen',
            style: TextStyle(color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }

  Widget _buildCampaignList(CampaignProvider provider) {
    return RefreshIndicator(
      onRefresh: () async => _loadCampaigns(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: provider.campaigns.length,
        itemBuilder: (context, index) {
          final campaign = provider.campaigns[index];
          return _buildCampaignCard(campaign, provider);
        },
      ),
    );
  }

  Widget _buildCampaignCard(campaign, CampaignProvider provider) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => _viewCampaign(campaign),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _buildStatusBadge(campaign.status),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      campaign.campaignType.toUpperCase(),
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Text(
                    campaign.platform.toUpperCase(),
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.photo_library, size: 16, color: Colors.grey[600]),
                  const SizedBox(width: 4),
                  Text(
                    '${campaign.totalCreatives} creatives',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const Spacer(),
                  Text(
                    _formatDate(campaign.createdAt),
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: Colors.grey[500]),
                  ),
                ],
              ),
              if (campaign.zipUrl != null) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => _downloadZip(campaign.zipUrl!),
                    icon: const Icon(Icons.download, size: 18),
                    label: const Text('Download ZIP'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    IconData icon;

    switch (status) {
      case 'completed':
        color = Colors.green;
        icon = Icons.check_circle;
        break;
      case 'failed':
        color = Colors.red;
        icon = Icons.error;
        break;
      default:
        color = Colors.orange;
        icon = Icons.hourglass_empty;
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Icon(icon, size: 16, color: color),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays == 0) {
      return 'Today';
    } else if (diff.inDays == 1) {
      return 'Yesterday';
    } else if (diff.inDays < 7) {
      return '${diff.inDays} days ago';
    } else {
      return '${date.day}/${date.month}/${date.year}';
    }
  }

  void _viewCampaign(campaign) async {
    final provider = context.read<CampaignProvider>();
    await provider.loadCampaignCreatives(campaign.id);

    if (mounted && provider.currentCreatives.isNotEmpty) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const CreativesGalleryScreen()),
      );
    }
  }

  void _downloadZip(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
