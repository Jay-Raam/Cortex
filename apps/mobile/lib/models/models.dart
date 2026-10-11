class ModelInfo {
  final String id;
  final String providerId;
  final String displayName;
  final String description;
  final String mode;
  final bool isFree;
  final int contextWindow;
  final String availability;
  final int latencyMs;

  ModelInfo({
    required this.id,
    required this.providerId,
    required this.displayName,
    required this.description,
    required this.mode,
    required this.isFree,
    required this.contextWindow,
    required this.availability,
    required this.latencyMs,
  });

  factory ModelInfo.fromJson(Map<String, dynamic> json) {
    return ModelInfo(
      id: json['id'] ?? '',
      providerId: json['providerId'] ?? '',
      displayName: json['displayName'] ?? '',
      description: json['description'] ?? '',
      mode: json['mode'] ?? 'balanced',
      isFree: json['isFree'] ?? false,
      contextWindow: json['contextWindow'] ?? 128000,
      availability: json['availability'] ?? 'available',
      latencyMs: json['latencyMs'] ?? 200,
    );
  }
}

class Conversation {
  final String id;
  final String title;
  final String modelId;
  final String mode;
  final bool isPinned;
  final DateTime createdAt;

  Conversation({
    required this.id,
    required this.title,
    required this.modelId,
    required this.mode,
    required this.isPinned,
    required this.createdAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] ?? '',
      title: json['title'] ?? 'New Chat',
      modelId: json['modelId'] ?? 'gemini-3.8-flash',
      mode: json['mode'] ?? 'balanced',
      isPinned: json['isPinned'] ?? false,
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
    );
  }
}

class Message {
  final String id;
  final String conversationId;
  final String role;
  final String content;
  final String? modelUsed;
  final DateTime createdAt;

  Message({
    required this.id,
    required this.conversationId,
    required this.role,
    required this.content,
    this.modelUsed,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] ?? '',
      conversationId: json['conversationId'] ?? '',
      role: json['role'] ?? 'user',
      content: json['content'] ?? '',
      modelUsed: json['modelUsed'],
      createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
    );
  }
}

class AgentTaskStep {
  final String id;
  final String title;
  final String description;
  final String status;
  final String? tool;
  final bool requiresApproval;
  final bool isApproved;

  AgentTaskStep({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    this.tool,
    required this.requiresApproval,
    required this.isApproved,
  });

  factory AgentTaskStep.fromJson(Map<String, dynamic> json) {
    return AgentTaskStep(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
      status: json['status'] ?? 'pending',
      tool: json['tool'],
      requiresApproval: json['requiresApproval'] ?? false,
      isApproved: json['isApproved'] ?? false,
    );
  }
}

class AgentTask {
  final String id;
  final String workspaceId;
  final String title;
  final String goal;
  final String status;
  final List<AgentTaskStep> steps;
  final String? summary;

  AgentTask({
    required this.id,
    required this.workspaceId,
    required this.title,
    required this.goal,
    required this.status,
    required this.steps,
    this.summary,
  });

  factory AgentTask.fromJson(Map<String, dynamic> json) {
    final stepsList = (json['steps'] as List<dynamic>? ?? [])
        .map((s) => AgentTaskStep.fromJson(s as Map<String, dynamic>))
        .toList();

    return AgentTask(
      id: json['id'] ?? '',
      workspaceId: json['workspaceId'] ?? '',
      title: json['title'] ?? '',
      goal: json['goal'] ?? '',
      status: json['status'] ?? 'queued',
      steps: stepsList,
      summary: json['summary'],
    );
  }
}

class WorkspaceArtifact {
  final String id;
  final String title;
  final String fileName;
  final String language;
  final String content;
  final int version;

  WorkspaceArtifact({
    required this.id,
    required this.title,
    required this.fileName,
    required this.language,
    required this.content,
    required this.version,
  });

  factory WorkspaceArtifact.fromJson(Map<String, dynamic> json) {
    return WorkspaceArtifact(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      fileName: json['fileName'] ?? '',
      language: json['language'] ?? 'plaintext',
      content: json['content'] ?? '',
      version: json['version'] ?? 1,
    );
  }
}
