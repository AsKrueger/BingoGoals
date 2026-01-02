import 'dart:math';
import 'package:flutter/material.dart';

class CelebrationOverlay extends StatefulWidget {
  const CelebrationOverlay({super.key});

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
      duration: const Duration(seconds: 3),
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
    for (int i = 0; i < 100; i++) {
      _pieces.add(ConfettiPiece(
        x: _random.nextDouble() * 400,
        y: -_random.nextDouble() * 800,
        color: Colors.primaries[_random.nextInt(Colors.primaries.length)],
        size: _random.nextDouble() * 10 + 5,
        velocity: _random.nextDouble() * 5 + 2,
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
    return Material(
      color: Colors.transparent,
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
                const Text(
                  '¡BINGO!',
                  style: TextStyle(
                    fontSize: 64,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    shadows: [Shadow(color: Colors.black54, blurRadius: 10, offset: Offset(0, 4))],
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: const Text(
                    '¡Objetivo Logrado!',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.orange),
                  ),
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
