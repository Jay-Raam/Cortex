import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../providers/chat_provider.dart';
import 'model_selector_sheet.dart';
import 'cowork_screen.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider);
    final selectedModel = ref.watch(selectedModelProvider);
    final selectedMode = ref.watch(selectedModeProvider);

    _scrollToBottom();

    return Scaffold(
      backgroundColor: const Color(0xFF090D12),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C1219),
        elevation: 0,
        title: GestureDetector(
          onTap: () {
            showModalBottomSheet(
              context: context,
              isScrollControlled: true,
              backgroundColor: Colors.transparent,
              builder: (_) => const ModelSelectorSheet(),
            );
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF131B26),
              border: Border.all(color: const Color(0xFF222E3F)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.bolt, size: 14, color: Color(0xFF10B981)),
                const SizedBox(width: 4),
                Text(
                  selectedModel,
                  style: const TextStyle(fontSize: 12, color: Colors.white),
                ),
                const SizedBox(width: 4),
                Text(
                  '($selectedMode)',
                  style: const TextStyle(fontSize: 10, color: Colors.white38),
                ),
              ],
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.work_outline, color: Color(0xFF10B981)),
            tooltip: 'Co-Work Workspace',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CoworkScreen()),
              );
            },
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: const Color(0xFF0C1219),
        child: Column(
          children: [
            const DrawerHeader(
              decoration: BoxDecoration(color: Color(0xFF0F1722)),
              child: Center(
                child: Text(
                  'Nexa AI Mobile',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            Expanded(
              child: ListView.builder(
                itemCount: chatState.conversations.length,
                itemBuilder: (context, index) {
                  final conv = chatState.conversations[index];
                  final isSelected = conv.id == chatState.activeConversationId;
                  return ListTile(
                    title: Text(
                      conv.title,
                      style: TextStyle(
                        color: isSelected ? const Color(0xFF10B981) : Colors.white70,
                        fontSize: 13,
                      ),
                    ),
                    onTap: () {
                      ref.read(chatProvider.notifier).selectConversation(conv.id);
                      Navigator.pop(context);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(12),
              itemCount: chatState.messages.length + (chatState.isStreaming ? 1 : 0),
              itemBuilder: (context, index) {
                if (index < chatState.messages.length) {
                  final msg = chatState.messages[index];
                  final isUser = msg.role == 'user';
                  return Container(
                    margin: const EdgeInsets.symmetric(vertical: 6),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isUser ? const Color(0xFF16212E) : const Color(0xFF0E1520),
                      border: Border.all(
                        color: isUser ? const Color(0xFF27384D) : const Color(0xFF1F2C3D),
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isUser ? 'You' : 'Nexa Assistant (${msg.modelUsed ?? selectedModel})',
                          style: TextStyle(
                            color: isUser ? Colors.white54 : const Color(0xFF34D399),
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 6),
                        MarkdownBody(
                          data: msg.content,
                          styleSheet: MarkdownStyleSheet(
                            p: const TextStyle(color: Colors.white, fontSize: 13),
                            code: const TextStyle(
                              backgroundColor: Color(0xFF080D14),
                              color: Color(0xFF34D399),
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                } else {
                  // Streaming item
                  return Container(
                    margin: const EdgeInsets.symmetric(vertical: 6),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0E1520),
                      border: Border.all(color: const Color(0xFF10B981)),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: MarkdownBody(
                      data: '${chatState.streamingContent} ▌',
                      styleSheet: MarkdownStyleSheet(
                        p: const TextStyle(color: Colors.white, fontSize: 13),
                      ),
                    ),
                  );
                }
              },
            ),
          ),

          // Composer row
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: Color(0xFF0C1219),
              border: Border(top: BorderSide(color: Color(0xFF1D2737))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Message Nexa...',
                      hintStyle: const TextStyle(color: Colors.white38),
                      filled: true,
                      fillColor: const Color(0xFF131B26),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFF222E3F)),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: () {
                    final text = _controller.text;
                    _controller.clear();
                    ref.read(chatProvider.notifier).sendMessage(text);
                  },
                  icon: const Icon(Icons.arrow_upward, color: Color(0xFF10B981)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
