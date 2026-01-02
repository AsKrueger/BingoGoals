import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'history_provider.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(historyProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Historial de Bingos')),
      body: history.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.history_edu, size: 80, color: Colors.grey[300]),
                  const SizedBox(height: 16),
                  Text(
                    'Aún no tienes bingos archivados',
                    style: TextStyle(color: Colors.grey[600], fontSize: 16),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: history.length,
              itemBuilder: (context, index) {
                final board = history[index];
                final completedCount = board.cells.where((c) => c.isCompleted).length;
                final percentage = (completedCount / board.cells.length * 100).toStringAsFixed(0);

                return Card(
                  margin: const EdgeInsets.bottom(16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    title: Text(
                      board.title,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 8),
                        Text('Completado: $percentage% ($completedCount/${board.cells.length})'),
                        Text('Fecha: ${board.createdAt.day}/${board.createdAt.month}/${board.createdAt.year}'),
                      ],
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline, color: Colors.red),
                      onPressed: () => ref.read(historyProvider.notifier).deleteFromHistory(board.id),
                    ),
                    onTap: () {
                      // Aquí podrías mostrar una vista previa del bingo antiguo
                    },
                  ),
                );
              },
            ),
    );
  }
}
