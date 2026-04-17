import 'package:flutter/foundation.dart';
import '../models/restaurant.dart';
import '../models/menu_item.dart';
import '../services/api_service.dart';

class RestaurantProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  Restaurant? _restaurant;
  List<MenuItem> _menuItems = [];
  bool _isLoading = false;
  String? _error;
  List<String> _brandColors = ['#FF6B35', '#2E4057'];
  String _theme = 'casual';
  String _tone = 'casual';

  Restaurant? get restaurant => _restaurant;
  List<MenuItem> get menuItems => _menuItems;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasData => _restaurant != null;
  List<String> get brandColors => _brandColors;
  String get theme => _theme;
  String get tone => _tone;

  Future<void> scrapeRestaurant(String url, String name) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      print('Starting scrape for: $url');
      final result = await _apiService.scrapeRestaurant(url, name);
      print('Scrape result: $result');

      if (result['success'] == true) {
        final data = result['data'];
        _restaurant = Restaurant.fromJson(data['restaurant']);
        _menuItems = (data['menu_items'] as List)
            .map((item) => MenuItem.fromJson(item))
            .toList();

        _isLoading = false;
        notifyListeners();
        print('Scraped ${_menuItems.length} items');

        // Process menu in background
        processMenu();
      } else {
        _error = result['error'] ?? 'Failed to scrape restaurant';
        _isLoading = false;
        notifyListeners();
      }
    } catch (e) {
      print('Scrape error: $e');
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> processMenu() async {
    if (_restaurant == null) return;

    try {
      final result = await _apiService.processMenu(_restaurant!.id);
      if (result['success'] == true) {
        await refreshMenuItems();
      }
    } catch (e) {
      // Non-critical — just log
      debugPrint('Process menu error: $e');
    }
  }

  Future<void> refreshMenuItems() async {
    if (_restaurant == null) return;
    try {
      final items = await _apiService.getMenuItems(_restaurant!.id);
      if (items.isNotEmpty) {
        _menuItems = items;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Refresh menu items error: $e');
    }
  }

  void setBrandColors(List<String> colors) {
    _brandColors = colors;
    notifyListeners();
    if (_restaurant != null) {
      _apiService.updateBranding(
          restaurantId: _restaurant!.id, brandColors: colors);
    }
  }

  void setTheme(String theme) {
    _theme = theme;
    notifyListeners();
    if (_restaurant != null) {
      _apiService.updateBranding(restaurantId: _restaurant!.id, theme: theme);
    }
  }

  void setTone(String tone) {
    _tone = tone;
    notifyListeners();
  }

  Future<List<MenuItem>> getMenuItems() async {
    if (_restaurant == null) return [];
    try {
      final items = await _apiService.getMenuItems(_restaurant!.id);
      if (items.isNotEmpty) {
        _menuItems = items;
        notifyListeners();
      }
      return items;
    } catch (e) {
      debugPrint('Get menu items error: $e');
      return _menuItems;
    }
  }

  void clear() {
    _restaurant = null;
    _menuItems = [];
    _error = null;
    _brandColors = ['#FF6B35', '#2E4057'];
    _theme = 'casual';
    _tone = 'casual';
    notifyListeners();
  }
}
