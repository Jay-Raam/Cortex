import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import '../providers/chat_provider.dart';

class ModelSelectorSheet extends ConsumerWidget {
  const ModelSelectorSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final modelsAsync = ref.watch(modelsProvider);
    final selectedModel = ref.watch(selectedModelProvider);
    final selectedMode = ref.watch(selectedModeProvider);

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E7EB),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Select Model',
            style: TextStyle(
              color: Color(0xFF111827),
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),

          // Mode Selector
          Row(
            children: [
              _modeButton(context, ref, 'efficient', 'Efficient', selectedMode),
              const SizedBox(width: 8),
              _modeButton(context, ref, 'balanced', 'Balanced', selectedMode),
              const SizedBox(width: 8),
              _modeButton(context, ref, 'powerful', 'Powerful', selectedMode),
            ],
          ),
          const SizedBox(height: 16),

          // Models List
          Expanded(
            child: modelsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: Colors.black)),
              error: (err, stack) => Center(
                child: Text('Failed to load models: $err', style: const TextStyle(color: Colors.red)),
              ),
              data: (models) {
                return ListView.builder(
                  itemCount: models.length,
                  itemBuilder: (context, index) {
                    final model = models[index];
                    final isSelected = model.id == selectedModel;
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      tileColor: isSelected ? const Color(0xFFF3F4F6) : Colors.transparent,
                      title: Row(
                        children: [
                          Text(
                            model.displayName,
                            style: TextStyle(
                              color: const Color(0xFF111827),
                              fontSize: 14,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                          if (model.isFree) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFECFDF5),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'FREE',
                                style: TextStyle(
                                  color: Color(0xFF059669),
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      subtitle: Text(
                        model.provider,
                        style: const TextStyle(color: Color(0xFF6B7280), fontSize: 11),
                      ),
                      trailing: isSelected
                          ? const Icon(Icons.check, color: Colors.black, size: 18)
                          : null,
                      onTap: () {
                        ref.read(selectedModelProvider.notifier).state = model.id;
                        Navigator.pop(context);
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _modeButton(
    BuildContext context,
    WidgetRef ref,
    String modeKey,
    String label,
    String currentMode,
  ) {
    final isSelected = currentMode == modeKey;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          ref.read(selectedModeProvider.notifier).state = modeKey;
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? Colors.black : const Color(0xFFF3F4F6),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : const Color(0xFF4B5563),
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
