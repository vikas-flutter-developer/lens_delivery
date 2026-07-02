import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:image_picker/image_picker.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController controller = MobileScannerController();
  final ImagePicker _picker = ImagePicker();
  bool _isDisposed = false;

  // Local queue of scanned parcels in this session
  final List<String> _scannedCodes = [];
  String? _lastScannedCode;
  DateTime? _lastScanTime;

  @override
  void dispose() {
    _isDisposed = true;
    controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isDisposed) return;
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isNotEmpty) {
      final String? code = barcodes.first.rawValue;
      if (code != null && code.isNotEmpty) {
        // Prevent duplicate scan spamming within a short 2-second window
        final now = DateTime.now();
        if (_lastScannedCode == code && 
            _lastScanTime != null && 
            now.difference(_lastScanTime!).inSeconds < 2) {
          return;
        }

        _lastScannedCode = code;
        _lastScanTime = now;

        _addCode(code);
      }
    }
  }

  void _addCode(String code) {
    if (_scannedCodes.contains(code)) {
      ScannedFeedback.show(context, 'Already scanned: $code', isError: true);
      return;
    }

    setState(() {
      _scannedCodes.add(code);
    });

    ScannedFeedback.show(context, 'Scanned: $code');
  }

  Future<void> _scanFromGallery() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
      if (image == null) return;

      final BarcodeCapture? capture = await controller.analyzeImage(image.path);
      
      if (capture != null && capture.barcodes.isNotEmpty) {
        final String? code = capture.barcodes.first.rawValue;
        if (code != null && code.isNotEmpty) {
          _addCode(code);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No QR code found in the selected image'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error scanning from gallery: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _showManualEntryDialog() {
    final TextEditingController manualController = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        title: const Text('Manual Entry', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Type the Order ID or Bill Number to add it to the pickup queue.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
            const SizedBox(height: 20),
            TextField(
              controller: manualController,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'e.g. LS-2026-001',
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () {
              final val = manualController.text.trim();
              Navigator.pop(context);
              if (val.isNotEmpty) {
                _addCode(val);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF312E81),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Add to List', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _finishPickup() {
    if (_scannedCodes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please scan at least one parcel before finishing.')),
      );
      return;
    }
    _isDisposed = true;
    controller.stop();
    Navigator.pop(context, _scannedCodes);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final double screenHeight = MediaQuery.of(context).size.height;
    
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Vision Scanner', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 1)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on_rounded),
            onPressed: () => controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Keep scanner area bounded above the bottom sheet
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            bottom: screenHeight * 0.35,
            child: MobileScanner(
              controller: controller,
              onDetect: _onDetect,
            ),
          ),
          
          // CUSTOM SCANNER OVERLAY
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            bottom: screenHeight * 0.35,
            child: const _ScannerOverlay(),
          ),

          // SCANNED TRAY & BUTTONS (BOTTOM 38% OF SCREEN)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: screenHeight * 0.38,
            child: Container(
              decoration: const BoxDecoration(
                color: Color(0xFF0F172A), // Slate 900 dark background
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(32),
                  topRight: Radius.circular(32),
                ),
                boxShadow: [
                  BoxShadow(color: Colors.black54, blurRadius: 20, spreadRadius: 5),
                ],
              ),
              child: Column(
                children: [
                  // Drag bar indicator
                  Container(
                    width: 48,
                    height: 5,
                    margin: const EdgeInsets.only(top: 12, bottom: 8),
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),

                  // Header info
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Scanned Queue',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: theme.colorScheme.secondary.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            '${_scannedCodes.length} items',
                            style: TextStyle(
                              color: theme.colorScheme.secondary,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Horizontal Scanned List Tray
                  Expanded(
                    child: _scannedCodes.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.qr_code_scanner_rounded, color: Colors.white24, size: 36),
                                const SizedBox(height: 8),
                                Text(
                                  'Ready to scan items...',
                                  style: TextStyle(color: Colors.grey[500], fontSize: 13),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                            itemCount: _scannedCodes.length,
                            scrollDirection: Axis.horizontal,
                            itemBuilder: (context, index) {
                              final code = _scannedCodes[index];
                              return Container(
                                margin: const EdgeInsets.only(right: 12),
                                width: 140,
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.05),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: Colors.white10),
                                ),
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Icon(Icons.inventory_2_outlined, color: theme.colorScheme.secondary, size: 20),
                                        GestureDetector(
                                          onTap: () {
                                            setState(() {
                                              _scannedCodes.removeAt(index);
                                            });
                                          },
                                          child: Icon(Icons.close_rounded, color: Colors.red[300], size: 18),
                                        ),
                                      ],
                                    ),
                                    const Spacer(),
                                    Text(
                                      code,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Pickup pending',
                                      style: TextStyle(
                                        color: Colors.grey[500],
                                        fontSize: 10,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),

                  // Bottom buttons
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                    child: Row(
                      children: [
                        // Quick Action Buttons
                        IconButton(
                          icon: const Icon(Icons.photo_library_rounded, color: Colors.white, size: 26),
                          onPressed: _scanFromGallery,
                        ),
                        IconButton(
                          icon: const Icon(Icons.edit_note_rounded, color: Colors.white, size: 28),
                          onPressed: _showManualEntryDialog,
                        ),
                        const SizedBox(width: 12),
                        
                        // Done pickup button
                        Expanded(
                          child: SizedBox(
                            height: 52,
                            child: ElevatedButton(
                              onPressed: _scannedCodes.isEmpty ? null : _finishPickup,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: theme.colorScheme.secondary,
                                foregroundColor: Colors.white,
                                disabledBackgroundColor: Colors.white12,
                                disabledForegroundColor: Colors.white30,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              child: Text(
                                _scannedCodes.isEmpty
                                    ? 'Scan Parcels'
                                    : 'Finish Pickup (${_scannedCodes.length})',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Visual Scanned overlay feedback utility
class ScannedFeedback {
  static void show(BuildContext context, String message, {bool isError = false}) {
    final overlay = Overlay.of(context);
    final entry = OverlayEntry(
      builder: (context) => Positioned(
        top: 100,
        left: 24,
        right: 24,
        child: Material(
          color: Colors.transparent,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: isError ? const Color(0xFFEF4444) : const Color(0xFF10B981),
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10, offset: Offset(0, 4))],
            ),
            child: Row(
              children: [
                Icon(
                  isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded,
                  color: Colors.white,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    message,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    overlay.insert(entry);
    Future.delayed(const Duration(seconds: 1), () => entry.remove());
  }
}

class _ScannerOverlay extends StatefulWidget {
  const _ScannerOverlay();

  @override
  State<_ScannerOverlay> createState() => _ScannerOverlayState();
}

class _ScannerOverlayState extends State<_ScannerOverlay> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        return CustomPaint(
          painter: _ScannerPainter(_animationController.value),
          child: Container(),
        );
      },
    );
  }
}

class _ScannerPainter extends CustomPainter {
  final double animationValue;
  _ScannerPainter(this.animationValue);

  @override
  void paint(Canvas canvas, Size size) {
    final double scanArea = size.width * 0.7;
    final double left = (size.width - scanArea) / 2;
    final double top = (size.height - scanArea) / 2 - 50;
    final Rect rect = Rect.fromLTWH(left, top, scanArea, scanArea);

    // MASK
    final Paint maskPaint = Paint()..color = Colors.black.withOpacity(0.6);
    final Path path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(rect, const Radius.circular(32)))
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(path, maskPaint);

    // BORDER BRACKETS
    final Paint borderPaint = Paint()
      ..color = const Color(0xFF312E81)
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const double cornerLength = 40;
    const double radius = 32;

    // TL
    canvas.drawArc(Rect.fromLTWH(left, top, radius * 2, radius * 2), 3.14, 1.57, false, borderPaint);
    canvas.drawLine(Offset(left + radius, top), Offset(left + radius + cornerLength, top), borderPaint);
    canvas.drawLine(Offset(left, top + radius), Offset(left, top + radius + cornerLength), borderPaint);

    // TR
    canvas.drawArc(Rect.fromLTWH(left + scanArea - radius * 2, top, radius * 2, radius * 2), -1.57, 1.57, false, borderPaint);
    canvas.drawLine(Offset(left + scanArea - radius, top), Offset(left + scanArea - radius - cornerLength, top), borderPaint);
    canvas.drawLine(Offset(left + scanArea, top + radius), Offset(left + scanArea, top + radius + cornerLength), borderPaint);

    // BL
    canvas.drawArc(Rect.fromLTWH(left, top + scanArea - radius * 2, radius * 2, radius * 2), 1.57, 1.57, false, borderPaint);
    canvas.drawLine(Offset(left + radius, top + scanArea), Offset(left + radius + cornerLength, top + scanArea), borderPaint);
    canvas.drawLine(Offset(left, top + scanArea - radius), Offset(left, top + scanArea - radius - cornerLength), borderPaint);

    // BR
    canvas.drawArc(Rect.fromLTWH(left + scanArea - radius * 2, top + scanArea - radius * 2, radius * 2, radius * 2), 0, 1.57, false, borderPaint);
    canvas.drawLine(Offset(left + scanArea - radius, top + scanArea), Offset(left + scanArea - radius - cornerLength, top + scanArea), borderPaint);
    canvas.drawLine(Offset(left + scanArea, top + scanArea - radius), Offset(left + scanArea, top + scanArea - radius - cornerLength), borderPaint);

    // PULSING SCAN LINE
    final Paint linePaint = Paint()
      ..shader = LinearGradient(
        colors: [Colors.white.withOpacity(0), Colors.white, Colors.white.withOpacity(0)],
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
      ).createShader(rect);

    final double lineY = top + (scanArea * animationValue);
    canvas.drawLine(Offset(left + 20, lineY), Offset(left + scanArea - 20, lineY), linePaint..strokeWidth = 2);
  }

  @override
  bool shouldRepaint(covariant _ScannerPainter oldDelegate) => true;
}
