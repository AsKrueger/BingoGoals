import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../bingo/presentation/bingo_provider.dart';
import '../../bingo/domain/bingo_models.dart';

class StatsScreen extends ConsumerWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(bingoProvider);
    final notifier = ref.read(bingoProvider.notifier);

    if (board == null) return const Scaffold(body: Center(child: Text('No hay datos')));

    return Scaffold(
      appBar: AppBar(title: const Text('Estadísticas y Progreso')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            _buildStatCard(
              context,
              'Progreso General',
              '${(notifier.progress * 100).toStringAsFixed(1)}%',
              Icons.trending_up,
              Colors.blue,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    context,
                    'Completados',
                    '${notifier.completedCount}',
                    Icons.check_circle_outline,
                    Colors.green,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildStatCard(
                    context,
                    'Pendientes',
                    '${board.cells.length - notifier.completedCount}',
                    Icons.pending_actions,
                    Colors.orange,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'Resumen del Bingo',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
              ),
              child: Column(
                children: [
                  _buildDetailRow('Nombre', board.title),
                  _buildDetailRow('Tamaño', board.size == BingoSize.fiveByFive ? '5x5' : '3x3'),
                  _buildDetailRow('Fecha creación', '${board.createdAt.day}/${board.createdAt.month}/${board.createdAt.year}'),
                  _buildDetailRow('Frecuencia', 'Libre'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(BuildContext context, String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 30),
          const SizedBox(height: 12),
          Text(title, style: TextStyle(color: Colors.grey[700], fontSize: 14)),
          Text(value, style: TextStyle(color: color, fontSize: 28, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
