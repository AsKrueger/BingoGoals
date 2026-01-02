import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../bingo/presentation/bingo_provider.dart';
import '../../bingo/domain/bingo_models.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  final List<String> _fonts = const [
    'Poppins',
    'Roboto',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Indie Flower',
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(bingoProvider);
    final notifier = ref.read(bingoProvider.notifier);

    if (board == null) return const Scaffold(body: Center(child: Text('No hay datos')));

    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes Visuales')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Tipografía',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey[300]!),
              borderRadius: BorderRadius.circular(12),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _fonts.contains(board.style.fontFamily) ? board.style.fontFamily : 'Poppins',
                isExpanded: true,
                items: _fonts.map((font) {
                  return DropdownMenuItem(
                    value: font,
                    child: Text(
                      font,
                      style: GoogleFonts.getFont(font),
                    ),
                  );
                }).toList(),
                onChanged: (newFont) {
                  if (newFont != null) {
                    final newStyle = board.style.copyWith(
                      fontFamily: newFont,
                    );
                    notifier.updateStyle(newStyle);
                  }
                },
              ),
            ),
          ),
          const SizedBox(height: 32),
          const Divider(),
          const SizedBox(height: 16),
          ListTile(
            leading: const Icon(Icons.archive, color: Colors.blue),
            title: const Text('Archivar Bingo', style: TextStyle(color: Colors.blue)),
            subtitle: const Text('Guarda el bingo actual en el historial y crea uno nuevo'),
            onTap: () => notifier.archiveCurrentBoard(),
          ),
          ListTile(
            leading: const Icon(Icons.delete_forever, color: Colors.red),
            title: const Text('Reiniciar Bingo', style: TextStyle(color: Colors.red)),
            subtitle: const Text('Elimina el tablero actual permanentemente'),
            onTap: () => _showDeleteConfirmation(context, notifier),
          ),
        ],
      ),
    );
  }

  void _showDeleteConfirmation(BuildContext context, BingoNotifier notifier) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Estás seguro?'),
        content: const Text('Esta acción borrará todo tu progreso actual de forma permanente.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('CANCELAR'),
          ),
          TextButton(
            onPressed: () {
              notifier.deleteBoard();
              Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
            },
            child: const Text('BORRAR TODO', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
