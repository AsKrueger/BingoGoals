import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'bingo_provider.dart';
import 'bingo_screen.dart';

class BoardCollectionScreen extends ConsumerWidget {
  const BoardCollectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bingoState = ref.watch(bingoProvider);
    final notifier = ref.read(bingoProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('MIS BINGOS', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5)),
        centerTitle: true,
      ),
      body: bingoState.boards.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.grid_off_rounded, size: 80, color: Colors.grey[300]),
                  const SizedBox(height: 16),
                  const Text('No tienes cartones activos', style: TextStyle(color: Colors.grey)),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => Navigator.pushNamed(context, '/setup'),
                    child: const Text('CREAR PRIMER BINGO'),
                  ),
                ],
              ),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: bingoState.boards.length,
              itemBuilder: (context, index) {
                final board = bingoState.boards[index];
                final theme = getThemeData(board.style.themeType);
                final isActive = board.id == bingoState.activeBoardId;
                final completedCount = board.cells.where((c) => c.isCompleted).length;

                return GestureDetector(
                  onTap: () {
                    notifier.switchBoard(board.id);
                    Navigator.pushReplacementNamed(context, '/bingo');
                  },
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isActive ? theme.primaryColor : Colors.grey[200]!,
                        width: isActive ? 3 : 1,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: theme.primaryColor.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        )
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(17),
                      child: Column(
                        children: [
                          Container(
                            height: 60,
                            width: double.infinity,
                            color: theme.primaryColor,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Row(
                              children: [
                                Icon(theme.icon, color: Colors.white, size: 24),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    board.title.toUpperCase(),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 18,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                if (isActive)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Text(
                                      'ACTIVO',
                                      style: TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Tamaño: ${board.dimension}x${board.dimension}',
                                      style: const TextStyle(color: Colors.grey, fontSize: 12),
                                    ),
                                    Text(
                                      'Objetivos: $completedCount / ${board.cells.length}',
                                      style: const TextStyle(fontWeight: FontWeight.bold),
                                    ),
                                  ],
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                                  onPressed: () => _confirmDelete(context, notifier, board.id),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/setup'),
        label: const Text('NUEVO CARTÓN'),
        icon: const Icon(Icons.add),
        backgroundColor: Theme.of(context).colorScheme.primary,
      ),
    );
  }

  void _confirmDelete(BuildContext context, BingoNotifier notifier, String id) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Eliminar cartón?'),
        content: const Text('Esta acción borrará el cartón seleccionado permanentemente.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('CANCELAR')),
          TextButton(
            onPressed: () {
              notifier.deleteBoard(id);
              Navigator.pop(context);
            },
            child: const Text('ELIMINAR', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
