import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class UrlInputForm extends StatefulWidget {
  final Function(String url, String name) onSubmit;
  final bool isLoading;

  const UrlInputForm({
    super.key,
    required this.onSubmit,
    this.isLoading = false,
  });

  @override
  State<UrlInputForm> createState() => _UrlInputFormState();
}

class _UrlInputFormState extends State<UrlInputForm>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _urlController = TextEditingController();
  final _nameController = TextEditingController();
  final _urlFocus = FocusNode();
  final _nameFocus = FocusNode();

  bool _urlFocused = false;
  bool _nameFocused = false;
  bool _urlHasText = false;
  String? _urlError;

  static const _accent = Color(0xFFFF6B35);
  static const _surface = Color(0xFF1A1A2E);
  static const _border = Color(0xFF2A2A40);
  static const _borderFocus = Color(0xFFFF6B35);
  static const _textMain = Colors.white;
  static const _textHint = Color(0xFF5A5A7A);
  static const _errorColor = Color(0xFFFF4757);

  @override
  void initState() {
    super.initState();
    _urlFocus.addListener(() => setState(() => _urlFocused = _urlFocus.hasFocus));
    _nameFocus.addListener(() => setState(() => _nameFocused = _nameFocus.hasFocus));
    _urlController.addListener(() {
      setState(() => _urlHasText = _urlController.text.isNotEmpty);
    });
  }

  @override
  void dispose() {
    _urlController.dispose();
    _nameController.dispose();
    _urlFocus.dispose();
    _nameFocus.dispose();
    super.dispose();
  }

  // Auto-prefix https:// if missing
  String _normalizeUrl(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return trimmed;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return 'https://$trimmed';
    }
    return trimmed;
  }

  String? _validateUrl(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Please enter a restaurant URL';
    }
    final normalized = _normalizeUrl(value);
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      return 'URL must start with https://';
    }
    if (!normalized.contains('.')) {
      return 'Please enter a valid URL (e.g. https://restaurant.com)';
    }
    try {
      final uri = Uri.parse(normalized);
      if (uri.host.isEmpty) return 'Please enter a valid URL';
    } catch (_) {
      return 'Please enter a valid URL';
    }
    return null;
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData('text/plain');
    if (data?.text != null && data!.text!.isNotEmpty) {
      _urlController.text = data.text!.trim();
      _urlController.selection = TextSelection.fromPosition(
        TextPosition(offset: _urlController.text.length),
      );
      setState(() {
        _urlHasText = true;
        _urlError = null;
      });
    }
  }

  void _submit() {
    // Normalize the URL before submitting
    final normalized = _normalizeUrl(_urlController.text);
    _urlController.text = normalized;

    setState(() {
      _urlError = _validateUrl(normalized);
    });

    if (_urlError != null) return;

    if (_formKey.currentState?.validate() ?? false) {
      widget.onSubmit(normalized, _nameController.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Section label
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text(
              'Restaurant URL',
              style: TextStyle(
                color: Colors.white70,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
          ),

          // URL Input Field
          _buildField(
            controller: _urlController,
            focusNode: _urlFocus,
            isFocused: _urlFocused,
            hintText: 'https://yourrestaurant.com/menu',
            keyboardType: TextInputType.url,
            prefixIcon: Icons.link_rounded,
            errorText: _urlError,
            enabled: !widget.isLoading,
            validator: _validateUrl,
            onChanged: (_) => setState(() => _urlError = null),
            suffixWidget: _urlHasText
                ? GestureDetector(
                    onTap: () {
                      _urlController.clear();
                      setState(() {
                        _urlHasText = false;
                        _urlError = null;
                      });
                    },
                    child: const Icon(Icons.close_rounded,
                        color: _textHint, size: 18),
                  )
                : GestureDetector(
                    onTap: _pasteFromClipboard,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: _accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                            color: _accent.withValues(alpha: 0.3)),
                      ),
                      child: const Text(
                        'Paste',
                        style: TextStyle(
                          color: _accent,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
          ),

          const SizedBox(height: 16),

          // Restaurant Name label
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Text(
                  'Restaurant Name',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
                SizedBox(width: 6),
                Text(
                  '(optional)',
                  style: TextStyle(
                    color: Color(0xFF5A5A7A),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),

          // Restaurant Name Field
          _buildField(
            controller: _nameController,
            focusNode: _nameFocus,
            isFocused: _nameFocused,
            hintText: 'e.g. The Grand Spice Kitchen',
            keyboardType: TextInputType.text,
            prefixIcon: Icons.storefront_rounded,
            enabled: !widget.isLoading,
          ),

          const SizedBox(height: 28),

          // Submit Button
          SizedBox(
            height: 56,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: widget.isLoading
                    ? null
                    : const LinearGradient(
                        colors: [Color(0xFFFF6B35), Color(0xFFFF8C42)],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                color: widget.isLoading
                    ? const Color(0xFF2A2A40)
                    : null,
                boxShadow: widget.isLoading
                    ? []
                    : [
                        BoxShadow(
                          color: _accent.withValues(alpha: 0.4),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        )
                      ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: widget.isLoading ? null : _submit,
                  splashColor: Colors.white.withValues(alpha: 0.1),
                  child: Center(
                    child: widget.isLoading
                        ? const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.white54),
                                ),
                              ),
                              SizedBox(width: 12),
                              Text(
                                'Analysing Menu...',
                                style: TextStyle(
                                  color: Colors.white54,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.auto_awesome_rounded,
                                  color: Colors.white, size: 20),
                              SizedBox(width: 10),
                              Text(
                                'Generate Creatives',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required bool isFocused,
    required String hintText,
    required TextInputType keyboardType,
    required IconData prefixIcon,
    bool enabled = true,
    String? errorText,
    String? Function(String?)? validator,
    void Function(String)? onChanged,
    Widget? suffixWidget,
  }) {
    final hasError = errorText != null;
    final borderColor = hasError
        ? _errorColor
        : isFocused
            ? _borderFocus
            : _border;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: _surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: borderColor,
              width: isFocused ? 1.5 : 1,
            ),
            boxShadow: isFocused
                ? [
                    BoxShadow(
                      color: (hasError ? _errorColor : _accent)
                          .withValues(alpha: 0.12),
                      blurRadius: 8,
                      spreadRadius: 1,
                    )
                  ]
                : [],
          ),
          child: TextFormField(
            controller: controller,
            focusNode: focusNode,
            keyboardType: keyboardType,
            enabled: enabled,
            validator: validator,
            onChanged: onChanged,
            style: const TextStyle(
              color: _textMain,
              fontSize: 15,
              fontWeight: FontWeight.w400,
            ),
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: const TextStyle(
                color: _textHint,
                fontSize: 14,
                fontWeight: FontWeight.w400,
              ),
              prefixIcon: Padding(
                padding: const EdgeInsets.only(left: 4),
                child: Icon(
                  prefixIcon,
                  color: isFocused
                      ? (hasError ? _errorColor : _accent)
                      : _textHint,
                  size: 20,
                ),
              ),
              suffixIcon: suffixWidget != null
                  ? Padding(
                      padding: const EdgeInsets.only(right: 12),
                      child: suffixWidget,
                    )
                  : null,
              suffixIconConstraints:
                  const BoxConstraints(minWidth: 0, minHeight: 0),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              errorBorder: InputBorder.none,
              focusedErrorBorder: InputBorder.none,
              // Remove ALL label behavior — hint stays in place
              labelText: null,
              floatingLabelBehavior: FloatingLabelBehavior.never,
              filled: false,
              errorStyle: const TextStyle(height: 0, fontSize: 0),
            ),
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded,
                    color: _errorColor, size: 13),
                const SizedBox(width: 4),
                Text(
                  errorText,
                  style: const TextStyle(
                    color: _errorColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
