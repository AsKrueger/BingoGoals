import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'bingo_provider.dart';
import '../domain/bingo_models.dart';
import 'edit_cell_dialog.dart';
import 'celebration_overlay.dart';

class BingoScreen extends ConsumerWidget {
  const BingoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(bingoProvider);
    final notifier = ref.read(bingoProvider.notifier);

    if (board == null) return const Scaffold(body: Center(child: Text('No hay bingo activo')));

    return Scaffold(
      appBar: AppBar(
        title: Text(board.title),
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: () => _shareProgress(board, notifier.completedCount),
          ),
          IconButton(
            icon: const Icon(Icons.bar_chart),
            onPressed: () => Navigator.pushNamed(context, '/stats'),
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.pushNamed(context, '/settings'),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildProgressHeader(context, board, notifier),
          const Divider(height: 1),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: GridView.builder(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: board.dimension,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemCount: board.cells.length,
                itemBuilder: (context, index) {
                  final cell = board.cells[index];
                  return BingoCellWidget(
                    cell: cell,
                    onTap: () {
                      final wasCompleted = cell.isCompleted;
                      notifier.toggleCell(index);
                      
                      // Si acaba de completar la celda y resulta en Bingo
                      if (!wasCompleted && notifier.checkWin()) {
                        _showCelebration(context);
                      }
                    },
                    onLongPress: () async {
                      final result = await showDialog<Map<String, dynamic>>(
                        context: context,
                        builder: (context) => EditCellDialog(cell: cell),
                      );
                      if (result != null) {
                        notifier.updateCell(
                          index, 
                          result['text'], 
                          result['color'],
                          result['iconCode'],
                        );
                      }
                    },
                  );
                },
              ),
            ),
          ),
          _buildFooter(context),
        ],
      ),
    );
  }

  Widget _buildProgressHeader(BuildContext context, BingoBoard board, BingoNotifier notifier) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary.withOpacity(0.05),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Tu progreso',
                style: TextStyle(fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary),
              ),
              Text(
                '${(notifier.progress * 100).toStringAsFixed(0)}%',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: notifier.progress,
              minHeight: 10,
              backgroundColor: Colors.grey[300],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${notifier.completedCount} de ${board.cells.length} casillas marcadas',
            style: TextStyle(fontSize: 12, color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.info_outline, size: 16, color: Colors.grey[400]),
          const SizedBox(width: 8),
          Text(
            'Mantén pulsado para editar tus metas',
            style: TextStyle(color: Colors.grey[500], fontSize: 13, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }

  void _showCelebration(BuildContext context) {
    showDialog(
      context: context,
      barrierColor: Colors.black87,
      builder: (context) => const CelebrationOverlay(),
    );
  }

  void _shareProgress(BingoBoard board, int completed) {
    final text = '¡Estoy avanzando en mis metas con #BingoGoals! 🎯\n\n'
        'Reto: ${board.title}\n'
        'Progreso: $completed/${board.cells.length} casillas completadas.\n\n'
        '¿Y tú? ¿A qué esperas para cumplir tus propósitos? 🚀';
    
    Share.share(text);
  }
}

class BingoCellWidget extends StatelessWidget {
  final BingoCell cell;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const BingoCellWidget({
    super.key,
    required this.cell,
    required this.onTap,
    required this.onLongPress,
  });

  @override
  Widget build(BuildContext context) {
    final Color baseColor = cell.colorValue != null ? Color(cell.colorValue!) : Colors.white;
    final bool isDark = baseColor.computeLuminance() < 0.5;
    
    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.elasticOut,
        transform: Matrix4.identity()..scale(cell.isCompleted ? 1.0 : 0.95),
        decoration: BoxDecoration(
          color: cell.isCompleted ? baseColor : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: cell.isCompleted ? baseColor : Colors.grey[200]!,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: cell.isCompleted ? baseColor.withOpacity(0.3) : Colors.black.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (cell.iconCode != null || cell.isCentralStar)
              Opacity(
                opacity: cell.isCompleted ? 0.2 : 0.1,
                child: Icon(
                  cell.isCentralStar && cell.iconCode == null 
                      ? Icons.stars 
                      : IconData(cell.iconCode ?? Icons.star.codePoint, fontFamily: 'MaterialIcons'),
                  size: 40,
                  color: cell.isCompleted ? (isDark ? Colors.white : Colors.black) : Colors.black,
                ),
              ),
            
            Padding(
              padding: const EdgeInsets.all(6.0),
              child: Text(
                cell.text,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: cell.isCentralStar ? 13 : 11,
                  fontWeight: cell.isCentralStar ? FontWeight.bold : FontWeight.w600,
                  color: cell.isCompleted 
                      ? (isDark ? Colors.white : Colors.black87)
                      : Colors.black54,
                ),
                maxLines: 4,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            
            if (cell.isCompleted)
              Positioned(
                top: 4,
                right: 4,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                  child: Icon(Icons.check, size: 10, color: baseColor),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
