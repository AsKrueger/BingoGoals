import 'package:flutter/material.dart';
import '../../bingo/domain/bingo_models.dart';
import '../../bingo/presentation/bingo_screen.dart';

class HistoryDetailScreen extends StatelessWidget {
  final BingoBoard board;

  const HistoryDetailScreen({super.key, required this.board});

  @override
  Widget build(BuildContext context) {
    final themeData = getThemeData(board.style.themeType);
    
    return Theme(
      data: Theme.of(context).copyWith(
        colorScheme: ColorScheme.fromSeed(seedColor: themeData.primaryColor),
      ),
      child: Scaffold(
        backgroundColor: themeData.backgroundColor,
        appBar: AppBar(
          title: Text(board.title),
          backgroundColor: themeData.primaryColor,
        ),
        body: Column(
          children: [
            buildBingoHeader(context, board, themeData),
            Expanded(
              child: buildBingoCardGrid(context, board, null, themeData),
            ),
          ],
        ),
      ),
    );
  }
}
