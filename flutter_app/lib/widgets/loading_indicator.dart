import 'package:flutter/material.dart';

class LoadingIndicator extends StatefulWidget {
  final String? message;
  final double? progress;

  const LoadingIndicator({super.key, this.message, this.progress});

  @override
  State<LoadingIndicator> createState() => _LoadingIndicatorState();
}

class _LoadingIndicatorState extends State<LoadingIndicator>
    with TickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnim;

  final List<Map<String, String>> _steps = [
    {'key': 'select',   'label': 'Selecting dishes',       'icon': '🍽️'},
    {'key': 'caption',  'label': 'Generating captions',    'icon': '✍️'},
    {'key': 'image',    'label': 'Creating food images',   'icon': '📸'},
    {'key': 'creative', 'label': 'Building creatives',     'icon': '🎨'},
    {'key': 'finish',   'label': 'Finalizing campaign',    'icon': '✅'},
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  int get _activeStepIndex {
    final p = widget.progress ?? 0.0;
    if (p < 0.25) return 0;
    if (p < 0.45) return 1;
    if (p < 0.70) return 2;
    if (p < 0.90) return 3;
    return 4;
  }

  @override
  Widget build(BuildContext context) {
    final progress = widget.progress ?? 0.0;
    final activeStep = _activeStepIndex;

    return Container(
      color: const Color(0xFF0F0F1A),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Animated food emoji
              AnimatedBuilder(
                animation: _pulseAnim,
                builder: (_, __) => Transform.scale(
                  scale: _pulseAnim.value,
                  child: const Text('🍴', style: TextStyle(fontSize: 64)),
                ),
              ),
              const SizedBox(height: 24),

              // Progress bar
              if (widget.progress != null) ...[
                Stack(
                  children: [
                    Container(
                      height: 8,
                      decoration: BoxDecoration(
                        color: Colors.white12,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 400),
                      height: 8,
                      width: (MediaQuery.of(context).size.width - 64) * progress,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFF6B35), Color(0xFF4ECDC4)],
                        ),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${(progress * 100).toInt()}%',
                  style: const TextStyle(
                      color: Color(0xFFFF6B35),
                      fontWeight: FontWeight.bold,
                      fontSize: 18),
                ),
              ],

              const SizedBox(height: 28),

              // Current message
              if (widget.message != null)
                AnimatedBuilder(
                  animation: _pulseAnim,
                  builder: (_, __) => Opacity(
                    opacity: 0.6 + _pulseAnim.value * 0.4,
                    child: Text(
                      widget.message!,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),

              const SizedBox(height: 32),

              // Pipeline steps
              if (widget.progress != null)
                Column(
                  children: List.generate(_steps.length, (i) {
                    final isDone = i < activeStep;
                    final isActive = i == activeStep;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          // Step circle
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 300),
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: isDone
                                  ? const Color(0xFF4ECDC4)
                                  : isActive
                                      ? const Color(0xFFFF6B35)
                                      : Colors.white12,
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: isDone
                                  ? const Icon(Icons.check, color: Colors.white, size: 18)
                                  : isActive
                                      ? AnimatedBuilder(
                                          animation: _pulseAnim,
                                          builder: (_, __) => Transform.scale(
                                            scale: _pulseAnim.value,
                                            child: Text(
                                              _steps[i]['icon']!,
                                              style: const TextStyle(fontSize: 16),
                                            ),
                                          ),
                                        )
                                      : Text(_steps[i]['icon']!,
                                          style: const TextStyle(fontSize: 16)),
                            ),
                          ),
                          const SizedBox(width: 14),
                          // Connector line
                          Expanded(
                            child: Text(
                              _steps[i]['label']!,
                              style: TextStyle(
                                color: isDone
                                    ? const Color(0xFF4ECDC4)
                                    : isActive
                                        ? Colors.white
                                        : Colors.white38,
                                fontWeight: isActive
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          if (isDone)
                            const Icon(Icons.check_circle,
                                color: Color(0xFF4ECDC4), size: 16),
                          if (isActive)
                            AnimatedBuilder(
                              animation: _pulseAnim,
                              builder: (_, __) => Opacity(
                                opacity: _pulseAnim.value,
                                child: const Icon(Icons.circle,
                                    color: Color(0xFFFF6B35), size: 10),
                              ),
                            ),
                        ],
                      ),
                    );
                  }),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
