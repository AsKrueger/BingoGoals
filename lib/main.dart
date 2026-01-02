import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Inicialización de Hive para persistencia local
  await Hive.initFlutter();
  
  // Abrimos las cajas (boxes) necesarias
  await Hive.openBox('bingo_box');
  await Hive.openBox('bingo_history');
  
  runApp(
    const ProviderScope(
      child: BingoGoalsApp(),
    ),
  );
}
