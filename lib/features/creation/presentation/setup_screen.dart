import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../bingo/domain/bingo_models.dart';
import '../../bingo/presentation/bingo_provider.dart';

class SetupScreen extends ConsumerStatefulWidget {
  const SetupScreen({super.key});

  @override
  ConsumerState<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends ConsumerState<SetupScreen> {
  final _controller = TextEditingController();
  BingoSize _selectedSize = BingoSize.fiveByFive;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Configurar tu Bingo'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              '¿Cómo se llamará tu reto?',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _controller,
              decoration: InputDecoration(
                labelText: 'Nombre del Bingo',
                hintText: 'Ej: Mis Metas 2024',
                prefixIcon: const Icon(Icons.edit),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                filled: true,
                fillColor: Colors.grey[50],
              ),
            ),
            const SizedBox(height: 32),
            const Text(
              'Selecciona el tamaño del tablero',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _sizeOption(BingoSize.threeByThree, '3x3', '9 casillas - Rápido'),
                const SizedBox(width: 16),
                _sizeOption(BingoSize.fiveByFive, '5x5', '25 casillas - Épico'),
              ],
            ),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: () {
                if (_controller.text.isNotEmpty) {
                  ref.read(bingoProvider.notifier).createBoard(
                    _controller.text,
                    _selectedSize,
                  );
                  Navigator.pushReplacementNamed(context, '/bingo');
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Por favor, introduce un nombre para tu bingo')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                backgroundColor: Theme.of(context).colorScheme.primary,
                foregroundColor: Colors.white,
                elevation: 4,
              ),
              child: const Text('¡CREAR MI BINGO!', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sizeOption(BingoSize size, String title, String subtitle) {
    bool isSelected = _selectedSize == size;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedSize = size),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isSelected ? Theme.of(context).colorScheme.primary.withOpacity(0.1) : Colors.white,
            borderRadius: BorderRadius.circular(15),
            border: Border.all(
              color: isSelected ? Theme.of(context).colorScheme.primary : Colors.grey[300]!,
              width: 2,
            ),
          ),
          child: Column(
            children: [
              Text(title, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: isSelected ? Theme.of(context).colorScheme.primary : Colors.black87)),
              const SizedBox(height: 4),
              Text(subtitle, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
            ],
          ),
        ),
      ),
    );
  }
}
