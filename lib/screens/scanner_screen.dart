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
      if (code != null) {
        _isDisposed = true;
        controller.stop();
        Navigator.pop(context, code);
      }
    }
  }

  Future<void> _scanFromGallery() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
      if (image == null) return;

      final BarcodeCapture? capture = await controller.analyzeImage(image.path);
      
      if (capture != null && capture.barcodes.isNotEmpty) {
        final String? code = capture.barcodes.first.rawValue;
        if (code != null && !_isDisposed) {
          _isDisposed = true;
          controller.stop();
          if (mounted) {
            Navigator.pop(context, code);
          }
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
        title: const Text('Manual Identification', style: TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Enter the Order ID or Bill Number manually if the QR code is damaged.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
            const SizedBox(height: 20),
            TextField(
              controller: manualController,
              autofocus: true,
              decoration: InputDecoration(
                hintText: 'e.g. LS-2024-001',
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
              Navigator.pop(context);
              Navigator.pop(context, manualController.text.trim());
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF312E81),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Confirm', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
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
          MobileScanner(
            controller: controller,
            onDetect: _onDetect,
          ),
          // CUSTOM SCANNER OVERLAY
          const _ScannerOverlay(),
          // BOTTOM CONTROLS
          Positioned(
            bottom: 60,
            left: 0,
            right: 0,
            child: Column(
              children: [
                const Text(
                  'Align QR code within the frame',
                  style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500, letterSpacing: 0.5),
                ),
                const SizedBox(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildActionButton(Icons.photo_library_rounded, 'Gallery', _scanFromGallery),
                    const SizedBox(width: 24),
                    _buildActionButton(Icons.edit_note_rounded, 'Manual', _showManualEntryDialog),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(IconData icon, String label, VoidCallback onTap) {
    return Column(
      children: [
        InkWell(
          onTap: onTap,
          child: Container(
            height: 64,
            width: 64,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white24),
            ),
            child: Icon(icon, color: Colors.white, size: 28),
          ),
        ),
        const SizedBox(height: 12),
        Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
      ],
    );
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
