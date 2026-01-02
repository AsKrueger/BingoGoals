import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import '../domain/bingo_models.dart';
import '../../history/presentation/history_provider.dart';

enum WinType { none, line, fullBingo }

class BingoState {
  final List<BingoBoard> boards;
  final String? activeBoardId;

  BingoState({this.boards = const [], this.activeBoardId});

  BingoBoard? get activeBoard => 
    activeBoardId == null ? null : boards.firstWhere((b) => b.id == activeBoardId, orElse: () => boards.first);

  BingoState copyWith({List<BingoBoard>? boards, String? activeBoardId}) {
    return BingoState(
      boards: boards ?? this.boards,
      activeBoardId: activeBoardId ?? this.activeBoardId,
    );
  }
}

final bingoProvider = StateNotifierProvider<BingoNotifier, BingoState>((ref) {
  return BingoNotifier(ref);
});

class BingoNotifier extends StateNotifier<BingoState> {
  final Ref _ref;
  final Set<String> _notifiedLines = {}; // Memoria de líneas ya premiadas para evitar repeticiones

  BingoNotifier(this._ref) : super(BingoState()) {
    _loadFromStorage();
  }

  final _box = Hive.box('bingo_box');

  void _loadFromStorage() {
    final List<dynamic>? savedData = _box.get('all_boards');
    final String? activeId = _box.get('active_board_id');
    
    if (savedData != null) {
      final boards = savedData.map((e) => BingoBoard.fromJson(Map<String, dynamic>.from(e))).toList();
      state = state.copyWith(boards: boards, activeBoardId: activeId);
      
      // Re-inicializar las líneas notificadas basadas en el estado cargado
      _recalculateNotifiedLines();
    }
  }

  void _recalculateNotifiedLines() {
    _notifiedLines.clear();
    final active = state.activeBoard;
    if (active == null) return;

    int n = active.dimension;
    List<BingoCell> cells = active.cells;

    // Filas
    for (int i = 0; i < n; i++) {
      bool rowComplete = true;
      for (int j = 0; j < n; j++) {
        if (!cells[i * n + j].isCompleted) { rowComplete = false; break; }
      }
      if (rowComplete) _notifiedLines.add("row_${active.id}_$i");
    }

    // Columnas
    for (int i = 0; i < n; i++) {
      bool colComplete = true;
      for (int j = 0; j < n; j++) {
        if (!cells[i + j * n].isCompleted) { colComplete = false; break; }
      }
      if (colComplete) _notifiedLines.add("col_${active.id}_$i");
    }

    // Diagonales
    bool diag1 = true;
    for (int i = 0; i < n; i++) if (!cells[i * (n + 1)].isCompleted) { diag1 = false; break; }
    if (diag1) _notifiedLines.add("diag1_${active.id}");

    bool diag2 = true;
    for (int i = 0; i < n; i++) if (!cells[(i + 1) * (n - 1)].isCompleted) { diag2 = false; break; }
    if (diag2) _notifiedLines.add("diag2_${active.id}");
    
    if (cells.every((c) => c.isCompleted)) _notifiedLines.add("full_${active.id}");
  }

  void _saveToStorage() {
    _box.put('all_boards', state.boards.map((e) => e.toJson()).toList());
    _box.put('active_board_id', state.activeBoardId);
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

    final newBoard = BingoBoard(
      id: const Uuid().v4(),
      title: title,
      size: size,
      cells: cells,
      style: BingoStyle(),
      createdAt: DateTime.now(),
    );

    state = state.copyWith(
      boards: [...state.boards, newBoard],
      activeBoardId: newBoard.id,
    );
    _saveToStorage();
    _recalculateNotifiedLines();
  }

  void switchBoard(String id) {
    state = state.copyWith(activeBoardId: id);
    _saveToStorage();
    _recalculateNotifiedLines();
  }

  void toggleCell(int index) {
    final active = state.activeBoard;
    if (active == null) return;

    final newCells = List<BingoCell>.from(active.cells);
    newCells[index] = newCells[index].copyWith(isCompleted: !newCells[index].isCompleted);

    final updatedBoard = active.copyWith(cells: newCells);
    _updateBoardInList(updatedBoard);
  }

  void updateCell(int index, String text, int color, int? iconCode, String? imagePath) {
    final active = state.activeBoard;
    if (active == null) return;

    final newCells = List<BingoCell>.from(active.cells);
    newCells[index] = newCells[index].copyWith(
      text: text,
      colorValue: color,
      iconCode: iconCode,
      imagePath: imagePath,
    );

    _updateBoardInList(active.copyWith(cells: newCells));
  }

  void updateStyle(BingoStyle newStyle) {
    final active = state.activeBoard;
    if (active == null) return;
    _updateBoardInList(active.copyWith(style: newStyle));
  }

  void _updateBoardInList(BingoBoard updatedBoard) {
    state = state.copyWith(
      boards: state.boards.map((b) => b.id == updatedBoard.id ? updatedBoard : b).toList(),
    );
    _saveToStorage();
  }

  void archiveCurrentBoard() {
    final active = state.activeBoard;
    if (active == null) return;
    _ref.read(historyProvider.notifier).archiveBoard(active);
    deleteBoard(active.id);
  }

  void deleteBoard(String id) {
    final newBoards = state.boards.where((b) => b.id != id).toList();
    state = state.copyWith(
      boards: newBoards,
      activeBoardId: newBoards.isEmpty ? null : newBoards.first.id,
    );
    _saveToStorage();
    _recalculateNotifiedLines();
  }

  WinType checkWinStatus() {
    final active = state.activeBoard;
    if (active == null) return WinType.none;
    int n = active.dimension;
    List<BingoCell> cells = active.cells;
    bool newWinFound = false;

    // 1. Check Full Bingo
    if (cells.every((c) => c.isCompleted)) {
      String winId = "full_${active.id}";
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
        if (!cells[i * n + j].isCompleted) { rowComplete = false; break; }
      }
      if (rowComplete) {
        String lineId = "row_${active.id}_$i";
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
        if (!cells[i + j * n].isCompleted) { colComplete = false; break; }
      }
      if (colComplete) {
        String lineId = "col_${active.id}_$i";
        if (!_notifiedLines.contains(lineId)) {
          _notifiedLines.add(lineId);
          newWinFound = true;
        }
      }
    }

    // 4. Check Diagonals
    bool diag1 = true;
    for (int i = 0; i < n; i++) if (!cells[i * (n + 1)].isCompleted) { diag1 = false; break; }
    if (diag1) {
      String lineId = "diag1_${active.id}";
      if (!_notifiedLines.contains(lineId)) {
        _notifiedLines.add(lineId);
        newWinFound = true;
      }
    }

    bool diag2 = true;
    for (int i = 0; i < n; i++) if (!cells[(i + 1) * (n - 1)].isCompleted) { diag2 = false; break; }
    if (diag2) {
      String lineId = "diag2_${active.id}";
      if (!_notifiedLines.contains(lineId)) {
        _notifiedLines.add(lineId);
        newWinFound = true;
      }
    }

    return newWinFound ? WinType.line : WinType.none; 
  }

  int get completedCount => state.activeBoard?.cells.where((c) => c.isCompleted).length ?? 0;
  double get progress => state.activeBoard == null ? 0 : completedCount / state.activeBoard!.cells.length;
}
