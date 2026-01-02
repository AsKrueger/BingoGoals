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
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('NUEVO RETO', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 2)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF6200EE),
              const Color(0xFF9C27B0),
              const Color(0xFF03DAC6).withOpacity(0.5),
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 20),
                _buildGlassCard(
                  child: Column(
                    children: [
                      const Text(
                        '¿CUÁL ES TU MISIÓN?',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _controller,
                        style: const TextStyle(color: Colors.white, fontSize: 18),
                        textAlign: TextAlign.center,
                        decoration: InputDecoration(
                          hintText: 'Nombre de tu Bingo...',
                          hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
                          filled: true,
                          fillColor: Colors.white.withOpacity(0.1),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(20),
                            borderSide: BorderSide.none,
                          ),
                          prefixIcon: const Icon(Icons.rocket_launch, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                const Text(
                  'ELIGE TU CAMPO DE BATALLA',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _sizeOption(BingoSize.threeByThree, '3 x 3', 'Modo Rápido', Icons.flash_on),
                    const SizedBox(width: 20),
                    _sizeOption(BingoSize.fiveByFive, '5 x 5', 'Modo Épico', Icons.workspace_premium),
                  ],
                ),
                const Spacer(),
                _buildActionButton(),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGlassCard({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.white.withOpacity(0.2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
          )
        ],
      ),
      child: child,
    );
  }

  Widget _sizeOption(BingoSize size, String title, String subtitle, IconData icon) {
    bool isSelected = _selectedSize == size;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedSize = size),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.white.withOpacity(0.1),
            borderRadius: BorderRadius.circular(25),
            border: Border.all(
              color: isSelected ? Colors.white : Colors.white.withOpacity(0.3),
              width: 3,
            ),
            boxShadow: isSelected ? [
              BoxShadow(color: Colors.white.withOpacity(0.3), blurRadius: 15)
            ] : null,
          ),
          child: Column(
            children: [
              Icon(icon, size: 40, color: isSelected ? const Color(0xFF6200EE) : Colors.white),
              const SizedBox(height: 12),
              Text(title, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: isSelected ? const Color(0xFF6200EE) : Colors.white)),
              Text(subtitle, style: TextStyle(fontSize: 12, color: isSelected ? const Color(0xFF6200EE).withOpacity(0.7) : Colors.white70)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton() {
    return InkWell(
      onTap: () {
        if (_controller.text.isNotEmpty) {
          ref.read(bingoProvider.notifier).createBoard(_controller.text, _selectedSize);
          Navigator.pushReplacementNamed(context, '/bingo');
        }
      },
      child: Container(
        height: 70,
        decoration: BoxDecoration(
          color: const Color(0xFF03DAC6),
          borderRadius: BorderRadius.circular(25),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF03DAC6).withOpacity(0.5),
              blurRadius: 15,
              offset: const Offset(0, 8),
            )
          ],
        ),
        child: const Center(
          child: Text(
            '¡QUE EMPIECE EL JUEGO!',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF003934), letterSpacing: 1),
          ),
        ),
      ),
    );
  }
}
