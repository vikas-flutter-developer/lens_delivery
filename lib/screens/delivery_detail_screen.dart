import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:io';
import 'package:url_launcher/url_launcher.dart';
import 'package:image_picker/image_picker.dart';
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
  bool _isTransitioningStatus = false;

  // Handover Verification state
  bool _isOtpMethodSelected = true; // Toggle between OTP and Photo proof
  XFile? _proofPhoto;
  final ImagePicker _picker = ImagePicker();

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

  Future<void> _callCustomer() async {
    final String phone = _orderData?['customer']?['phone'] ?? '';
    if (phone.isNotEmpty && phone != 'N/A') {
      final uri = Uri.parse('tel:$phone');
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open phone dialer')),
        );
      }
    }
  }

  Future<void> _launchGoogleMaps() async {
    final double lat = _orderData?['latitude'] as double? ?? 0.0;
    final double lng = _orderData?['longitude'] as double? ?? 0.0;
    final String address = _orderData?['customer']?['address'] ?? '';

    if (lat != 0.0 && lng != 0.0) {
      final url = 'google.navigation:q=$lat,$lng';
      final fallbackUrl = 'https://www.google.com/maps/search/?api=1&query=$lat,$lng';
      try {
        if (await canLaunchUrl(Uri.parse(url))) {
          await launchUrl(Uri.parse(url));
        } else {
          await launchUrl(Uri.parse(fallbackUrl), mode: LaunchMode.externalApplication);
        }
      } catch (e) {
        await launchUrl(Uri.parse(fallbackUrl), mode: LaunchMode.externalApplication);
      }
    } else if (address.isNotEmpty && address != 'N/A') {
      final encodedAddress = Uri.encodeComponent(address);
      final url = 'https://www.google.com/maps/search/?api=1&query=$encodedAddress';
      if (await canLaunchUrl(Uri.parse(url))) {
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Drop address or coordinates not available')),
      );
    }
  }

  Future<void> _takeProofPhoto() async {
    try {
      final XFile? photo = await _picker.pickImage(source: ImageSource.camera, imageQuality: 70);
      if (photo != null) {
        setState(() {
          _proofPhoto = photo;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Proof photo captured successfully!'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      debugPrint('Error taking photo: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Camera error: $e')),
      );
    }
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
              if (_orderData?['arrivalTime'] != null) {
                _hasArrived = true;
              }
            }
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

  Future<void> _triggerOutForDelivery() async {
    setState(() => _isTransitioningStatus = true);
    try {
      final String orderId = _orderData?['orderId'] ?? widget.qrData;
      final result = await ApiService.setOutForDelivery(orderId);
      if (mounted) {
        setState(() => _isTransitioningStatus = false);
        if (result['success'] == true) {
          setState(() {
            if (result['data'] != null) {
              _orderData = {...?_orderData, ...result['data']};
            }
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Order status set to Out for Delivery!'), backgroundColor: Colors.green),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(result['message'] ?? 'Failed to change status')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isTransitioningStatus = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
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
    final bool isWhitelisted = _orderData?['isWhitelisted'] == true;
    final String otp = _otpController.text.trim();

    if (_isOtpMethodSelected && !isWhitelisted && otp.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter OTP')),
      );
      return;
    }

    if (!_isOtpMethodSelected && _proofPhoto == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please take a proof photo before finalization')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final String orderId = _orderData?['orderId'] ?? widget.qrData;
      final result = await ApiService.completeDelivery(
        orderId, 
        _isOtpMethodSelected ? otp : null,
        proofPhotoPath: _isOtpMethodSelected ? null : _proofPhoto?.path,
      );
      if (mounted) {
        setState(() => _isSubmitting = false);
        if (result['success'] == true) {
          _timer?.cancel();
          
          // Show coordinates verification dialog summary
          await showDialog(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
              title: const Row(
                children: [
                  Icon(Icons.verified_rounded, color: Colors.green, size: 28),
                  SizedBox(width: 8),
                  Text('Delivery Signed', style: TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('The parcel handover details were successfully auto-logged.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                  const SizedBox(height: 16),
                  _buildSummaryRow(Icons.timer_outlined, 'Timestamp', DateTime.now().toLocal().toString().split('.')[0]),
                  _buildSummaryRow(Icons.location_on_rounded, 'Handover GPS', 
                    'Lat: ${result['data']?['deliveredLatitude'] ?? _orderData?['deliveredLatitude'] ?? '19.0380'}\nLng: ${result['data']?['deliveredLongitude'] ?? _orderData?['deliveredLongitude'] ?? '72.8639'}'),
                  _buildSummaryRow(Icons.file_present_rounded, 'Verification', _isOtpMethodSelected ? 'OTP Code Validated' : 'Proof Photo Captured'),
                ],
              ),
              actions: [
                ElevatedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Okay', style: TextStyle(color: Colors.white)),
                ),
              ],
            ),
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

  Widget _buildSummaryRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: const Color(0xFF64748B)),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B)),
                children: [
                  TextSpan(text: '$label: ', style: const TextStyle(fontWeight: FontWeight.bold)),
                  TextSpan(text: value),
                ],
              ),
            ),
          ),
        ],
      ),
    );
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

    final String status = _orderData?['deliveryStatus'] ?? 'Pending';

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
                        if (_isAlreadyDeliveredCheck()) _buildWarningBanner(theme),
                        
                        _buildOrderHeader(theme),
                        const SizedBox(height: 16),
                        _buildMetadataSection(theme),
                        const SizedBox(height: 32),
                        
                        if (!_isAlreadyDeliveredCheck()) ...[
                          if (status == 'Ready')
                            _buildReadySection(theme)
                          else if (status == 'Out for Delivery' && !_hasArrived)
                            _buildArrivalSection(theme)
                          else if (status == 'Out for Delivery' && _hasArrived)
                            _buildVerificationSection(theme)
                        ],
                        
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
    // 4 Steps Stepper: 1-Ready, 2-Out for Delivery, 3-Arrival, 4-Done
    final String status = _orderData?['deliveryStatus'] ?? 'Pending';
    int currentStep = 1;

    if (_isAlreadyDeliveredCheck()) {
      currentStep = 4;
    } else if (status == 'Out for Delivery') {
      currentStep = _hasArrived ? 3 : 2;
    } else if (status == 'Ready') {
      currentStep = 1;
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildStepNode(1, 'Ready', currentStep >= 1, theme),
          _buildStepConnector(currentStep > 1, theme),
          _buildStepNode(2, 'Transit', currentStep >= 2, theme),
          _buildStepConnector(currentStep > 2, theme),
          _buildStepNode(3, 'Arrival', currentStep >= 3, theme),
          _buildStepConnector(currentStep > 3, theme),
          _buildStepNode(4, 'Done', currentStep >= 4, theme),
        ],
      ),
    );
  }

  Widget _buildStepNode(int step, String label, bool isActive, ThemeData theme) {
    bool isDoneStep = step == 4 && isActive;
    Color activeColor = isDoneStep ? Colors.green : theme.colorScheme.primary;

    return Column(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: isActive ? activeColor : Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: isActive ? activeColor : const Color(0xFFE2E8F0), width: 2),
            boxShadow: isActive ? [BoxShadow(color: activeColor.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 3))] : null,
          ),
          child: Center(
            child: isActive 
              ? const Icon(Icons.check, size: 16, color: Colors.white)
              : Text('$step', style: TextStyle(color: Colors.grey[400], fontSize: 12, fontWeight: FontWeight.bold)),
          ),
        ),
        const SizedBox(height: 8),
        Text(label, style: TextStyle(
          fontSize: 10, 
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
        margin: const EdgeInsets.only(bottom: 22, left: 6, right: 6),
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
      padding: const EdgeInsets.all(20),
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4), // Success Green 50
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: const BoxDecoration(color: Color(0xFF22C55E), shape: BoxShape.circle),
            child: const Icon(Icons.check_circle_rounded, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Delivery Completed',
                  style: TextStyle(color: Color(0xFF166534), fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 2),
                Text(
                  formattedTime,
                  style: const TextStyle(color: Color(0xFF15803D), fontSize: 12, fontWeight: FontWeight.w500),
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
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('SHIPMENT INFO', style: TextStyle(letterSpacing: 1.5, fontSize: 10, fontWeight: FontWeight.w800, color: theme.colorScheme.primary.withOpacity(0.5))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  (_orderData?['deliveryStatus'] ?? 'PENDING').toUpperCase(),
                  style: TextStyle(color: theme.colorScheme.primary, fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            _orderData?['billData']?['billNo'] ?? 'Bill # Not Available',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF1E293B), letterSpacing: -0.5),
          ),
          const SizedBox(height: 6),
          Text(
            _orderData?['partyData']?['partyAccount'] ?? 'Unnamed Party',
            style: const TextStyle(fontSize: 14, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
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
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 10),
          child: Text('RECIPIENT DETAILS', style: TextStyle(letterSpacing: 1.5, fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8))),
        ),
        _buildDetailCard(Icons.person_rounded, 'Full Name', _orderData!['customer']['name'] ?? 'N/A', theme),
        const SizedBox(height: 12),
        _buildDetailCard(
          Icons.phone_rounded, 
          'Contact No', 
          _orderData!['customer']['phone'] ?? 'N/A', 
          theme,
          actionIcon: Icons.phone_in_talk_rounded,
          onActionPressed: _callCustomer,
        ),
        const SizedBox(height: 12),
        _buildDetailCard(
          Icons.map_rounded, 
          'Drop Address', 
          _orderData!['customer']['address'] ?? 'N/A', 
          theme,
          actionIcon: Icons.directions_rounded,
          onActionPressed: _launchGoogleMaps,
        ),
      ],
    );
  }

  Widget _buildDetailCard(
    IconData icon, 
    String label, 
    String value, 
    ThemeData theme, {
    IconData? actionIcon,
    VoidCallback? onActionPressed,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 18, color: const Color(0xFF64748B)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8))),
                Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF334155))),
              ],
            ),
          ),
          if (actionIcon != null && onActionPressed != null && value != 'N/A')
            IconButton(
              icon: Icon(actionIcon, color: theme.colorScheme.primary),
              onPressed: onActionPressed,
              style: IconButton.styleFrom(
                backgroundColor: theme.colorScheme.primary.withOpacity(0.06),
                padding: const EdgeInsets.all(8),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildReadySection(ThemeData theme) {
    return Column(
      children: [
        Container(
          width: double.infinity,
          height: 64,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: ElevatedButton(
            onPressed: _isTransitioningStatus ? null : _triggerOutForDelivery,
            style: ElevatedButton.styleFrom(
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              elevation: 4,
            ),
            child: _isTransitioningStatus
              ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 3)
              : const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.directions_car_rounded, size: 22),
                    SizedBox(width: 10),
                    Text('Out for Delivery', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                  ],
                ),
          ),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            'Logs transit start coordinates and departure timestamp',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w500),
          ),
        ),
      ],
    );
  }

  Widget _buildArrivalSection(ThemeData theme) {
    return Column(
      children: [
        Container(
          width: double.infinity,
          height: 64,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: ElevatedButton(
            onPressed: _isArriving ? null : _recordArrival,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF59E0B),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              elevation: 4,
              shadowColor: Colors.amber.withOpacity(0.3),
            ),
            child: _isArriving 
              ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 3)
              : const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.location_on_rounded, size: 22),
                    SizedBox(width: 10),
                    Text('Confirm Arrival', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                  ],
                ),
          ),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            'Unlock handover options by recording arrival at destination',
            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w500),
          ),
        ),
      ],
    );
  }

  Widget _buildVerificationSection(ThemeData theme) {
    final bool isWhitelisted = _orderData?['isWhitelisted'] == true;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isWhitelisted)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFA7F3D0)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                  child: const Icon(Icons.verified_rounded, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Whitelisted Partner', style: TextStyle(color: Color(0xFF065F46), fontWeight: FontWeight.bold, fontSize: 15)),
                      Text('OTP verification automatically bypassed.', style: TextStyle(color: Color(0xFF047857), fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          )
        else ...[
          // METHOD TOGGLE TABS (OTP vs CAMERA PHOTO)
          Container(
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(14),
            ),
            padding: const EdgeInsets.all(4),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _isOtpMethodSelected = true),
                    child: Container(
                      decoration: BoxDecoration(
                        color: _isOtpMethodSelected ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: _isOtpMethodSelected
                            ? [const BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))]
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'OTP Code',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: _isOtpMethodSelected ? theme.colorScheme.primary : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _isOtpMethodSelected = false),
                    child: Container(
                      decoration: BoxDecoration(
                        color: !_isOtpMethodSelected ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                        boxShadow: !_isOtpMethodSelected
                            ? [const BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 2))]
                            : null,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Photo Upload',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          color: !_isOtpMethodSelected ? theme.colorScheme.primary : const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // TAB CONTENT
          if (_isOtpMethodSelected) ...[
            // OTP INPUT AREA
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Verify customer OTP',
                  style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF475569), fontSize: 13),
                ),
                if (!_timerExpired)
                  Text(
                    'Expires: ${_formatTime(_remainingSeconds)}',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _remainingSeconds < 60 ? Colors.red : const Color(0xFF94A3B8)),
                  )
                else
                  const Text('OTP Expired', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.red)),
              ],
            ),
            const SizedBox(height: 12),
            Stack(
              alignment: Alignment.center,
              children: [
                Opacity(
                  opacity: 0,
                  child: SizedBox(
                    height: 52,
                    child: TextField(
                      controller: _otpController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      onChanged: (value) => setState(() {}),
                    ),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: List.generate(6, (index) => _buildOTPBox(index, theme)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: (_isSubmitting || _resendCountdown > 0) ? null : () => _regenerateOTP(),
                child: Text(
                  _resendCountdown > 0 ? 'Resend in ${_resendCountdown}s' : 'Resend OTP',
                  style: TextStyle(color: _resendCountdown > 0 ? Colors.grey : theme.colorScheme.primary, fontWeight: FontWeight.bold, fontSize: 12),
                ),
              ),
            ),
          ] else ...[
            // PHOTO UPLOAD AREA
            const Text(
              'Proof of Delivery Photo',
              style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF475569), fontSize: 13),
            ),
            const SizedBox(height: 12),
            if (_proofPhoto == null)
              GestureDetector(
                onTap: _takeProofPhoto,
                child: Container(
                  height: 140,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0), style: BorderStyle.solid),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.camera_enhance_rounded, color: theme.colorScheme.primary, size: 36),
                      const SizedBox(height: 8),
                      const Text(
                        'Launch Camera to Take Photo',
                        style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Take a photo of the parcel package at delivery point',
                        style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                      ),
                    ],
                  ),
                ),
              )
            else
              Stack(
                children: [
                  Container(
                    height: 160,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      image: DecorationImage(
                        image: FileImage(File(_proofPhoto!.path)),
                        fit: BoxFit.cover,
                      ),
                      border: Border.all(color: const Color(0xFFCBD5E1)),
                    ),
                  ),
                  Positioned(
                    top: 10,
                    right: 10,
                    child: CircleAvatar(
                      backgroundColor: Colors.black54,
                      child: IconButton(
                        icon: const Icon(Icons.delete_forever_rounded, color: Colors.redAccent),
                        onPressed: () => setState(() => _proofPhoto = null),
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ],

        if (_timerExpired && _isOtpMethodSelected && !isWhitelisted) ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: OutlinedButton(
              onPressed: _isSubmitting ? null : () => _regenerateOTP(),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: theme.colorScheme.primary, width: 2),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.refresh_rounded, color: theme.colorScheme.primary),
                  const SizedBox(width: 8),
                  Text('Regenerate Expired OTP', style: TextStyle(color: theme.colorScheme.primary, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ),
        ],

        const SizedBox(height: 24),
        
        // FINALIZE HANDOVER BUTTON
        SizedBox(
          width: double.infinity,
          height: 64,
          child: ElevatedButton(
            onPressed: (_isSubmitting || 
                       (_isOtpMethodSelected && !isWhitelisted && _timerExpired) || 
                       (_isOtpMethodSelected && !isWhitelisted && _otpController.text.length < 6) ||
                       (!_isOtpMethodSelected && !isWhitelisted && _proofPhoto == null)) 
              ? null 
              : () => _completeDelivery(),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              elevation: 4,
              shadowColor: Colors.green.withOpacity(0.3),
            ),
            child: _isSubmitting 
              ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 3)
              : const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.verified_rounded, size: 22),
                    SizedBox(width: 10),
                    Text('Finalize Delivery', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
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
      width: 40,
      height: 52,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isActive ? theme.colorScheme.primary : const Color(0xFFE2E8F0),
          width: isActive ? 2 : 1,
        ),
        boxShadow: isActive ? [BoxShadow(color: theme.colorScheme.primary.withOpacity(0.1), blurRadius: 6)] : null,
      ),
      child: Center(
        child: Text(
          text,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: isFilled ? const Color(0xFF1E293B) : const Color(0xFF94A3B8),
          ),
        ),
      ),
    );
  }
}

