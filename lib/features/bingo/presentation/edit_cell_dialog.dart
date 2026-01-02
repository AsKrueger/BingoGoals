import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
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
  String? _selectedImagePath;

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
    0xFFFFC107, // Amber
    0xFFFF9800, // Orange
  ];

  final List<IconData> _availableIcons = [
    Icons.star, Icons.favorite, Icons.fitness_center, Icons.book,
    Icons.code, Icons.brush, Icons.music_note, Icons.pets,
    Icons.shopping_cart, Icons.home, Icons.flight, Icons.restaurant,
  ];

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.cell.text);
    _selectedColor = widget.cell.colorValue ?? 0xFFE0E0E0;
    _selectedIconCode = widget.cell.iconCode;
    _selectedImagePath = widget.cell.imagePath;
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _selectedImagePath = image.path;
        _selectedIconCode = null; // Priorizamos imagen sobre icono
      });
    }
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
              decoration: const InputDecoration(labelText: 'Texto del objetivo', border: OutlineInputBorder()),
              maxLength: 30,
            ),
            const SizedBox(height: 20),
            const Text('Imagen o Icono:', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            Row(
              children: [
                ElevatedButton.icon(
                  onPressed: _pickImage,
                  icon: const Icon(Icons.image),
                  label: const Text('Galería'),
                ),
                if (_selectedImagePath != null)
                  const Padding(
                    padding: EdgeInsets.only(left: 8.0),
                    child: Icon(Icons.check_circle, color: Colors.green),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _availableIcons.map((icon) {
                final isSelected = _selectedIconCode == icon.codePoint && _selectedImagePath == null;
                return GestureDetector(
                  onTap: () => setState(() {
                    _selectedIconCode = icon.codePoint;
                    _selectedImagePath = null;
                  }),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: isSelected ? Colors.blue.withOpacity(0.1) : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: isSelected ? Colors.blue : Colors.grey[300]!),
                    ),
                    child: Icon(icon, size: 24, color: isSelected ? Colors.blue : Colors.grey[600]),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),
            const Text('Color de fondo (si no hay imagen):', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _colors.map((color) {
                return GestureDetector(
                  onTap: () => setState(() => _selectedColor = color),
                  child: Container(
                    width: 35,
                    height: 35,
                    decoration: BoxDecoration(
                      color: Color(color),
                      shape: BoxShape.circle,
                      border: Border.all(color: _selectedColor == color ? Colors.black : Colors.transparent, width: 2),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('CANCELAR')),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context, {
              'text': _textController.text,
              'color': _selectedColor,
              'iconCode': _selectedIconCode,
              'imagePath': _selectedImagePath,
            });
          },
          child: const Text('GUARDAR'),
        ),
      ],
    );
  }
}
