import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;
import '../models/models.dart';

class ApiService {
  final String baseUrl;
  final Dio dio;

  ApiService({this.baseUrl = 'http://10.0.2.2:3000'})
      : dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'Content-Type': 'application/json'},
        ));

  Future<Map<String, dynamic>> queryGraphQL(
      String query, Map<String, dynamic> variables) async {
    final response = await dio.post('/graphql', data: {
      'query': query,
      'variables': variables,
    });

    if (response.statusCode == 200 && response.data['data'] != null) {
      return response.data['data'];
    }
    throw Exception('GraphQL error: ${response.data['errors']}');
  }

  Future<List<ModelInfo>> getModels() async {
    const query = '''
      query {
        models {
          id
          providerId
          displayName
          description
          mode
          isFree
          contextWindow
          availability
          latencyMs
        }
      }
    ''';
    final data = await queryGraphQL(query, {});
    final list = data['models'] as List<dynamic>;
    return list.map((m) => ModelInfo.fromJson(m)).toList();
  }

  Future<List<Conversation>> getConversations() async {
    const query = '''
      query {
        conversations {
          id
          title
          modelId
          mode
          isPinned
          createdAt
        }
      }
    ''';
    final data = await queryGraphQL(query, {});
    final list = data['conversations'] as List<dynamic>;
    return list.map((c) => Conversation.fromJson(c)).toList();
  }

  Future<List<Message>> getMessages(String conversationId) async {
    const query = '''
      query GetMessages(\$id: ID!) {
        conversation(id: \$id) {
          messages {
            id
            role
            content
            modelUsed
            createdAt
          }
        }
      }
    ''';
    final data = await queryGraphQL(query, {'id': conversationId});
    if (data['conversation'] == null) return [];
    final list = data['conversation']['messages'] as List<dynamic>;
    return list.map((m) => Message.fromJson(m)).toList();
  }

  /// SSE Stream generator for real-time chat tokens
  Stream<String> streamChat({
    required String conversationId,
    required String content,
    required String modelId,
    required String mode,
  }) async* {
    final client = http.Client();
    final request = http.Request(
      'POST',
      Uri.parse('$baseUrl/api/chat/stream'),
    );

    request.headers['Content-Type'] = 'application/json';
    request.body = jsonEncode({
      'conversationId': conversationId,
      'content': content,
      'modelId': modelId,
      'mode': mode,
    });

    final response = await client.send(request);
    final stream = response.stream.transform(utf8.decoder).transform(const LineSplitter());

    await for (final line in stream) {
      if (line.startsWith('data: ')) {
        final jsonStr = line.substring(6).trim();
        try {
          final event = jsonDecode(jsonStr);
          if (event['type'] == 'delta') {
            yield event['payload']['text'] as String;
          } else if (event['type'] == 'completed') {
            break;
          }
        } catch (_) {}
      }
    }
    client.close();
  }
}
