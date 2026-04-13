import 'package:flutter/material.dart';
import 'dart:async';
import '../api/api_service.dart';

class DeliveryDetailScreen extends StatefulWidget {
  final String qrData;
  const DeliveryDetailScreen({super.key, required this.qrData});

  @override
  State<DeliveryDetailScreen> createState() => _DeliveryDetailScreenState();
}

class _DeliveryDetailScreenState extends State<DeliveryDetailScreen> {
  final TextEditingController _otpController = TextEditingController();
  Timer? _timer;
  int _remainingSeconds = 300;
  int _resendCountdown = 30; 
  bool _timerExpired = false;

  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _hasArrived = false;
  bool _isArriving = false;
  bool _isAlreadyDelivered = false;

  Map<String, dynamic>? _orderData;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _startDelivery();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _otpController.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    _remainingSeconds = 300;
    _resendCountdown = 30; // 30 seconds wait before resend
    _timerExpired = false;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds > 0) {
        setState(() {
          _remainingSeconds--;
          if (_resendCountdown > 0) _resendCountdown--;
        });
      } else {
        setState(() {
          _timerExpired = true;
          _timer?.cancel();
        });
      }
    });
  }

  String _formatTime(int seconds) {
    int minutes = seconds ~/ 60;
    int remainingSecs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainingSecs.toString().padLeft(2, '0')}';
  }

  Future<void> _regenerateOTP() async {
    setState(() { _isSubmitting = true; });
    try {
      final result = await ApiService.startDelivery(widget.qrData, forceRegenerate: true);
      if (result['success'] == true) {
        setState(() {
          _otpController.clear();
          _startTimer();
          _isSubmitting = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('New OTP Generated'), backgroundColor: Colors.blue),
        );
      } else {
        setState(() { _isSubmitting = false; });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['message'] ?? 'Failed to regenerate OTP')),
        );
      }
    } catch (e) {
      setState(() { _isSubmitting = false; });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error regenerating OTP')),
      );
    }
  }

  Future<void> _startDelivery() async {
    try {
      final result = await ApiService.startDelivery(widget.qrData);
      if (mounted) {
        setState(() {
          _isLoading = false;
          if (result['success'] == true) {
            if (result['data'] != null) {
              _orderData = {...?_orderData, ...result['data']};
              if (result['alreadyDelivered'] == true || _orderData?['deliveryStatus'] == 'Delivered') {
                _isAlreadyDelivered = true;
              }
            }
            debugPrint('Order Data received: $_orderData');
            debugPrint('isWhitelisted: ${_orderData?['isWhitelisted']}');
          } else {
            _errorMessage = result['message'];
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Network error: $e';
        });
      }
    }
  }

  Future<void> _recordArrival() async {
    setState(() => _isArriving = true);
    try {
      final String orderId = _orderData?['orderId'] ?? widget.qrData;
      final result = await ApiService.recordArrival(orderId);
      if (mounted) {
        if (result['success'] == true) {
          setState(() {
            _hasArrived = true;
            _isArriving = false;
            // Merge new data with existing order data to prevent N/A
            if (result['data'] != null) {
              _orderData = {...?_orderData, ...result['data']};
            }
            _startTimer();
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Arrival Recorded')),
          );
        } else {
          setState(() => _isArriving = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result['message'] ?? 'Failed to record arrival')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isArriving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Network error: $e')),
        );
      }
    }
  }

  Future<void> _completeDelivery() async {
    // Explicitly check for true. If null or false, default to OTP required.
    final bool isWhitelisted = _orderData?['isWhitelisted'] == true;
    final String otp = _otpController.text.trim();

    if (!isWhitelisted && otp.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter OTP')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final String orderId = _orderData?['orderId'] ?? widget.qrData;
      final result = await ApiService.completeDelivery(orderId, otp);
      if (mounted) {
        setState(() => _isSubmitting = false);
        if (result['success'] == true) {
          _timer?.cancel();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Delivery Completed Successfully!', style: TextStyle(color: Colors.white)), backgroundColor: Colors.green),
          );
          Navigator.pop(context); // Go back to Home
        } else {
          if (result['isExpired'] == true) {
             setState(() { _timerExpired = true; _timer?.cancel(); });
          }
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result['message'] ?? 'Failed to complete')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Network error: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    if (_isLoading) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: theme.colorScheme.primary),
              const SizedBox(height: 24),
              Text('Fetching order details...', style: theme.textTheme.bodyMedium?.copyWith(color: const Color(0xFF64748B))),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Track Order', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: const Color(0xFF1E293B),
        centerTitle: true,
      ),
      body: _errorMessage != null
          ? _buildErrorPlaceholder(theme)
          : Column(
              children: [
                _buildModernStepper(theme),
                Expanded(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_isAlreadyDelivered) _buildWarningBanner(theme),
                        
                        _buildOrderHeader(theme),
                        const SizedBox(height: 16),
                        _buildMetadataSection(theme),
                        const SizedBox(height: 32),
                        
                        if (!_hasArrived && !_isAlreadyDeliveredCheck()) 
                          _buildArrivalSection(theme)
                        else if (!_isAlreadyDelivered) 
                          _buildOTPSection(theme),
                        
                        const SizedBox(height: 48),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildErrorPlaceholder(ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: Colors.red[50], shape: BoxShape.circle),
              child: Icon(Icons.error_outline_rounded, size: 64, color: Colors.red[300]),
            ),
            const SizedBox(height: 24),
            Text(
              'Oops! Something went wrong',
              style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, color: const Color(0xFF1E293B)),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.colorScheme.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text('Back to Dashboard', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _isAlreadyDeliveredCheck() {
     return _isAlreadyDelivered || _orderData?['deliveryStatus'] == 'Delivered';
  }

  Widget _buildModernStepper(ThemeData theme) {
    final int currentStep = _isAlreadyDeliveredCheck() ? 3 : (_hasArrived ? 2 : 1);
    
    return Container(
      padding: const EdgeInsets.fromLTRB(32, 8, 32, 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildStepNode(1, 'Ready', currentStep >= 1, theme),
          _buildStepConnector(currentStep > 1, theme),
          _buildStepNode(2, 'Arrival', currentStep >= 2, theme),
          _buildStepConnector(currentStep > 2, theme),
          _buildStepNode(3, 'Done', currentStep >= 3, theme),
        ],
      ),
    );
  }

  Widget _buildStepNode(int step, String label, bool isActive, ThemeData theme) {
    bool isDoneStep = step == 3 && isActive;
    Color activeColor = isDoneStep ? Colors.green : theme.colorScheme.primary;

    return Column(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: isActive ? activeColor : Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: isActive ? activeColor : const Color(0xFFE2E8F0), width: 2),
            boxShadow: isActive ? [BoxShadow(color: activeColor.withValues(alpha: 0.3), blurRadius: 10, offset: const Offset(0, 4))] : null,
          ),
          child: Center(
            child: isActive 
              ? const Icon(Icons.check, size: 18, color: Colors.white)
              : Text('$step', style: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.bold)),
          ),
        ),
        const SizedBox(height: 10),
        Text(label, style: TextStyle(
          fontSize: 12, 
          fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
          color: isActive ? activeColor : const Color(0xFF94A3B8),
          letterSpacing: 0.5,
        )),
      ],
    );
  }

  Widget _buildStepConnector(bool isActive, ThemeData theme) {
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.only(bottom: 24, left: 8, right: 8),
        decoration: BoxDecoration(
          color: isActive ? theme.colorScheme.primary : const Color(0xFFE2E8F0),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }

  Widget _buildWarningBanner(ThemeData theme) {
    final String completionTime = _orderData?['deliveryCompletionTime'] ?? _orderData?['deliveredTime'] ?? '';
    final String formattedTime = completionTime.isNotEmpty 
        ? 'Completed at ${DateTime.parse(completionTime).toLocal().toString().split('.')[0]}' 
        : 'Successfully completed';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4), // Success Green 50
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFBBF7D0)),
        boxShadow: [
          BoxShadow(
            color: Colors.green.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: const BoxDecoration(color: Color(0xFF22C55E), shape: BoxShape.circle),
            child: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Delivery Completed',
                  style: TextStyle(color: Color(0xFF166534), fontWeight: FontWeight.w900, fontSize: 18),
                ),
                const SizedBox(height: 4),
                Text(
                  formattedTime,
                  style: const TextStyle(color: Color(0xFF15803D), fontSize: 13, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderHeader(ThemeData theme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('SHIPMENT INFO', style: TextStyle(letterSpacing: 1.5, fontSize: 11, fontWeight: FontWeight.w800, color: theme.colorScheme.primary.withValues(alpha: 0.5))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  (_orderData?['deliveryStatus'] ?? 'PENDING').toUpperCase(),
                  style: TextStyle(color: theme.colorScheme.primary, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            _orderData?['billData']?['billNo'] ?? 'Bill # Not Available',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF1E293B), letterSpacing: -0.5),
          ),
          const SizedBox(height: 8),
          Text(
            _orderData?['partyData']?['partyAccount'] ?? 'Unnamed Party',
            style: const TextStyle(fontSize: 16, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildMetadataSection(ThemeData theme) {
    if (_orderData?['customer'] == null) return const SizedBox.shrink();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 12),
          child: Text('RECIPIENT DETAILS', style: TextStyle(letterSpacing: 1.5, fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8))),
        ),
        _buildDetailCard(Icons.person_rounded, 'Full Name', _orderData!['customer']['name'] ?? 'N/A', theme),
        const SizedBox(height: 12),
        _buildDetailCard(Icons.phone_rounded, 'Contact No', _orderData!['customer']['phone'] ?? 'N/A', theme),
        const SizedBox(height: 12),
        _buildDetailCard(Icons.map_rounded, 'Drop Address', _orderData!['customer']['address'] ?? 'N/A', theme),
      ],
    );
  }

  Widget _buildDetailCard(IconData icon, String label, String value, ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 20, color: const Color(0xFF64748B)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8))),
                Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildArrivalSection(ThemeData theme) {
    return Column(
      children: [
        Container(
          width: double.infinity,
          height: 72,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: ElevatedButton(
            onPressed: _isArriving ? null : _recordArrival,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF59E0B),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              elevation: 4,
              shadowColor: Colors.amber.withValues(alpha: 0.4),
            ),
            child: _isArriving 
              ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 3)
              : const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.location_on_rounded, size: 24),
                    SizedBox(width: 12),
                    Text('Confirm Arrival', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                  ],
                ),
          ),
        ),
        const SizedBox(height: 16),
        Text('Unlock OTP verification by confirming your location', style: TextStyle(color: const Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _buildOTPSection(ThemeData theme) {
    final bool isWhitelisted = _orderData?['isWhitelisted'] == true;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!isWhitelisted) ...[
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('VERIFICATION OTP', style: TextStyle(letterSpacing: 1.5, fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8))),
                if (!_timerExpired)
                  Text(
                    'Time remaining: ${_formatTime(_remainingSeconds)}',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _remainingSeconds < 60 ? Colors.red : const Color(0xFF94A3B8)),
                  )
                else
                  const Text(
                    'OTP Expired',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.red),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Stack(
            alignment: Alignment.center,
            children: [
              // Hidden TextField to capture input
              Opacity(
                opacity: 0,
                child: SizedBox(
                   height: 60,
                   child: TextField(
                    controller: _otpController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    autofocus: false,
                    onChanged: (value) => setState(() {}),
                  ),
                ),
              ),
              // Visual representation: 6 boxes
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(6, (index) => _buildOTPBox(index, theme)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: (_isSubmitting || _resendCountdown > 0) ? null : () => _regenerateOTP(),
              child: Text(
                _resendCountdown > 0 
                  ? 'Resend OTP in ${_resendCountdown}s' 
                  : 'Resend OTP',
                style: TextStyle(
                  color: _resendCountdown > 0 ? Colors.grey : theme.colorScheme.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),
          ),
        ] else ...[
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [Colors.green[50]!, Colors.green[100]!], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: Colors.green.shade100),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                  child: const Icon(Icons.verified_rounded, color: Colors.white, size: 24),
                ),
                const SizedBox(width: 20),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Whitelisted Customer', style: TextStyle(color: Color(0xFF065F46), fontWeight: FontWeight.w900, fontSize: 16)),
                      Text('OTP check bypassed automatically.', style: TextStyle(color: Color(0xFF047857), fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
        if (_timerExpired) ...[
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 60,
            child: OutlinedButton(
              onPressed: _isSubmitting ? null : () => _regenerateOTP(),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.blue, width: 2),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                   Icon(Icons.refresh_rounded, color: Colors.blue),
                   SizedBox(width: 8),
                   Text('Regenerate OTP', style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 32),
        SizedBox(
          width: double.infinity,
          height: 72,
          child: ElevatedButton(
            onPressed: (_isSubmitting || _timerExpired || (!isWhitelisted && _otpController.text.length < 6)) 
              ? null 
              : () => _completeDelivery(),
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              elevation: 8,
              shadowColor: theme.colorScheme.primary.withValues(alpha: 0.4),
            ),
            child: _isSubmitting 
              ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 3)
              : const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.task_alt_rounded, size: 24),
                    SizedBox(width: 12),
                    Text('Finalize Delivery', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                  ],
                ),
          ),
        ),
      ],
    );
  }

  Widget _buildOTPBox(int index, ThemeData theme) {
    String text = "";
    if (_otpController.text.length > index) {
      text = _otpController.text[index];
    }
    
    bool isActive = _otpController.text.length == index;
    bool isFilled = _otpController.text.length > index;

    return Container(
      width: 48,
      height: 60,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isActive ? theme.colorScheme.primary : const Color(0xFFE2E8F0),
          width: isActive ? 2 : 1,
        ),
        boxShadow: isActive ? [BoxShadow(color: theme.colorScheme.primary.withOpacity(0.1), blurRadius: 8, spreadRadius: 2)] : null,
      ),
      child: Center(
        child: Text(
          text,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: isFilled ? const Color(0xFF1E293B) : const Color(0xFF94A3B8),
          ),
        ),
      ),
    );
  }
}

