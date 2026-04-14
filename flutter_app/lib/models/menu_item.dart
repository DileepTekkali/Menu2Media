class MenuItem {
  final String id;
  final String restaurantId;
  final String name;
  final String? category;
  final double? price;
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
    this.description,
    this.imageUrl,
    this.tags = const [],
    this.isBestseller = false,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  factory MenuItem.fromJson(Map<String, dynamic> json) {
    return MenuItem(
      id: json['id'] ?? '',
      restaurantId: json['restaurant_id'] ?? '',
      name: json['name'] ?? '',
      category: json['category'],
      price: json['price'] != null ? (json['price'] as num).toDouble() : null,
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
      description: description ?? this.description,
      imageUrl: imageUrl ?? this.imageUrl,
      tags: tags ?? this.tags,
      isBestseller: isBestseller ?? this.isBestseller,
      createdAt: createdAt,
    );
  }
}
