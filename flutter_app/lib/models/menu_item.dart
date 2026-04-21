class MenuItem {
  final String id;
  final String restaurantId;
  final String name;
  final String? category;
  final double? price;
  final String? currency;
  final String? description;
  final String? imageUrl;
  final List<String> tags;
  final bool isBestseller;
  final DateTime createdAt;

  MenuItem({
    required this.id,
    required this.restaurantId,
    required this.name,
    this.category,
    this.price,
    this.currency,
    this.description,
    this.imageUrl,
    this.tags = const [],
    this.isBestseller = false,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  factory MenuItem.fromJson(Map<String, dynamic> json) {
    final priceValue = json['price'];
    double? parsedPrice;
    if (priceValue != null) {
      if (priceValue is num) {
        parsedPrice = priceValue.toDouble();
      } else if (priceValue is String && priceValue.isNotEmpty) {
        final cleaned = priceValue.replaceAll(RegExp(r'[^\d.]'), '');
        parsedPrice = double.tryParse(cleaned);
      }
    }
    return MenuItem(
      id: json['id'] ?? '',
      restaurantId: json['restaurant_id'] ?? '',
      name: json['name'] ?? '',
      category: json['category'],
      price: parsedPrice,
      currency: json['currency'] ?? json['price_currency'],
      description: json['description'],
      imageUrl: json['image_url'],
      tags: json['tags'] != null ? List<String>.from(json['tags']) : [],
      isBestseller: json['is_bestseller'] ?? false,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'restaurant_id': restaurantId,
      'name': name,
      'category': category,
      'price': price,
      'currency': currency,
      'description': description,
      'image_url': imageUrl,
      'tags': tags,
      'is_bestseller': isBestseller,
    };
  }

  MenuItem copyWith({
    String? id,
    String? restaurantId,
    String? name,
    String? category,
    double? price,
    String? currency,
    String? description,
    String? imageUrl,
    List<String>? tags,
    bool? isBestseller,
  }) {
    return MenuItem(
      id: id ?? this.id,
      restaurantId: restaurantId ?? this.restaurantId,
      name: name ?? this.name,
      category: category ?? this.category,
      price: price ?? this.price,
      currency: currency ?? this.currency,
      description: description ?? this.description,
      imageUrl: imageUrl ?? this.imageUrl,
      tags: tags ?? this.tags,
      isBestseller: isBestseller ?? this.isBestseller,
      createdAt: createdAt,
    );
  }

  String get formattedPrice {
    if (price == null || price == 0) return '';
    final sym = currency == 'INR' ? '₹' : (currency == 'USD' ? '\$' : (currency == 'EUR' ? '€' : (currency == 'GBP' ? '£' : (currency ?? '\$'))));
    return '$sym${price!.toStringAsFixed(0)}';
  }
}
