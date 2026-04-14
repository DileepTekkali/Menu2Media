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

  Restaurant? get restaurant => _restaurant;
  List<MenuItem> get menuItems => _menuItems;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasData => _restaurant != null;

  Future<void> scrapeRestaurant(String url, String name) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final result = await _apiService.scrapeRestaurant(url, name);

      if (result['success'] == true) {
        final data = result['data'];
        _restaurant = Restaurant.fromJson(data['restaurant']);
        _menuItems = (data['menu_items'] as List)
            .map((item) => MenuItem.fromJson(item))
            .toList();

        await processMenu();
      } else {
        _error = result['error'] ?? 'Unknown error';
      }
    } catch (e) {
      _error = e.toString();
    } finally {
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
      _error = e.toString();
      notifyListeners();
    }
  }

  Future<void> refreshMenuItems() async {
    // Refresh menu items from provider state
    notifyListeners();
  }

  void clear() {
    _restaurant = null;
    _menuItems = [];
    _error = null;
    notifyListeners();
  }
}
