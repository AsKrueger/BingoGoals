import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import 'package:audioplayers/audioplayers.dart';
import '../domain/bingo_models.dart';
import '../../history/presentation/history_provider.dart';

final bingoProvider = StateNotifierProvider<BingoNotifier, BingoBoard?>((ref) {
  return BingoNotifier(ref);
});

class BingoNotifier extends StateNotifier<BingoBoard?> {
  final Ref _ref;
  final AudioPlayer _audioPlayer = AudioPlayer();
  
  BingoNotifier(this._ref) : super(null) {
    _loadFromStorage();
  }

  final _box = Hive.box('bingo_box');

  void _loadFromStorage() {
    final savedData = _box.get('current_board');
    if (savedData != null) {
      state = BingoBoard.fromJson(Map<String, dynamic>.from(savedData));
    }
  }

  void _saveToStorage() {
    if (state != null) {
      _box.put('current_board', state!.toJson());
    }
  }

  Future<void> _playSound(String fileName) async {
    try {
      await _audioPlayer.play(AssetSource('sounds/$fileName'));
    } catch (e) {
      // Si el archivo no existe aún, fallará silenciosamente en el simulador
    }
  }

  void createBoard(String title, BingoSize size) {
    int dimension = size == BingoSize.threeByThree ? 3 : 5;
    int totalCells = dimension * dimension;
    int centerIndex = totalCells ~/ 2;

    List<BingoCell> cells = List.generate(totalCells, (index) {
      bool isCenter = size == BingoSize.fiveByFive && index == centerIndex;
      return BingoCell(
        id: const Uuid().v4(),
        text: isCenter ? 'ESTRELLA' : 'Objetivo ${index + 1}',
        isCentralStar: isCenter,
        isCompleted: isCenter, 
      );
    });

    state = BingoBoard(
      id: const Uuid().v4(),
      title: title,
      size: size,
      cells: cells,
      style: BingoStyle(),
      createdAt: DateTime.now(),
    );
    _saveToStorage();
    _playSound('start.mp3');
  }

  void toggleCell(int index) {
    if (state == null) return;

    final newCells = List<BingoCell>.from(state!.cells);
    final wasCompleted = newCells[index].isCompleted;
    
    newCells[index] = newCells[index].copyWith(
      isCompleted: !wasCompleted,
    );

    state = state!.copyWith(cells: newCells);
    _saveToStorage();
    
    if (!wasCompleted) {
      _playSound('check.mp3');
    }
  }

  void updateCell(int index, String text, int color, int? iconCode) {
    if (state == null) return;

    final newCells = List<BingoCell>.from(state!.cells);
    newCells[index] = newCells[index].copyWith(
      text: text,
      colorValue: color,
      iconCode: iconCode,
    );

    state = state!.copyWith(cells: newCells);
    _saveToStorage();
  }

  void updateStyle(BingoStyle newStyle) {
    if (state == null) return;
    state = state!.copyWith(style: newStyle);
    _saveToStorage();
  }

  void archiveCurrentBoard() {
    if (state == null) return;
    _ref.read(historyProvider.notifier).archiveBoard(state!);
    deleteBoard();
    _playSound('archive.mp3');
  }

  void deleteBoard() {
    state = null;
    _box.delete('current_board');
  }

  bool checkWin() {
    if (state == null) return false;
    int n = state!.dimension;
    List<BingoCell> cells = state!.cells;

    // Check rows
    for (int i = 0; i < n; i++) {
      bool rowComplete = true;
      for (int j = 0; j < n; j++) {
        if (!cells[i * n + j].isCompleted) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) {
        _playSound('bingo.mp3');
        return true;
      }
    }

    // Check columns
    for (int i = 0; i < n; i++) {
      bool colComplete = true;
      for (int j = 0; j < n; j++) {
        if (!cells[i + j * n].isCompleted) {
          colComplete = false;
          break;
        }
      }
      if (colComplete) {
        _playSound('bingo.mp3');
        return true;
      }
    }

    // Check diagonals
    bool diag1Complete = true;
    bool diag2Complete = true;
    for (int i = 0; i < n; i++) {
      if (!cells[i * (n + 1)].isCompleted) diag1Complete = false;
      if (!cells[(i + 1) * (n - 1)].isCompleted) diag2Complete = false;
    }

    if (diag1Complete || diag2Complete) {
      _playSound('bingo.mp3');
      return true;
    }

    return false;
  }
  
  int get completedCount => state?.cells.where((c) => c.isCompleted).length ?? 0;
  
  double get progress => state == null || state!.cells.isEmpty ? 0 : completedCount / state!.cells.length;
}
