import 'package:flutter/foundation.dart';
import '../models/campaign.dart';
import '../models/creative.dart';
import '../services/api_service.dart';

class CampaignProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<Campaign> _campaigns = [];
  List<Creative> _currentCreatives = [];
  Campaign? _activeCampaign;
  bool _isLoading = false;
  String? _error;
  double _progress = 0.0;

  List<Campaign> get campaigns => _campaigns;
  List<Creative> get currentCreatives => _currentCreatives;
  Campaign? get activeCampaign => _activeCampaign;
  bool get isLoading => _isLoading;
  String? get error => _error;
  double get progress => _progress;

  Future<void> createCampaign({
    required String restaurantId,
    required String campaignType,
    required List<String> formats,
    int dishCount = 5,
    String tone = 'casual',
  }) async {
    _isLoading = true;
    _error = null;
    _progress = 0.0;
    notifyListeners();

    try {
      _progress = 0.1;
      notifyListeners();

      final contentResult = await _apiService.selectContent(
        restaurantId: restaurantId,
        campaignType: campaignType,
        dishCount: dishCount,
      );

      if (contentResult['success'] != true) {
        throw Exception(contentResult['error'] ?? 'Failed to select content');
      }

      _progress = 0.3;
      notifyListeners();

      final selectedDishes = (contentResult['selected_dishes'] as List)
          .map((d) => d as Map<String, dynamic>)
          .toList();

      final captionsResult = await _apiService.generateCaptions(
        selectedDishes,
        tone,
      );

      _progress = 0.5;
      notifyListeners();

      final captions = captionsResult['captions'] as List? ?? [];

      for (var i = 0; i < selectedDishes.length; i++) {
        final dish = selectedDishes[i];
        final caption = captions.firstWhere(
          (c) => c['dish_id'] == dish['id'],
          orElse: () => {
            'headline': dish['name'],
            'caption': 'Try our delicious ${dish['name']}!',
            'cta': 'Order Now',
          },
        );
        selectedDishes[i] = {...dish, ...caption};
      }

      _progress = 0.7;
      notifyListeners();

      final imagesResult = await _apiService.generateImages(selectedDishes);
      final images = imagesResult['images'] as List? ?? [];

      for (var i = 0; i < selectedDishes.length; i++) {
        final dish = selectedDishes[i];
        final image = images.firstWhere(
          (img) => img['dish_id'] == dish['id'],
          orElse: () => {'image_url': null},
        );
        selectedDishes[i] = {...dish, 'image_url': image['image_url']};
      }

      _progress = 0.9;
      notifyListeners();

      final creativesResult = await _apiService.createCreatives(
        restaurantId: restaurantId,
        dishes: selectedDishes,
        formats: formats,
        campaignType: campaignType,
        platform: formats.contains('facebook_post') ? 'facebook' : 'instagram',
      );

      _progress = 1.0;

      if (creativesResult['success'] == true) {
        _activeCampaign = Campaign(
          id: creativesResult['campaign_id'],
          restaurantId: restaurantId,
          campaignType: campaignType,
          platform: formats.contains('facebook_post')
              ? 'facebook'
              : 'instagram',
          status: 'completed',
          totalCreatives: creativesResult['total_creatives'] ?? 0,
        );
      } else {
        throw Exception(
          creativesResult['error'] ?? 'Failed to create creatives',
        );
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadCampaigns(String restaurantId) async {
    _isLoading = true;
    notifyListeners();

    try {
      _campaigns = await _apiService.getCampaigns(restaurantId);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadCampaignCreatives(String campaignId) async {
    _isLoading = true;
    notifyListeners();

    try {
      _currentCreatives = await _apiService.getCampaignCreatives(campaignId);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clear() {
    _campaigns = [];
    _currentCreatives = [];
    _activeCampaign = null;
    _error = null;
    _progress = 0.0;
    notifyListeners();
  }
}
