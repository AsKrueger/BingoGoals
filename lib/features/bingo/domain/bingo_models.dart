import 'package:flutter/material.dart';

enum BingoSize { threeByThree, fiveByFive }
enum CheckFrequency { weekly, monthly, free }

class BingoCell {
  final String id;
  String text;
  bool isCompleted;
  int? iconCode;
  int? colorValue;
  final bool isCentralStar;

  BingoCell({
    required this.id,
    this.text = '',
    this.isCompleted = false,
    this.iconCode,
    this.colorValue,
    this.isCentralStar = false,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'text': text,
    'isCompleted': isCompleted,
    'iconCode': iconCode,
    'colorValue': colorValue,
    'isCentralStar': isCentralStar,
  };

  factory BingoCell.fromJson(Map<dynamic, dynamic> json) => BingoCell(
    id: json['id'],
    text: json['text'],
    isCompleted: json['isCompleted'],
    iconCode: json['iconCode'],
    colorValue: json['colorValue'],
    isCentralStar: json['isCentralStar'],
  );

  BingoCell copyWith({
    String? text,
    bool? isCompleted,
    int? iconCode,
    int? colorValue,
  }) {
    return BingoCell(
      id: id,
      text: text ?? this.text,
      isCompleted: isCompleted ?? this.isCompleted,
      iconCode: iconCode ?? this.iconCode,
      colorValue: colorValue ?? this.colorValue,
      isCentralStar: isCentralStar,
    );
  }
}

class BingoStyle {
  final int primaryColor;
  final int accentColor;
  final String fontFamily;
  final bool showGridLines;

  BingoStyle({
    this.primaryColor = 0xFF6200EE,
    this.accentColor = 0xFF03DAC6,
    this.fontFamily = 'Roboto',
    this.showGridLines = true,
  });

  Map<String, dynamic> toJson() => {
    'primaryColor': primaryColor,
    'accentColor': accentColor,
    'fontFamily': fontFamily,
    'showGridLines': showGridLines,
  };

  factory BingoStyle.fromJson(Map<dynamic, dynamic> json) => BingoStyle(
    primaryColor: json['primaryColor'],
    accentColor: json['accentColor'],
    fontFamily: json['fontFamily'],
    showGridLines: json['showGridLines'],
  );
}

class BingoBoard {
  final String id;
  final String title;
  final BingoSize size;
  final List<BingoCell> cells;
  final BingoStyle style;
  final CheckFrequency frequency;
  final bool fastCheck;
  final DateTime createdAt;

  BingoBoard({
    required this.id,
    required this.title,
    required this.size,
    required this.cells,
    required this.style,
    this.frequency = CheckFrequency.free,
    this.fastCheck = true,
    required this.createdAt,
  });

  int get dimension => size == BingoSize.threeByThree ? 3 : 5;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'size': size.index,
    'cells': cells.map((e) => e.toJson()).toList(),
    'style': style.toJson(),
    'frequency': frequency.index,
    'fastCheck': fastCheck,
    'createdAt': createdAt.toIso8601String(),
  };

  factory BingoBoard.fromJson(Map<dynamic, dynamic> json) => BingoBoard(
    id: json['id'],
    title: json['title'],
    size: BingoSize.values[json['size']],
    cells: (json['cells'] as List).map((e) => BingoCell.fromJson(e)).toList(),
    style: BingoStyle.fromJson(json['style']),
    frequency: CheckFrequency.values[json['frequency']],
    fastCheck: json['fastCheck'],
    createdAt: DateTime.parse(json['createdAt']),
  );

  BingoBoard copyWith({
    String? title,
    List<BingoCell>? cells,
    BingoStyle? style,
  }) {
    return BingoBoard(
      id: id,
      title: title ?? this.title,
      size: size,
      cells: cells ?? this.cells,
      style: style ?? this.style,
      frequency: frequency,
      fastCheck: fastCheck,
      createdAt: createdAt,
    );
  }
}
