class Creative {
  final String id;
  final String campaignId;
  final String? menuItemId;
  final String format;
  final String imageUrl;
  final String? captionHeadline;
  final String? captionBody;
  final String? ctaText;
  final String? dimensions;
  final DateTime createdAt;
  final String? menuItemName;
  final double? menuItemPrice;

  Creative({
    required this.id,
    required this.campaignId,
    this.menuItemId,
    required this.format,
    required this.imageUrl,
    this.captionHeadline,
    this.captionBody,
    this.ctaText,
    this.dimensions,
    DateTime? createdAt,
    this.menuItemName,
    this.menuItemPrice,
  }) : createdAt = createdAt ?? DateTime.now();

  factory Creative.fromJson(Map<String, dynamic> json) {
    final menuItem = json['menu_items'];
    return Creative(
      id: json['id'] ?? '',
      campaignId: json['campaign_id'] ?? '',
      menuItemId: json['menu_item_id'],
      format: json['format'] ?? 'instagram_square',
      imageUrl: json['image_url'] ?? '',
      captionHeadline: json['caption_headline'],
      captionBody: json['caption_body'],
      ctaText: json['cta_text'],
      dimensions: json['dimensions'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
      menuItemName: menuItem != null ? menuItem['name'] : null,
      menuItemPrice: menuItem != null && menuItem['price'] != null
          ? (menuItem['price'] as num).toDouble()
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'campaign_id': campaignId,
      'menu_item_id': menuItemId,
      'format': format,
      'image_url': imageUrl,
      'caption_headline': captionHeadline,
      'caption_body': captionBody,
      'cta_text': ctaText,
      'dimensions': dimensions,
    };
  }

  String get formatDisplayName {
    switch (format) {
      case 'instagram_square':
        return 'Instagram Post';
      case 'instagram_story':
        return 'Instagram Story';
      case 'facebook_post':
        return 'Facebook Post';
      default:
        return format;
    }
  }
}
