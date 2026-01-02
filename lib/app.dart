import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'features/bingo/presentation/bingo_screen.dart';
import 'features/creation/presentation/setup_screen.dart';
import 'features/stats/presentation/stats_screen.dart';
import 'features/onboarding/presentation/welcome_screen.dart';
import 'features/settings/presentation/settings_screen.dart';
import 'features/history/presentation/history_screen.dart';
import 'features/bingo/presentation/bingo_provider.dart';

class BingoGoalsApp extends ConsumerWidget {
  const BingoGoalsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(bingoProvider);
    
    final primaryColor = board != null 
        ? Color(board.style.primaryColor) 
        : const Color(0xFF6200EE);
    
    final fontFamily = board?.style.fontFamily ?? 'Poppins';

    return MaterialApp(
      title: 'BingoGoals',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: primaryColor,
          primary: primaryColor,
          secondary: const Color(0xFF03DAC6),
          brightness: Brightness.light,
        ),
        textTheme: GoogleFonts.getTextTheme(fontFamily, Theme.of(context).textTheme),
        appBarTheme: AppBarTheme(
          backgroundColor: primaryColor,
          foregroundColor: Colors.white,
          elevation: 0,
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const WelcomeScreen(),
        '/setup': (context) => const SetupScreen(),
        '/bingo': (context) => const BingoScreen(),
        '/stats': (context) => const StatsScreen(),
        '/settings': (context) => const SettingsScreen(),
        '/history': (context) => const HistoryScreen(),
      },
    );
  }
}
