class Restaurant {
  final String id;
  final String name;
  final String websiteUrl;
  final String? logoUrl;
  final List<String> brandColors;
  final String theme;
  final DateTime createdAt;

  Restaurant({
    required this.id,
    required this.name,
    required this.websiteUrl,
    this.logoUrl,
    this.brandColors = const [],
    this.theme = 'casual',
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  factory Restaurant.fromJson(Map<String, dynamic> json) {
    return Restaurant(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      websiteUrl: json['website_url'] ?? '',
      logoUrl: json['logo_url'],
      brandColors: json['brand_colors'] != null
          ? List<String>.from(json['brand_colors'])
          : [],
      theme: json['theme'] ?? 'casual',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'website_url': websiteUrl,
      'logo_url': logoUrl,
      'brand_colors': brandColors,
      'theme': theme,
    };
  }
}
