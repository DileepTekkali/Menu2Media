import 'package:flutter/material.dart';

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

class _UrlInputFormState extends State<UrlInputForm> {
  final _formKey = GlobalKey<FormState>();
  final _urlController = TextEditingController();
  final _nameController = TextEditingController();

  @override
  void dispose() {
    _urlController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      widget.onSubmit(_urlController.text.trim(), _nameController.text.trim());
    }
  }

  String? _validateUrl(String? value) {
    if (value == null || value.isEmpty) {
      return 'Please enter a restaurant URL';
    }
    final trimmed = value.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return 'URL must start with http:// or https://';
    }
    if (!trimmed.contains('.')) {
      return 'Please enter a valid URL';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _urlController,
            decoration: InputDecoration(
              labelText: 'Restaurant Website URL',
              hintText: 'https://example.com/menu',
              prefixIcon: const Icon(Icons.link),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            keyboardType: TextInputType.url,
            validator: _validateUrl,
            enabled: !widget.isLoading,
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _nameController,
            decoration: InputDecoration(
              labelText: 'Restaurant Name (optional)',
              hintText: 'My Restaurant',
              prefixIcon: const Icon(Icons.restaurant),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            enabled: !widget.isLoading,
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 56,
            child: ElevatedButton(
              onPressed: widget.isLoading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: Theme.of(context).primaryColor,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: widget.isLoading
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.search),
                        SizedBox(width: 8),
                        Text(
                          'Start Scraping',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
