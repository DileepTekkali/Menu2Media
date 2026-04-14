class Campaign {
  final String id;
  final String restaurantId;
  final String campaignType;
  final String platform;
  final String status;
  final List<String> selectedDishes;
  final int totalCreatives;
  final String? zipUrl;
  final DateTime createdAt;

  Campaign({
    required this.id,
    required this.restaurantId,
    required this.campaignType,
    required this.platform,
    this.status = 'processing',
    this.selectedDishes = const [],
    this.totalCreatives = 0,
    this.zipUrl,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  factory Campaign.fromJson(Map<String, dynamic> json) {
    return Campaign(
      id: json['id'] ?? '',
      restaurantId: json['restaurant_id'] ?? '',
      campaignType: json['campaign_type'] ?? 'daily',
      platform: json['platform'] ?? 'instagram',
      status: json['status'] ?? 'processing',
      selectedDishes: json['selected_dishes'] != null
          ? List<String>.from(json['selected_dishes'])
          : [],
      totalCreatives: json['total_creatives'] ?? 0,
      zipUrl: json['zip_url'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'restaurant_id': restaurantId,
      'campaign_type': campaignType,
      'platform': platform,
      'status': status,
      'selected_dishes': selectedDishes,
      'total_creatives': totalCreatives,
      'zip_url': zipUrl,
    };
  }

  bool get isCompleted => status == 'completed';
  bool get isFailed => status == 'failed';
  bool get isProcessing => status == 'processing';
}
