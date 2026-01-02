import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../bingo/domain/bingo_models.dart';

final historyProvider = StateNotifierProvider<HistoryNotifier, List<BingoBoard>>((ref) {
  return HistoryNotifier();
});

class HistoryNotifier extends StateNotifier<List<BingoBoard>> {
  HistoryNotifier() : super([]) {
    _loadHistory();
  }

  final _box = Hive.box('bingo_history');

  void _loadHistory() {
    final List<dynamic> savedData = _box.values.toList();
    state = savedData.map((e) => BingoBoard.fromJson(Map<String, dynamic>.from(e))).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  void archiveBoard(BingoBoard board) {
    _box.put(board.id, board.toJson());
    state = [board, ...state];
  }

  void deleteFromHistory(String id) {
    _box.delete(id);
    state = state.where((board) => board.id != id).toList();
  }
}
