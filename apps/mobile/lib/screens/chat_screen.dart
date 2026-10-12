import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import '../providers/chat_provider.dart';
import 'model_selector_sheet.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  bool _isThoughtExpanded = true;

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

    final bool isEmpty = chatState.messages.isEmpty && !chatState.isStreaming;
    final activeConv = chatState.conversations.firstWhere(
      (c) => c.id == chatState.activeConversationId,
      orElse: () => Conversation(id: '', title: 'Review Q3 Support Report', updatedAt: ''),
    );

    if (!isEmpty) {
      _scrollToBottom();
    }

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFFF7F7F5),
      drawer: _buildKrakenDrawer(context, ref, chatState),
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: SafeArea(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: const BoxDecoration(
              color: Color(0xFFF7F7F5),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Left Drawer Icon (Two small vertical rectangles icon like Screen A/B/C)
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.view_sidebar_outlined, size: 22, color: Color(0xFF1F2937)),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => _scaffoldKey.currentState?.openDrawer(),
                    ),
                    const SizedBox(width: 14),
                    // In Screen B, title is shown in the middle
                    if (!isEmpty)
                      Text(
                        activeConv.title.isNotEmpty ? activeConv.title : 'Review Q3 Support Report',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827),
                        ),
                      )
                    else
                      IconButton(
                        icon: const Icon(Icons.search, size: 22, color: Color(0xFF4B5563)),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () {},
                      ),
                  ],
                ),

                // Center logo only in Empty Screen
                if (isEmpty)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          color: Colors.black,
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: const Center(
                          child: Text(
                            'K',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 13,
                              letterSpacing: -1,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                // Right Profile Avatar / Actions
                Row(
                  children: [
                    if (!isEmpty)
                      IconButton(
                        icon: const Icon(Icons.add, size: 22, color: Color(0xFF1F2937)),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () {
                          ref.read(chatProvider.notifier).createConversation();
                        },
                      ),
                    if (!isEmpty) const SizedBox(width: 12),
                    Container(
                      width: 32,
                      height: 32,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Color(0xFFE5E7EB),
                      ),
                      child: ClipOval(
                        child: Container(
                          color: const Color(0xFF3B82F6),
                          child: const Center(
                            child: Text(
                              'M',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      body: isEmpty
          ? _buildScreenAEmpty(context, ref, selectedModel, selectedMode)
          : _buildScreenBActive(context, ref, chatState, selectedModel, selectedMode),
    );
  }

  // SCREEN A: Hello Milo Empty State matching reference Screen 1
  Widget _buildScreenAEmpty(
    BuildContext context,
    WidgetRef ref,
    String selectedModel,
    String selectedMode,
  ) {
    return Column(
      children: [
        const Spacer(),
        // Center text: "Hello, Milo"
        const Text(
          'Hello, Milo',
          style: TextStyle(
            fontSize: 32,
            fontWeight: FontWeight.w700,
            color: Color(0xFF111827),
            letterSpacing: -0.5,
          ),
        ),
        const Spacer(),

        // Floating composer card at bottom of Screen A
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
          child: _buildFloatingComposer(
            context,
            ref,
            selectedModel,
            selectedMode,
            placeholder: 'How can I help you today?',
          ),
        ),
      ],
    );
  }

  // SCREEN B: Active Conversation State matching reference Screen 2
  Widget _buildScreenBActive(
    BuildContext context,
    WidgetRef ref,
    ChatState chatState,
    String selectedModel,
    String selectedMode,
  ) {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            itemCount: chatState.messages.length + (chatState.isStreaming ? 1 : 0),
            itemBuilder: (context, index) {
              if (index < chatState.messages.length) {
                final msg = chatState.messages[index];
                final isUser = msg.role === 'user' || msg.role == 'user';

                if (isUser) {
                  // User bubble aligned to right (Screen B style)
                  return Align(
                    alignment: Alignment.centerRight,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 16, left: 48),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE5E7EB),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        msg.content,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF111827),
                          height: 1.4,
                        ),
                      ),
                    ),
                  );
                } else {
                  // Assistant response with "Thought" expander + PDF citation pill + Markdown bullets
                  return Container(
                    margin: const EdgeInsets.only(bottom: 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Thought Collapsible Box (Screen B: "Thought 24s ⌵")
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              InkWell(
                                onTap: () {
                                  setState(() {
                                    _isThoughtExpanded = !_isThoughtExpanded;
                                  });
                                },
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.lightbulb_outline, size: 16, color: Color(0xFF4B5563)),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'Thought',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF1F2937),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      const Text(
                                        '24s',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFF9CA3AF),
                                        ),
                                      ),
                                      const Spacer(),
                                      Icon(
                                        _isThoughtExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                                        size: 18,
                                        color: const Color(0xFF6B7280),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              if (_isThoughtExpanded)
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                                  child: Text(
                                    'Thinking Process:\n1. Analyze Q3 support ticket volume & trends\n2. Highlight customer satisfaction rate (98%)\n3. Format key achievements and action items',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey.shade600,
                                      height: 1.4,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),

                        // Citation Pill (Screen B: "Viewed Q3_IT_Support_Report.pdf")
                        Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            border: Border.all(color: const Color(0xFFDBEAFE)),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Icon(Icons.remove_red_eye_outlined, size: 14, color: Color(0xFF2563EB)),
                              SizedBox(width: 6),
                              Text(
                                'Viewed ',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF6B7280),
                                ),
                              ),
                              Icon(Icons.picture_as_pdf, size: 13, color: Color(0xFFDC2626)),
                              SizedBox(width: 4),
                              Text(
                                'Q3_IT_Support_Report.pdf',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF1D4ED8),
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Main Markdown Content (Screen B bullet trends)
                        MarkdownBody(
                          data: msg.content,
                          styleSheet: MarkdownStyleSheet(
                            p: const TextStyle(
                              color: Color(0xFF1F2937),
                              fontSize: 14,
                              height: 1.5,
                            ),
                            h1: const TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                            h2: const TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                            h3: const TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                            listBullet: const TextStyle(
                              color: Color(0xFF111827),
                              fontSize: 14,
                            ),
                            code: const TextStyle(
                              backgroundColor: Color(0xFFF3F4F6),
                              color: Color(0xFF111827),
                              fontFamily: 'monospace',
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }
              } else {
                // Streaming bubble
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Row(
                    children: [
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          chatState.streamingContent.isNotEmpty
                              ? chatState.streamingContent
                              : 'Generating smart response...',
                          style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563)),
                        ),
                      ),
                    ],
                  ),
                );
              }
            },
          ),
        ),

        // Bottom Composer in Screen B
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: _buildFloatingComposer(
            context,
            ref,
            selectedModel,
            selectedMode,
            placeholder: 'Ask follow up...',
          ),
        ),
      ],
    );
  }

  // Floating Pill Composer Card (Matches Image 2 bottom card in Screen A & B)
  Widget _buildFloatingComposer(
    BuildContext context,
    WidgetRef ref,
    String selectedModel,
    String selectedMode, {
    required String placeholder,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _controller,
            maxLines: 4,
            minLines: 1,
            style: const TextStyle(fontSize: 14, color: Color(0xFF111827)),
            decoration: InputDecoration(
              hintText: placeholder,
              hintStyle: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
              isDense: true,
              border: InputBorder.none,
              contentPadding: EdgeInsets.zero,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              // Plus (+) attachment button
              GestureDetector(
                onTap: () {},
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Center(
                    child: Icon(Icons.add, size: 16, color: Color(0xFF4B5563)),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Model badge pill: "Astra Max ⌵"
              GestureDetector(
                onTap: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => const ModelSelectorSheet(),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Text(
                        selectedModel.isNotEmpty ? selectedModel : 'Astra Max',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1F2937),
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.keyboard_arrow_down, size: 14, color: Color(0xFF6B7280)),
                    ],
                  ),
                ),
              ),

              const Spacer(),

              // Mic icon
              IconButton(
                icon: const Icon(Icons.mic_none, size: 20, color: Color(0xFF6B7280)),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () {},
              ),
              const SizedBox(width: 8),

              // Send black circle button with arrow
              GestureDetector(
                onTap: () {
                  final text = _controller.text.trim();
                  if (text.isNotEmpty) {
                    _controller.clear();
                    ref.read(chatProvider.notifier).sendMessage(text);
                  }
                },
                child: Container(
                  width: 32,
                  height: 32,
                  decoration: const BoxDecoration(
                    color: Colors.black,
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.arrow_upward, size: 18, color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // SCREEN C: Slide-out Navigation Drawer matching reference Screen 3
  Widget _buildKrakenDrawer(
    BuildContext context,
    WidgetRef ref,
    ChatState chatState,
  ) {
    return Drawer(
      backgroundColor: const Color(0xFFF7F7F5),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drawer Header with Kraken Logo & Search / Window icons
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: Colors.black,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Center(
                          child: Text(
                            'K',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Kraken',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF111827),
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.search, size: 20, color: Color(0xFF4B5563)),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () {},
                      ),
                      const SizedBox(width: 12),
                      IconButton(
                        icon: const Icon(Icons.view_sidebar_outlined, size: 20, color: Color(0xFF4B5563)),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Top Menu Items (Screen C: New chat, Library, Projects, Plugins)
            _buildDrawerMenuItem(
              icon: Icons.chat_bubble_outline,
              label: 'New chat',
              onTap: () {
                ref.read(chatProvider.notifier).createConversation();
                Navigator.pop(context);
              },
            ),
            _buildDrawerMenuItem(
              icon: Icons.folder_open_outlined,
              label: 'Library',
              onTap: () {},
            ),
            _buildDrawerMenuItem(
              icon: Icons.dashboard_outlined,
              label: 'Projects',
              onTap: () {},
            ),
            _buildDrawerMenuItem(
              icon: Icons.extension_outlined,
              label: 'Plugins',
              onTap: () {},
            ),

            const Divider(color: Color(0xFFE5E7EB), height: 24, indent: 16, endIndent: 16),

            // Grouped Conversation History (Screen C: Pinned, Today, Yesterday, Previous week)
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _buildSectionHeader('Pinned'),
                  _buildHistoryItem('Product launch checklist', true),

                  const SizedBox(height: 12),
                  _buildSectionHeader('Today'),
                  _buildHistoryItem('Review Q3 Support Report', false, isSelected: true),
                  _buildHistoryItem('Design system component audit', false),

                  const SizedBox(height: 12),
                  _buildSectionHeader('Yesterday'),
                  _buildHistoryItem('API response optimization notes', false),
                  _buildHistoryItem('Draft pitch deck overview', false),

                  const SizedBox(height: 12),
                  _buildSectionHeader('Previous week'),
                  _buildHistoryItem('Quarterly planning summary', false),
                  _buildHistoryItem('Customer interview synthesis', false),
                ],
              ),
            ),

            // User Profile Footer in Drawer
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
              ),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF3B82F6),
                    ),
                    child: const Center(
                      child: Text(
                        'M',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Text(
                        'Milo Vance',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827),
                        ),
                      ),
                      Text(
                        'Pro Member',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  const Icon(Icons.settings_outlined, size: 18, color: Color(0xFF6B7280)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawerMenuItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
        child: Row(
          children: [
            Icon(icon, size: 18, color: const Color(0xFF374151)),
            const SizedBox(width: 12),
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Color(0xFF1F2937),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: Color(0xFF9CA3AF),
          letterSpacing: 0.3,
        ),
      ),
    );
  }

  Widget _buildHistoryItem(String title, bool isPinned, {bool isSelected = false}) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 2),
      decoration: BoxDecoration(
        color: isSelected ? const Color(0xFFE5E7EB) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        child: Row(
          children: [
            if (isPinned)
              const Padding(
                padding: EdgeInsets.only(right: 6),
                child: Icon(Icons.push_pin, size: 12, color: Color(0xFF6B7280)),
              ),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected ? const Color(0xFF111827) : const Color(0xFF374151),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
