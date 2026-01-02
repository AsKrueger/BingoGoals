import 'package:flutter/material.dart';
import '../domain/bingo_models.dart';

class EditCellDialog extends StatefulWidget {
  final BingoCell cell;

  const EditCellDialog({super.key, required this.cell});

  @override
  State<EditCellDialog> createState() => _EditCellDialogState();
}

class _EditCellDialogState extends State<EditCellDialog> {
  late TextEditingController _textController;
  late int _selectedColor;
  int? _selectedIconCode;

  final List<int> _colors = [
    0xFFF44336, // Red
    0xFFE91E63, // Pink
    0xFF9C27B0, // Purple
    0xFF673AB7, // Deep Purple
    0xFF3F51B5, // Indigo
    0xFF2196F3, // Blue
    0xFF00BCD4, // Cyan
    0xFF009688, // Teal
    0xFF4CAF50, // Green
    0xFF8BC34A, // Light Green
    0xFFFFC107, // Amber
    0xFFFF9800, // Orange
  ];

  final List<IconData> _availableIcons = [
    Icons.star,
    Icons.favorite,
    Icons.fitness_center,
    Icons.book,
    Icons.code,
    Icons.language,
    Icons.brush,
    Icons.music_note,
    Icons.camera_alt,
    Icons.pets,
    Icons.shopping_cart,
    Icons.home,
    Icons.work,
    Icons.flight,
    Icons.restaurant,
    Icons.directions_run,
  ];

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.cell.text);
    _selectedColor = widget.cell.colorValue ?? 0xFFE0E0E0;
    _selectedIconCode = widget.cell.iconCode;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.cell.isCentralStar ? 'Personalizar Estrella' : 'Editar Objetivo'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _textController,
              decoration: const InputDecoration(
                labelText: 'Texto del objetivo',
                border: OutlineInputBorder(),
              ),
              maxLength: 50,
            ),
            const SizedBox(height: 20),
            const Text('Icono:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            SizedBox(
              width: double.maxFinite,
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _availableIcons.map((icon) {
                  final isSelected = _selectedIconCode == icon.codePoint;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedIconCode = icon.codePoint),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: isSelected ? Theme.of(context).colorScheme.primary.withOpacity(0.2) : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected ? Theme.of(context).colorScheme.primary : Colors.grey[300]!,
                        ),
                      ),
                      child: Icon(icon, size: 24, color: isSelected ? Theme.of(context).colorScheme.primary : Colors.grey[600]),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Color de fondo:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            SizedBox(
              width: double.maxFinite,
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _colors.map((color) {
                  return GestureDetector(
                    onTap: () => setState(() => _selectedColor = color),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Color(color),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _selectedColor == color ? Colors.black : Colors.transparent,
                          width: 2,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('CANCELAR'),
        ),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context, {
              'text': _textController.text,
              'color': _selectedColor,
              'iconCode': _selectedIconCode,
            });
          },
          child: const Text('GUARDAR'),
        ),
      ],
    );
  }
}
