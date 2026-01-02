import 'dart:math';
import 'package:flutter/material.dart';
import 'bingo_provider.dart';

class CelebrationOverlay extends StatefulWidget {
  final WinType winType;

  const CelebrationOverlay({super.key, required this.winType});

  @override
  State<CelebrationOverlay> createState() => _CelebrationOverlayState();
}

class _CelebrationOverlayState extends State<CelebrationOverlay> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<ConfettiPiece> _pieces = [];
  final Random _random = Random();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..addListener(() {
        setState(() {
          for (var piece in _pieces) {
            piece.update();
          }
        });
      });

    _generatePieces();
    _controller.forward().then((_) => Navigator.pop(context));
  }

  void _generatePieces() {
    int count = widget.winType == WinType.fullBingo ? 200 : 80;
    for (int i = 0; i < count; i++) {
      _pieces.add(ConfettiPiece(
        x: _random.nextDouble() * 500,
        y: -_random.nextDouble() * 1000,
        color: Colors.primaries[_random.nextInt(Colors.primaries.length)],
        size: _random.nextDouble() * 10 + 5,
        velocity: _random.nextDouble() * 6 + 2,
      ));
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isFullBingo = widget.winType == WinType.fullBingo;

    return Material(
      color: Colors.black.withOpacity(0.6),
      child: Stack(
        children: [
          ..._pieces.map((piece) => Positioned(
                left: piece.x,
                top: piece.y,
                child: Container(
                  width: piece.size,
                  height: piece.size,
                  decoration: BoxDecoration(
                    color: piece.color,
                    shape: _random.nextBool() ? BoxShape.circle : BoxShape.rectangle,
                  ),
                ),
              )),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isFullBingo ? Icons.workspace_premium : Icons.stars,
                  size: 100,
                  color: Colors.amber,
                ),
                const SizedBox(height: 20),
                Text(
                  isFullBingo ? '¡SUPER BINGO!' : '¡LÍNEA!',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: isFullBingo ? 54 : 42,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 4,
                    shadows: const [Shadow(color: Colors.black54, blurRadius: 20, offset: Offset(0, 5))],
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  isFullBingo ? '¡HAS COMPLETADO TODO EL CARTÓN!' : '¡Sigue así, vas por buen camino!',
                  style: const TextStyle(fontSize: 18, color: Colors.white70, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ConfettiPiece {
  double x;
  double y;
  Color color;
  double size;
  double velocity;

  ConfettiPiece({required this.x, required this.y, required this.color, required this.size, required this.velocity});

  void update() {
    y += velocity;
    x += sin(y / 50) * 2;
  }
}
