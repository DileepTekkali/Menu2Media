import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import '../models/menu_item.dart';
import '../models/campaign.dart';
import '../models/creative.dart';

class ApiService {
  static String get baseUrl =>
      dotenv.env['API_BASE_URL'] ?? 'http://localhost:3000';

  Map<String, String> get _headers => {'Content-Type': 'application/json'};

  Future<Map<String, dynamic>> _post(
      String path, Map<String, dynamic> body) async {
    try {
      final uri = Uri.parse('$baseUrl$path');
      print('API POST: $uri');
      final response = await http
          .post(
            uri,
            headers: _headers,
            body: jsonEncode(body),
          )
          .timeout(const Duration(minutes: 30)); // Increased to 30 minutes
      print('API Response status: ${response.statusCode}');
      return jsonDecode(response.body);
    } catch (e) {
      print('API Error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> _get(String path) async {
    try {
      final response = await http
          .get(
            Uri.parse('$baseUrl$path'),
            headers: _headers,
          )
          .timeout(const Duration(minutes: 10)); // Increased to 10 minutes
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> scrapeRestaurant(String url, String name) async {
    return _post(
        '/api/scrape', {'restaurant_url': url, 'restaurant_name': name});
  }

  Future<Map<String, dynamic>> processMenu(String restaurantId) async {
    return _post('/api/process-menu', {
      'restaurant_id': restaurantId,
      'options': {
        'remove_duplicates': true,
        'generate_missing_descriptions': true,
        'auto_categorize': true,
      },
    });
  }

  Future<List<MenuItem>> getMenuItems(String restaurantId) async {
    final data = await _get('/api/menu/$restaurantId');
    if (data['success'] == true) {
      return (data['menu_items'] as List)
          .map((item) => MenuItem.fromJson(item))
          .toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> selectContent({
    required String restaurantId,
    required String campaignType,
    int dishCount = 5,
  }) async {
    return _post('/api/select-content', {
      'restaurant_id': restaurantId,
      'campaign_type': campaignType,
      'dish_count': dishCount,
    });
  }

  Future<Map<String, dynamic>> generateCaptions(
    List<Map<String, dynamic>> dishes,
    String tone,
  ) async {
    return _post('/api/generate-captions', {'dishes': dishes, 'tone': tone});
  }

  Future<Map<String, dynamic>> generateImages(
    List<Map<String, dynamic>> dishes,
  ) async {
    return _post('/api/generate-images', {'dishes': dishes});
  }

  Future<Map<String, dynamic>> createCreatives({
    required String restaurantId,
    required List<Map<String, dynamic>> dishes,
    required List<String> formats,
    String? campaignType,
    String? platform,
    List<String>? colors,
    String? tone,
    List<String>? exportTypes,
    String? festivalType,
  }) async {
    return _post('/api/create-creatives', {
      'restaurant_id': restaurantId,
      'dishes': dishes,
      'formats': formats,
      'export_types': exportTypes ?? ['png'],
      // Send both at root and branding to be safe
      'festival_type': festivalType,
      'branding': {
        'campaign_type': campaignType,
        'platform': platform,
        'colors': colors ?? ['#FF6B35', '#2E4057'],
        'tone': tone ?? 'casual',
        'festival_type': festivalType,
      },
    });
  }

  Future<List<Campaign>> getCampaigns(String restaurantId) async {
    final data = await _get('/api/campaigns/$restaurantId');
    if (data['success'] == true) {
      return (data['campaigns'] as List)
          .map((c) => Campaign.fromJson(c))
          .toList();
    }
    return [];
  }

  Future<List<Creative>> getCampaignCreatives(String campaignId) async {
    final data = await _get('/api/campaign/$campaignId/creatives');
    if (data['success'] == true) {
      return (data['creatives'] as List)
          .map((c) => Creative.fromJson(c))
          .toList();
    }
    return [];
  }

  String getDownloadZipUrl(String campaignId) {
    return '$baseUrl/api/download/$campaignId';
  }

  Future<bool> updateBranding({
    required String restaurantId,
    List<String>? brandColors,
    String? theme,
    String? logoUrl,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (brandColors != null) body['brand_colors'] = brandColors;
      if (theme != null) body['theme'] = theme;
      if (logoUrl != null) body['logo_url'] = logoUrl;

      final response = await http
          .patch(
            Uri.parse('$baseUrl/api/restaurants/$restaurantId/branding'),
            headers: _headers,
            body: jsonEncode(body),
          )
          .timeout(const Duration(minutes: 5));
      final data = jsonDecode(response.body);
      return data['success'] == true;
    } catch (e) {
      return false;
    }
  }
}
