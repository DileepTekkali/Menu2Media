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

  void setActiveCampaign(campaign) {
    _activeCampaign = campaign;
    notifyListeners();
  }

  Future<void> createCampaignWithDishes({
    required String restaurantId,
    required String campaignType,
    required List<Map<String, dynamic>> dishes,
    required List<String> formats,
    String tone = 'casual',
    List<String>? colors,
  }) async {
    _isLoading = true;
    _error = null;
    _progress = 0.0;
    notifyListeners();

    try {
      _progress = 0.1;
      notifyListeners();

      final selectedDishes = List<Map<String, dynamic>>.from(dishes);

      _progress = 0.2;
      notifyListeners();

      final captionsResult =
          await _apiService.generateCaptions(selectedDishes, tone);

      _progress = 0.4;
      notifyListeners();

      final captions = captionsResult['captions'] as List? ?? [];

      for (var i = 0; i < selectedDishes.length; i++) {
        final dish = selectedDishes[i];
        final caption = captions.firstWhere(
          (c) => c['dish_id'] == dish['id'],
          orElse: () => i < captions.length ? captions[i] : <String, dynamic>{},
        );
        selectedDishes[i] = {
          ...dish,
          'headline': caption['headline'] ?? dish['name'],
          'caption': caption['caption'] ?? 'Try our ${dish['name']}!',
          'cta': caption['cta'] ?? '📍 Order Now',
        };
      }

      _progress = 0.6;
      notifyListeners();

      final imagesResult = await _apiService.generateImages(selectedDishes);
      final images = imagesResult['images'] as List? ?? [];

      for (var i = 0; i < selectedDishes.length; i++) {
        final dish = selectedDishes[i];
        final image = images.firstWhere(
          (img) => img['dish_id'] == dish['id'],
          orElse: () =>
              <String, dynamic>{'image_url': null, 'image_buffer_b64': null},
        );
        // Pass both image_url and image_buffer to backend for proper format handling
        selectedDishes[i] = {
          ...dish,
          'image_url': image['image_url'],
          'image_buffer': image['image_buffer_b64'],
        };
      }

      _progress = 0.8;
      notifyListeners();

      final creativesResult = await _apiService.createCreatives(
        restaurantId: restaurantId,
        dishes: selectedDishes,
        formats: formats,
        campaignType: campaignType,
        platform: formats.contains('facebook_post') ? 'facebook' : 'instagram',
        colors: colors ?? ['#FF6B35', '#2E4057'],
        tone: tone,
      );

      _progress = 1.0;

      if (creativesResult['success'] == true) {
        _activeCampaign = Campaign(
          id: creativesResult['campaign_id'],
          restaurantId: restaurantId,
          campaignType: campaignType,
          platform:
              formats.contains('facebook_post') ? 'facebook' : 'instagram',
          status: 'completed',
          totalCreatives: creativesResult['total_creatives'] ?? 0,
        );

        final raw = creativesResult['creatives'] as List? ?? [];
        if (raw.isNotEmpty) {
          _currentCreatives = raw
              .map<Creative>((c) => Creative(
                    id: '${c['menu_item_id']}_${c['format']}',
                    campaignId: creativesResult['campaign_id'],
                    menuItemId: c['menu_item_id'],
                    format: c['format'] ?? 'square',
                    exportType: c['export_type'] ?? 'png',
                    imageUrl: c['image_url'] ?? '',
                    captionHeadline: c['menu_item_name'],
                    captionBody: c['caption_body'] ?? '',
                    ctaText: c['cta_text'] ?? 'Order Now!',
                  ))
              .toList();
        }
      } else {
        throw Exception(
            creativesResult['error'] ?? 'Failed to create creatives');
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> createCampaign({
    required String restaurantId,
    required String campaignType,
    required List<String> formats,
    int dishCount = 5,
    String tone = 'casual',
    List<String>? colors,
  }) async {
    _isLoading = true;
    _error = null;
    _progress = 0.0;
    notifyListeners();

    try {
      // Step 1: Select dishes
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

      _progress = 0.25;
      notifyListeners();

      final selectedDishes = (contentResult['selected_dishes'] as List)
          .map((d) => d as Map<String, dynamic>)
          .toList();

      // Step 2: Generate captions
      final captionsResult =
          await _apiService.generateCaptions(selectedDishes, tone);

      _progress = 0.45;
      notifyListeners();

      final captions = captionsResult['captions'] as List? ?? [];

      // Merge captions into dishes by index or dish_id
      for (var i = 0; i < selectedDishes.length; i++) {
        final dish = selectedDishes[i];
        // Try match by dish_id first, then fall back to position
        final caption = captions.firstWhere(
          (c) => c['dish_id'] == dish['id'],
          orElse: () => i < captions.length ? captions[i] : <String, dynamic>{},
        );
        selectedDishes[i] = {
          ...dish,
          'headline': caption['headline'] ?? dish['name'],
          'caption': caption['caption'] ?? 'Try our ${dish['name']}!',
          'cta': caption['cta'] ?? '📍 Order Now',
        };
      }

      // Step 3: Generate food images
      _progress = 0.65;
      notifyListeners();

      final imagesResult = await _apiService.generateImages(selectedDishes);
      final images = imagesResult['images'] as List? ?? [];

      for (var i = 0; i < selectedDishes.length; i++) {
        final dish = selectedDishes[i];
        final image = images.firstWhere(
          (img) => img['dish_id'] == dish['id'],
          orElse: () => <String, dynamic>{'image_url': null},
        );
        if (image['image_url'] != null) {
          selectedDishes[i] = {...dish, 'image_url': image['image_url']};
        }
      }

      // Step 4: Build creatives
      _progress = 0.85;
      notifyListeners();

      final creativesResult = await _apiService.createCreatives(
        restaurantId: restaurantId,
        dishes: selectedDishes,
        formats: formats,
        campaignType: campaignType,
        platform: formats.contains('facebook_post') ? 'facebook' : 'instagram',
        colors: colors ?? ['#FF6B35', '#2E4057'],
        tone: tone,
      );

      _progress = 1.0;

      if (creativesResult['success'] == true) {
        _activeCampaign = Campaign(
          id: creativesResult['campaign_id'],
          restaurantId: restaurantId,
          campaignType: campaignType,
          platform:
              formats.contains('facebook_post') ? 'facebook' : 'instagram',
          status: 'completed',
          totalCreatives: creativesResult['total_creatives'] ?? 0,
        );

        // If creatives returned with base64, build local Creative objects
        final raw = creativesResult['creatives'] as List? ?? [];
        if (raw.isNotEmpty && raw.first['image_url'] != null) {
          // Will load via loadCampaignCreatives
        } else if (raw.isNotEmpty && raw.first['image_b64'] != null) {
          // Store base64 creatives for local display
          _currentCreatives = raw
              .map<Creative>((c) => Creative(
                    id: '${c['menu_item_id']}_${c['format']}',
                    campaignId: creativesResult['campaign_id'],
                    menuItemId: c['menu_item_id'],
                    format: c['format'] ?? 'instagram_square',
                    exportType: c['export_type'] ?? 'png',
                    imageUrl: c['image_url'] ?? '',
                    captionHeadline: c['menu_item_name'],
                    captionBody: '',
                    ctaText: 'Order Now!',
                  ))
              .toList();
        }
      } else {
        throw Exception(
            creativesResult['error'] ?? 'Failed to create creatives');
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
    _error = null;
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
