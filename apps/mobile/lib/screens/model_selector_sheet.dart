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
        color: Color(0xFF0F1722),
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
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Model Selector & Routing',
            style: TextStyle(
              color: Colors.white,
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
              data: (models) => ListView.builder(
                itemCount: models.length,
                itemBuilder: (context, index) {
                  final model = models[index];
                  final isSelected = model.id == selectedModel;
                  return InkWell(
                    onTap: () {
                      ref.read(selectedModelProvider.notifier).state = model.id;
                      ref.read(selectedModeProvider.notifier).state = model.mode;
                      Navigator.pop(context);
                    },
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF13221B) : const Color(0xFF131B26),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF10B981) : const Color(0xFF222E3F),
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      model.displayName,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                    ),
                                    if (model.isFree) ...[
                                      const SizedBox(width: 6),
                                      const Text(
                                        '· Free',
                                        style: TextStyle(
                                          color: Color(0xFF34D399),
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  model.description,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${model.latencyMs}ms',
                            style: const TextStyle(
                              color: Colors.white38,
                              fontFamily: 'monospace',
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              loading: () => const Center(
                child: CircularProgressIndicator(color: Color(0xFF10B981)),
              ),
              error: (err, _) => Center(
                child: Text('Error loading models: $err',
                    style: const TextStyle(color: Colors.redAccent)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _modeButton(BuildContext context, WidgetRef ref, String modeKey,
      String label, String activeMode) {
    final isSelected = activeMode == modeKey;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          ref.read(selectedModeProvider.notifier).state = modeKey;
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF13221B) : const Color(0xFF131B26),
            border: Border.all(
              color: isSelected ? const Color(0xFF10B981) : const Color(0xFF222E3F),
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? const Color(0xFF34D399) : Colors.white70,
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
