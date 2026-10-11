import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CoworkScreen extends ConsumerStatefulWidget {
  const CoworkScreen({super.key});

  @override
  ConsumerState<CoworkScreen> createState() => _CoworkScreenState();
}

class _CoworkScreenState extends ConsumerState<CoworkScreen> {
  final List<Map<String, dynamic>> _mockTasks = [
    {
      'title': 'Distributed Rate Limiter Module',
      'goal': 'Design and engineer distributed token bucket limiter in TypeScript',
      'status': 'completed',
      'steps': [
        {'title': 'Enumerate Workspace files', 'status': 'completed'},
        {'title': 'Synthesize rate limiter spec', 'status': 'completed'},
        {'title': 'Execute AST verification diff', 'status': 'completed'},
      ],
    },
    {
      'title': 'Security Audit & OWASP Review',
      'goal': 'Analyze repository boundaries for authorization bypass and prompt injection',
      'status': 'running',
      'steps': [
        {'title': 'Scan workspace endpoints', 'status': 'completed'},
        {'title': 'Formulate audit report artifact', 'status': 'running'},
        {'title': 'Require approval for export', 'status': 'pending'},
      ],
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF090D12),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0C1219),
        title: const Text(
          'Co-Work Workspace',
          style: TextStyle(color: Colors.white, fontSize: 16),
        ),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _mockTasks.length,
        itemBuilder: (context, index) {
          final task = _mockTasks[index];
          final steps = task['steps'] as List<dynamic>;

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF0F1722),
              border: Border.all(color: const Color(0xFF222E3F)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      task['title'],
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: task['status'] == 'completed'
                            ? const Color(0xFF13221B)
                            : const Color(0xFF1E2838),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        task['status'],
                        style: TextStyle(
                          color: task['status'] == 'completed'
                              ? const Color(0xFF34D399)
                              : Colors.blueAccent,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  task['goal'],
                  style: const TextStyle(color: Colors.white70, fontSize: 12),
                ),
                const Divider(color: Color(0xFF1D2737), height: 20),
                const Text(
                  'Execution Steps:',
                  style: TextStyle(color: Colors.white38, fontSize: 11),
                ),
                const SizedBox(height: 6),
                ...steps.map((s) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        children: [
                          Icon(
                            s['status'] == 'completed'
                                ? Icons.check_circle_outline
                                : s['status'] == 'running'
                                    ? Icons.refresh
                                    : Icons.schedule,
                            size: 14,
                            color: s['status'] == 'completed'
                                ? const Color(0xFF34D399)
                                : Colors.white38,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            s['title'],
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                          ),
                        ],
                      ),
                    )),
              ],
            ),
          );
        },
      ),
    );
  }
}
