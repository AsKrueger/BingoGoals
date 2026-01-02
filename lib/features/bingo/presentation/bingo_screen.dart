import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'bingo_provider.dart';
import '../domain/bingo_models.dart';
import 'edit_cell_dialog.dart';
import 'celebration_overlay.dart';

class BingoScreen extends ConsumerWidget {
  const BingoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bingoState = ref.watch(bingoProvider);
    final board = bingoState.activeBoard;
    final notifier = ref.read(bingoProvider.notifier);

    if (board == null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('No tienes ningún cartón activo'),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => Navigator.pushNamed(context, '/setup'),
                child: const Text('CREAR BINGO'),
              ),
            ],
          ),
        ),
      );
    }

    final themeData = getThemeData(board.style.themeType);

    return Scaffold(
      backgroundColor: themeData.backgroundColor,
      body: Column(
        children: [
          buildBingoHeader(context, board, themeData),
          buildProgressIndicator(context, board, notifier, themeData),
          Expanded(
            child: buildBingoCardGrid(context, board, notifier, themeData),
          ),
          buildBingoFooter(context),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showThemeSelector(context, notifier, board),
        backgroundColor: themeData.primaryColor,
        child: const Icon(Icons.palette, color: Colors.white),
      ),
    );
  }

  void _showThemeSelector(BuildContext context, BingoNotifier notifier, BingoBoard board) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(25))),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('ELIGE TU ESTILO', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            SizedBox(
              height: 100,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: BingoThemeType.values.map((type) {
                  final theme = getThemeData(type);
                  return GestureDetector(
                    onTap: () {
                      notifier.updateStyle(board.style.copyWith(themeType: type, primaryColor: theme.primaryColor.value));
                      Navigator.pop(context);
                    },
                    child: Container(
                      width: 80,
                      margin: const EdgeInsets.only(right: 12),
                      decoration: BoxDecoration(
                        color: theme.primaryColor,
                        borderRadius: BorderRadius.circular(15),
                        border: board.style.themeType == type ? Border.all(color: Colors.black, width: 3) : null,
                      ),
                      child: Icon(theme.icon, color: Colors.white),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Helpers globales para usar en el historial también
BingoThemeData getThemeData(BingoThemeType themeType) {
  const String path = 'lib/features/assets/images/patterns';
  switch (themeType) {
    case BingoThemeType.christmas:
      return BingoThemeData(
        primaryColor: const Color(0xFFC62828),
        backgroundColor: const Color(0xFFFFEBEE),
        icon: Icons.ac_unit,
        headerPattern: '$path/dots_pattern.png',
      );
    case BingoThemeType.sakura:
      return BingoThemeData(
        primaryColor: const Color(0xFFF06292),
        backgroundColor: const Color(0xFFFCE4EC),
        icon: Icons.filter_vintage,
        headerPattern: '$path/sakura_pattern.png',
      );
    case BingoThemeType.spring:
      return BingoThemeData(
        primaryColor: const Color(0xFF4CAF50),
        backgroundColor: const Color(0xFFE8F5E9),
        icon: Icons.eco,
        headerPattern: '$path/spring_pattern.png',
      );
    case BingoThemeType.birthday:
      return BingoThemeData(
        primaryColor: const Color(0xFFFF9800),
        backgroundColor: const Color(0xFFFFF3E0),
        icon: Icons.cake,
        headerPattern: '$path/confetti_pattern.png',
      );
    default:
      return BingoThemeData(
        primaryColor: const Color(0xFF6200EE),
        backgroundColor: const Color(0xFFF5F5F5),
        icon: Icons.stars,
      );
  }
}

Widget buildBingoHeader(BuildContext context, BingoBoard board, BingoThemeData theme) {
  return Container(
    width: double.infinity,
    height: 140,
    decoration: BoxDecoration(color: theme.primaryColor),
    child: Stack(
      children: [
        if (theme.headerPattern != null)
          Positioned.fill(
            child: Opacity(
              opacity: 0.2,
              child: Image.asset(
                theme.headerPattern!,
                repeat: ImageRepeat.repeat,
                errorBuilder: (context, error, stackTrace) => Container(),
              ),
            ),
          ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  board.title.toUpperCase(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                    fontFamily: 'Indie Flower',
                  ),
                ),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.collections_bookmark, color: Colors.white),
                      onPressed: () => Navigator.pushNamed(context, '/collection'),
                    ),
                    IconButton(
                      icon: const Icon(Icons.share, color: Colors.white),
                      onPressed: () {},
                    ),
                    IconButton(
                      icon: const Icon(Icons.settings, color: Colors.white),
                      onPressed: () => Navigator.pushNamed(context, '/settings'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

Widget buildProgressIndicator(BuildContext context, BingoBoard board, BingoNotifier notifier, BingoThemeData theme) {
  return Container(
    padding: const EdgeInsets.all(20),
    child: Column(
      children: [
        Row(
          children: [
            Icon(theme.icon, color: theme.primaryColor, size: 24),
            const SizedBox(width: 8),
            Text(
              'PROGRESO ${board.style.themeType.name.toUpperCase()}',
              style: TextStyle(fontWeight: FontWeight.bold, color: theme.primaryColor, letterSpacing: 1.2),
            ),
            const Spacer(),
            Text(
              '${(notifier.progress * 100).toStringAsFixed(0)}%',
              style: TextStyle(fontWeight: FontWeight.w900, color: theme.primaryColor, fontSize: 18),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: LinearProgressIndicator(
            value: notifier.progress,
            minHeight: 12,
            backgroundColor: Colors.grey[200],
            valueColor: AlwaysStoppedAnimation<Color>(theme.primaryColor),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '${notifier.completedCount} de ${board.cells.length} conseguidos',
          style: TextStyle(color: Colors.grey[600], fontSize: 13),
        ),
      ],
    ),
  );
}

Widget buildBingoCardGrid(BuildContext context, BingoBoard board, BingoNotifier? notifier, BingoThemeData theme) {
  return Container(
    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(25),
      border: Border.all(color: theme.primaryColor.withOpacity(0.3), width: 4),
      boxShadow: [
        BoxShadow(color: theme.primaryColor.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, 10))
      ],
    ),
    child: GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
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
          theme: theme,
          onTap: notifier == null ? () {} : () {
            notifier.toggleCell(index);
            final winType = notifier.checkWinStatus();
            if (winType != WinType.none) {
              showDialog(
                context: context, 
                barrierDismissible: false,
                builder: (context) => CelebrationOverlay(winType: winType)
              );
            }
          },
          onLongPress: notifier == null ? () {} : () async {
            final result = await showDialog<Map<String, dynamic>>(
              context: context,
              builder: (context) => EditCellDialog(cell: cell),
            );
            if (result != null) {
              notifier.updateCell(index, result['text'], result['color'], result['iconCode'], result['imagePath']);
            }
          },
        );
      },
    ),
  );
}

Widget buildBingoFooter(BuildContext context) {
  return Padding(
    padding: const EdgeInsets.symmetric(vertical: 20),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.info_outline, size: 16, color: Colors.grey),
        const SizedBox(width: 8),
        Text('Mantén pulsado para editar tus metas', style: TextStyle(color: Colors.grey[600], fontSize: 13)),
      ],
    ),
  );
}

class BingoCellWidget extends StatelessWidget {
  final BingoCell cell;
  final BingoThemeData theme;
  final VoidCallback onTap;
  final VoidCallback onLongPress;

  const BingoCellWidget({super.key, required this.cell, required this.theme, required this.onTap, required this.onLongPress});

  @override
  Widget build(BuildContext context) {
    final bool isCompleted = cell.isCompleted;
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: isCompleted ? theme.primaryColor.withOpacity(0.15) : Colors.white,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(
            color: isCompleted ? theme.primaryColor : Colors.grey[200]!,
            width: isCompleted ? 2.5 : 1.5,
          ),
          image: cell.imagePath != null
              ? DecorationImage(
                  image: FileImage(File(cell.imagePath!)),
                  fit: BoxFit.cover,
                  colorFilter: isCompleted ? null : const ColorFilter.mode(Colors.grey, BlendMode.saturation),
                )
              : null,
          boxShadow: isCompleted ? [] : [
            BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 5, offset: const Offset(0, 2))
          ],
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (cell.imagePath != null)
              Container(decoration: BoxDecoration(color: Colors.black.withOpacity(0.3), borderRadius: BorderRadius.circular(15))),
            if (cell.isCentralStar)
              Padding(
                padding: const EdgeInsets.all(4.0),
                child: Text(
                  cell.text.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: cell.imagePath != null ? Colors.white : theme.primaryColor,
                  ),
                ),
              )
            else
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (cell.iconCode != null && cell.imagePath == null)
                    Icon(IconData(cell.iconCode!, fontFamily: 'MaterialIcons'), size: 22, color: theme.primaryColor.withOpacity(0.8)),
                  const SizedBox(height: 2),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4.0),
                    child: Text(
                      cell.text.isEmpty ? 'Objetivo' : cell.text,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 8,
                        color: cell.imagePath != null ? Colors.white : Colors.black87,
                        fontWeight: isCompleted || cell.imagePath != null ? FontWeight.bold : FontWeight.normal,
                        shadows: cell.imagePath != null ? [const Shadow(color: Colors.black, blurRadius: 2)] : null,
                      ),
                    ),
                  ),
                ],
              ),
            if (isCompleted)
              Positioned(
                top: 5,
                right: 5,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: theme.primaryColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class BingoThemeData {
  final Color primaryColor;
  final Color backgroundColor;
  final IconData icon;
  final String? headerPattern;

  BingoThemeData({required this.primaryColor, required this.backgroundColor, required this.icon, this.headerPattern});
}
