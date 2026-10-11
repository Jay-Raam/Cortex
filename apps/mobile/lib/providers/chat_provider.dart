import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';
import '../services/api_service.dart';

final apiServiceProvider = Provider<ApiService>((ref) => ApiService());

final modelsProvider = FutureProvider<List<ModelInfo>>((ref) async {
  final api = ref.watch(apiServiceProvider);
  return api.getModels();
});

final selectedModelProvider = StateProvider<String>((ref) => 'gemini-3.8-flash');
final selectedModeProvider = StateProvider<String>((ref) => 'balanced');

class ChatState {
  final List<Conversation> conversations;
  final String? activeConversationId;
  final List<Message> messages;
  final bool isStreaming;
  final String streamingContent;

  ChatState({
    this.conversations = const [],
    this.activeConversationId,
    this.messages = const [],
    this.isStreaming = false,
    this.streamingContent = '',
  });

  ChatState copyWith({
    List<Conversation>? conversations,
    String? activeConversationId,
    List<Message>? messages,
    bool? isStreaming,
    String? streamingContent,
  }) {
    return ChatState(
      conversations: conversations ?? this.conversations,
      activeConversationId: activeConversationId ?? this.activeConversationId,
      messages: messages ?? this.messages,
      isStreaming: isStreaming ?? this.isStreaming,
      streamingContent: streamingContent ?? this.streamingContent,
    );
  }
}

class ChatNotifier extends StateNotifier<ChatState> {
  final ApiService api;
  final Ref ref;

  ChatNotifier(this.api, this.ref) : super(ChatState()) {
    loadConversations();
  }

  Future<void> loadConversations() async {
    try {
      final convs = await api.getConversations();
      state = state.copyWith(conversations: convs);
      if (convs.isNotEmpty && state.activeConversationId == null) {
        selectConversation(convs.first.id);
      }
    } catch (_) {}
  }

  Future<void> selectConversation(String id) async {
    state = state.copyWith(activeConversationId: id);
    try {
      final msgs = await api.getMessages(id);
      state = state.copyWith(messages: msgs);
    } catch (_) {}
  }

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty || state.isStreaming) return;

    final convId = state.activeConversationId ?? 'conv_default';
    final userMsg = Message(
      id: 'local_${DateTime.now().millisecondsSinceEpoch}',
      conversationId: convId,
      role: 'user',
      content: text,
      createdAt: DateTime.now(),
    );

    state = state.copyWith(
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingContent: '',
    );

    final modelId = ref.read(selectedModelProvider);
    final mode = ref.read(selectedModeProvider);

    String accumulated = '';
    try {
      final stream = api.streamChat(
        conversationId: convId,
        content: text,
        modelId: modelId,
        mode: mode,
      );

      await for (final delta in stream) {
        accumulated += delta;
        state = state.copyWith(streamingContent: accumulated);
      }

      final assistantMsg = Message(
        id: 'asst_${DateTime.now().millisecondsSinceEpoch}',
        conversationId: convId,
        role: 'assistant',
        content: accumulated,
        modelUsed: modelId,
        createdAt: DateTime.now(),
      );

      state = state.copyWith(
        messages: [...state.messages, assistantMsg],
        isStreaming: false,
        streamingContent: '',
      );
    } catch (e) {
      state = state.copyWith(
        messages: [
          ...state.messages,
          Message(
            id: 'err_${DateTime.now().millisecondsSinceEpoch}',
            conversationId: convId,
            role: 'assistant',
            content: 'Error: $e',
            createdAt: DateTime.now(),
          )
        ],
        isStreaming: false,
        streamingContent: '',
      );
    }
  }
}

final chatProvider = StateNotifierProvider<ChatNotifier, ChatState>((ref) {
  final api = ref.watch(apiServiceProvider);
  return ChatNotifier(api, ref);
});
