import 'package:http/http.dart' as http;
import 'dart:convert';
import '../models/restaurant.dart';
import '../models/menu_item.dart';
import '../models/campaign.dart';
import '../models/creative.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:3000';

  Future<Map<String, dynamic>> scrapeRestaurant(String url, String name) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/scrape'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'restaurant_url': url, 'restaurant_name': name}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to scrape: ${response.body}');
    }
  }

  Future<Map<String, dynamic>> processMenu(String restaurantId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/process-menu'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'restaurant_id': restaurantId,
        'options': {
          'remove_duplicates': true,
          'generate_missing_descriptions': true,
          'auto_categorize': true,
        },
      }),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> selectContent({
    required String restaurantId,
    required String campaignType,
    int dishCount = 5,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/select-content'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'restaurant_id': restaurantId,
        'campaign_type': campaignType,
        'dish_count': dishCount,
      }),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> generateCaptions(
    List<Map<String, dynamic>> dishes,
    String tone,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/generate-captions'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'dishes': dishes, 'tone': tone}),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> generateImages(
    List<Map<String, dynamic>> dishes,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/generate-images'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'dishes': dishes}),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> createCreatives({
    required String restaurantId,
    required List<Map<String, dynamic>> dishes,
    required List<String> formats,
    String? campaignType,
    String? platform,
    List<String>? colors,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/create-creatives'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'restaurant_id': restaurantId,
        'dishes': dishes,
        'formats': formats,
        'branding': {
          'campaign_type': campaignType,
          'platform': platform,
          'colors': colors ?? ['#FF6B6B', '#4ECDC4'],
        },
      }),
    );
    return jsonDecode(response.body);
  }

  Future<List<Campaign>> getCampaigns(String restaurantId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/campaigns/$restaurantId'),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final campaigns =
          (data['campaigns'] as List).map((c) => Campaign.fromJson(c)).toList();
      return campaigns;
    } else {
      throw Exception('Failed to fetch campaigns');
    }
  }

  Future<List<Creative>> getCampaignCreatives(String campaignId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/campaigns/$campaignId/creatives'),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final creatives =
          (data['creatives'] as List).map((c) => Creative.fromJson(c)).toList();
      return creatives;
    } else {
      throw Exception('Failed to fetch creatives');
    }
  }
}
