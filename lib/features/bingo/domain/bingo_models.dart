import 'package:flutter/material.dart';

enum BingoSize { threeByThree, fiveByFive }

enum BingoThemeType {
  classic,
  christmas,
  sakura,
  spring,
  newYear,
  birthday,
}

class BingoCell {
  final String id;
  String text;
  bool isCompleted;
  int? iconCode;
  String? imagePath;
  int? colorValue;
  final bool isCentralStar;

  BingoCell({
    required this.id,
    this.text = '',
    this.isCompleted = false,
    this.iconCode,
    this.imagePath,
    this.colorValue,
    this.isCentralStar = false,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'text': text,
    'isCompleted': isCompleted,
    'iconCode': iconCode,
    'imagePath': imagePath,
    'colorValue': colorValue,
    'isCentralStar': isCentralStar,
  };

  factory BingoCell.fromJson(Map<dynamic, dynamic> json) => BingoCell(
    id: json['id'],
    text: json['text'],
    isCompleted: json['isCompleted'],
    iconCode: json['iconCode'],
    imagePath: json['imagePath'],
    colorValue: json['colorValue'],
    isCentralStar: json['isCentralStar'],
  );

  BingoCell copyWith({
    String? text,
    bool? isCompleted,
    int? iconCode,
    String? imagePath,
    int? colorValue,
  }) {
    return BingoCell(
      id: id,
      text: text ?? this.text,
      isCompleted: isCompleted ?? this.isCompleted,
      iconCode: iconCode ?? this.iconCode,
      imagePath: imagePath ?? this.imagePath,
      colorValue: colorValue ?? this.colorValue,
      isCentralStar: isCentralStar,
    );
  }
}

class BingoStyle {
  final BingoThemeType themeType;
  final int primaryColor;
  final String fontFamily;

  BingoStyle({
    this.themeType = BingoThemeType.classic,
    this.primaryColor = 0xFF6200EE,
    this.fontFamily = 'Poppins',
  });

  BingoStyle copyWith({
    BingoThemeType? themeType,
    int? primaryColor,
    String? fontFamily,
  }) {
    return BingoStyle(
      themeType: themeType ?? this.themeType,
      primaryColor: primaryColor ?? this.primaryColor,
      fontFamily: fontFamily ?? this.fontFamily,
    );
  }

  Map<String, dynamic> toJson() => {
    'themeType': themeType.index,
    'primaryColor': primaryColor,
    'fontFamily': fontFamily,
  };

  factory BingoStyle.fromJson(Map<dynamic, dynamic> json) => BingoStyle(
    themeType: BingoThemeType.values[json['themeType'] ?? 0],
    primaryColor: json['primaryColor'] ?? 0xFF6200EE,
    fontFamily: json['fontFamily'] ?? 'Poppins',
  );
}

class BingoBoard {
  final String id;
  final String title;
  final BingoSize size;
  final List<BingoCell> cells;
  final BingoStyle style;
  final DateTime createdAt;

  BingoBoard({
    required this.id,
    required this.title,
    required this.size,
    required this.cells,
    required this.style,
    required this.createdAt,
  });

  int get dimension => size == BingoSize.threeByThree ? 3 : 5;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'size': size.index,
    'cells': cells.map((e) => e.toJson()).toList(),
    'style': style.toJson(),
    'createdAt': createdAt.toIso8601String(),
  };

  factory BingoBoard.fromJson(Map<dynamic, dynamic> json) => BingoBoard(
    id: json['id'],
    title: json['title'],
    size: BingoSize.values[json['size']],
    cells: (json['cells'] as List).map((e) => BingoCell.fromJson(e)).toList(),
    style: BingoStyle.fromJson(json['style']),
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
      createdAt: createdAt,
    );
  }
}
