import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../domain/bingo_models.dart';
import '../../history/presentation/history_provider.dart';

enum WinType { none, line, fullBingo }

class WinState {
  final WinType type;
  final Set<int> completedLines; // Índices de líneas ya premiadas para no repetir aviso

  WinState({this.type = WinType.none, this.completedLines = const {}});
}

final bingoProvider = StateNotifierProvider<BingoNotifier, BingoBoard?>((ref) {
  return BingoNotifier(ref);
});

class BingoNotifier extends StateNotifier<BingoBoard?> {
  final Ref _ref;
  Set<String> _notifiedLines = {}; // IDs de líneas (ej: "row_0") ya notificadas en esta sesión

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
    _notifiedLines.clear();
    _saveToStorage();
  }

  void toggleCell(int index) {
    if (state == null) return;

    final newCells = List<BingoCell>.from(state!.cells);
    newCells[index] = newCells[index].copyWith(
      isCompleted: !newCells[index].isCompleted,
    );

    state = state!.copyWith(cells: newCells);
    _saveToStorage();
  }

  void updateCell(int index, String text, int color, int? iconCode, String? imagePath) {
    if (state == null) return;

    final newCells = List<BingoCell>.from(state!.cells);
    newCells[index] = newCells[index].copyWith(
      text: text,
      colorValue: color,
      iconCode: iconCode,
      imagePath: imagePath,
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
  }

  void deleteBoard() {
    state = null;
    _box.delete('current_board');
  }

  WinType checkWinStatus() {
    if (state == null) return WinType.none;
    int n = state!.dimension;
    List<BingoCell> cells = state!.cells;
    bool newWinFound = false;

    // 1. Check Full Bingo
    bool fullBingo = cells.every((c) => c.isCompleted);
    if (fullBingo) {
      String winId = "full_bingo_${state!.id}";
      if (!_notifiedLines.contains(winId)) {
        _notifiedLines.add(winId);
        return WinType.fullBingo;
      }
      return WinType.none;
    }

    // 2. Check Rows
    for (int i = 0; i < n; i++) {
      bool rowComplete = true;
      for (int j = 0; j < n; j++) {
        if (!cells[i * n + j].isCompleted) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) {
        String lineId = "row_$i";
        if (!_notifiedLines.contains(lineId)) {
          _notifiedLines.add(lineId);
          newWinFound = true;
        }
      }
    }

    // 3. Check Columns
    for (int i = 0; i < n; i++) {
      bool colComplete = true;
      for (int j = 0; j < n; j++) {
        if (!cells[i + j * n].isCompleted) {
          colComplete = false;
          break;
        }
      }
      if (colComplete) {
        String lineId = "col_$i";
        if (!_notifiedLines.contains(lineId)) {
          _notifiedLines.add(lineId);
          newWinFound = true;
        }
      }
    }

    // 4. Check Diagonals
    bool diag1Complete = true;
    for (int i = 0; i < n; i++) {
      if (!cells[i * (n + 1)].isCompleted) {
        diag1Complete = false;
        break;
      }
    }
    if (diag1Complete) {
      String lineId = "diag_1";
      if (!_notifiedLines.contains(lineId)) {
        _notifiedLines.add(lineId);
        newWinFound = true;
      }
    }

    bool diag2Complete = true;
    for (int i = 0; i < n; i++) {
      if (!cells[(i + 1) * (n - 1)].isCompleted) {
        diag2Complete = false;
        break;
      }
    }
    if (diag2Complete) {
      String lineId = "diag_2";
      if (!_notifiedLines.contains(lineId)) {
        _notifiedLines.add(lineId);
        newWinFound = true;
      }
    }

    return newWinFound ? WinType.line : WinType.none;
  }
  
  int get completedCount => state?.cells.where((c) => c.isCompleted).length ?? 0;
  double get progress => state == null || state!.cells.isEmpty ? 0 : completedCount / state!.cells.length;
}
