import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geolocator/geolocator.dart';
import '../api/api_service.dart';
import 'login_screen.dart';
import 'scanner_screen.dart';
import 'delivery_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _userName = '';
  bool _isLoading = true;
  List<dynamic> _assignedOrders = [];
  Map<String, dynamic> _stats = {
    'todayOrders': 0,
    'completed': 0,
    'onHand': 0,
  };

  // FIXED: Changed to static const so they are initialized at compile time.
  // This prevents the "Cannot read properties of undefined" error on Web/Hot Reload.
  static const Color _bgLight = Color(0xFFF4F7FA);
  static const Color _textMain = Color(0xFF0F172A);
  static const Color _textSub = Color(0xFF64748B);

  @override
  void initState() {
    super.initState();
    _loadData();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    await Future.wait([
      _loadUser(),
      _fetchStats(),
      _fetchAssignedOrders(),
    ]);
    setState(() => _isLoading = false);
  }

  Future<void> _loadUser() async {
    final prefs = await SharedPreferences.getInstance();
    _userName = prefs.getString('userName') ?? 'Delivery Partner';
  }

  Future<void> _fetchStats() async {
    try {
      final result = await ApiService.getDeliveryStats();
      if (result['success']) {
        _stats = result['data'];
      }
    } catch (e) {
      debugPrint('Error fetching stats: $e');
    }
  }

  Future<void> _fetchAssignedOrders() async {
    try {
      final result = await ApiService.getAssignedOrders();
      if (result['success']) {
        _assignedOrders = result['data'];
      }
    } catch (e) {
      debugPrint('Error fetching assigned orders: $e');
    }
  }

  Future<void> _handleRefresh() async {
    await Future.wait([
      _fetchStats(),
      _fetchAssignedOrders(),
    ]);
    if (mounted) setState(() {});
  }

  Future<void> _logout() async {
    await ApiService.logout();
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  void _onScanQR() async {
    final scannedList = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ScannerScreen()),
    );

    if (scannedList != null && scannedList is List<String> && scannedList.isNotEmpty) {
      setState(() => _isLoading = true);

      int successCount = 0;
      for (var code in scannedList) {
        try {
          final res = await ApiService.startDelivery(code);
          if (res['success'] == true) {
            successCount++;
          }
        } catch (e) {
          debugPrint('Error starting delivery for $code: $e');
        }
      }

      await _handleRefresh();

      if (mounted) {
        setState(() => _isLoading = false);
        _showCustomSnackBar('Successfully picked up $successCount out of ${scannedList.length} parcels!', const Color(0xFF00C853));
      }
    }
  }

  Future<void> _sortByProximity() async {
    setState(() => _isLoading = true);

    final location = await ApiService.getCurrentLocation();
    if (location == null) {
      setState(() => _isLoading = false);
      if (mounted) {
        _showCustomSnackBar('Could not access current location. Check GPS.', const Color(0xFFD50000));
      }
      return;
    }

    setState(() {
      _assignedOrders.sort((a, b) {
        final double aLat = a['latitude'] as double? ?? 0.0;
        final double aLng = a['longitude'] as double? ?? 0.0;
        final double bLat = b['latitude'] as double? ?? 0.0;
        final double bLng = b['longitude'] as double? ?? 0.0;

        if (aLat == 0.0 || aLng == 0.0) return 1;
        if (bLat == 0.0 || bLng == 0.0) return -1;

        final distA = Geolocator.distanceBetween(location.latitude, location.longitude, aLat, aLng);
        final distB = Geolocator.distanceBetween(location.latitude, location.longitude, bLat, bLng);

        return distA.compareTo(distB);
      });
      _isLoading = false;
    });

    if (mounted) {
      _showCustomSnackBar('Deliveries sorted by proximity!', const Color(0xFF00B0FF));
    }
  }

  void _navigateToDeliveryDetail(String qrData) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => DeliveryDetailScreen(qrData: qrData),
      ),
    ).then((_) => _handleRefresh());
  }

  void _showCustomSnackBar(String message, Color accentColor) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w700)),
        backgroundColor: Colors.white,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: accentColor.withOpacity(0.5), width: 1.5),
        ),
        elevation: 10,
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bgLight,
      body: Stack(
        children: [
          // Background ambient soft color blobs
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF2962FF).withOpacity(0.12),
              ),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 100, sigmaY: 100),
                child: const SizedBox(),
              ),
            ),
          ),
          Positioned(
            bottom: 100,
            right: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF00E676).withOpacity(0.12),
              ),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 80, sigmaY: 80),
                child: const SizedBox(),
              ),
            ),
          ),

          SafeArea(
            bottom: false,
            child: _isLoading
                ? const Center(
              child: CircularProgressIndicator(
                color: Color(0xFF2962FF),
                strokeWidth: 3,
              ),
            )
                : RefreshIndicator(
              onRefresh: _handleRefresh,
              color: const Color(0xFF2962FF),
              backgroundColor: Colors.white,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                slivers: [
                  SliverToBoxAdapter(child: _buildHeader()),
                  const SliverToBoxAdapter(child: SizedBox(height: 24)),
                  SliverToBoxAdapter(child: _buildGlassStatsRow()),
                  const SliverToBoxAdapter(child: SizedBox(height: 32)),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverToBoxAdapter(child: _buildGlowingScanCard()),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 40)),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverToBoxAdapter(child: _buildListHeader()),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 16)),
                  if (_assignedOrders.isEmpty)
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      sliver: SliverToBoxAdapter(child: _buildEmptyState()),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.only(left: 20, right: 20, bottom: 40),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                              (context, index) => _buildGlassTaskCard(_assignedOrders[index]),
                          childCount: _assignedOrders.length,
                        ),
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

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: const Color(0xFF00C853),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(color: const Color(0xFF00C853).withOpacity(0.4), blurRadius: 6),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'SYSTEM ONLINE',
                    style: TextStyle(
                      color: _textSub,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '$_userName.',
                style: TextStyle(
                  color: _textMain,
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -1,
                ),
              ),
            ],
          ),
          _buildGlassIconButton(Icons.power_settings_new_rounded, _logout),
        ],
      ),
    );
  }

  Widget _buildGlassStatsRow() {
    return SizedBox(
      height: 110,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        physics: const BouncingScrollPhysics(),
        children: [
          _buildGlassStatCard('Assigned', _stats['todayOrders'].toString(), const Color(0xFF2962FF)),
          const SizedBox(width: 16),
          _buildGlassStatCard('Finished', _stats['completed'].toString(), const Color(0xFF00C853)),
          const SizedBox(width: 16),
          _buildGlassStatCard('Pending', _stats['onHand'].toString(), const Color(0xFFFF9100)),
        ],
      ),
    );
  }

  Widget _buildGlassStatCard(String label, String value, Color accentColor) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          width: 140,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.6),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white, width: 1.5),
            boxShadow: [
              BoxShadow(
                color: _textMain.withOpacity(0.04),
                blurRadius: 15,
                offset: const Offset(0, 8),
              )
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w900,
                  color: _textMain,
                  height: 1,
                ),
              ),
              const Spacer(),
              Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: accentColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    label.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: _textSub,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGlowingScanCard() {
    return GestureDetector(
      onTap: _onScanQR,
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(32),
          gradient: const LinearGradient(
            colors: [
              Color(0xFF2962FF),
              Color(0xFF00B0FF),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF2962FF).withOpacity(0.3),
              blurRadius: 24,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Initialize Delivery',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Scan parcel QR to begin tracking',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.9),
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 16),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildListHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          'Active Shipments',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: _textMain,
            letterSpacing: -0.5,
          ),
        ),
        if (_assignedOrders.isNotEmpty)
          GestureDetector(
            onTap: _sortByProximity,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF2962FF).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: const [
                  Icon(Icons.gps_fixed_rounded, size: 14, color: Color(0xFF2962FF)),
                  SizedBox(width: 6),
                  Text(
                    'Nearest',
                    style: TextStyle(
                      color: Color(0xFF2962FF),
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 24),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.6),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white, width: 1.5),
            boxShadow: [
              BoxShadow(
                color: _textMain.withOpacity(0.02),
                blurRadius: 10,
                offset: const Offset(0, 5),
              )
            ],
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: _textMain.withOpacity(0.04),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.verified_user_rounded, size: 48, color: _textSub.withOpacity(0.4)),
              ),
              const SizedBox(height: 24),
              Text(
                'Queue Cleared',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _textMain),
              ),
              const SizedBox(height: 8),
              Text(
                'No pending deliveries remaining.',
                textAlign: TextAlign.center,
                style: TextStyle(color: _textSub, fontSize: 14),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGlassTaskCard(dynamic order) {
    final String billNo = order['billData']?['billNo'] ?? 'No Bill #';
    final String party = order['partyData']?['partyAccount'] ?? 'Unnamed Party';
    String deliveryStatus = (order['deliveryStatus'] ?? 'Pending').toUpperCase();

    Color statusColor;
    String label;
    IconData statusIcon;

    switch (deliveryStatus) {
      case 'DELIVERED':
        statusColor = const Color(0xFF00C853);
        label = 'DELIVERED';
        statusIcon = Icons.check_circle_rounded;
        break;
      case 'OUT FOR DELIVERY':
        statusColor = const Color(0xFFFF9100);
        label = 'ON HAND';
        statusIcon = Icons.local_shipping_rounded;
        break;
      default:
        statusColor = const Color(0xFF2962FF);
        label = 'READY';
        statusIcon = Icons.inventory_2_rounded;
    }

    bool isDelivered = deliveryStatus == 'DELIVERED';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: isDelivered ? null : () => _navigateToDeliveryDetail(order['_id']),
              borderRadius: BorderRadius.circular(24),
              highlightColor: statusColor.withOpacity(0.05),
              splashColor: statusColor.withOpacity(0.1),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.7),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white, width: 1.5),
                  boxShadow: [
                    BoxShadow(
                      color: _textMain.withOpacity(0.03),
                      blurRadius: 15,
                      offset: const Offset(0, 8),
                    )
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      height: 48,
                      width: 48,
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(statusIcon, color: statusColor, size: 22),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            billNo,
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                              color: _textMain,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            party,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: _textSub,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: statusColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          label,
                          style: TextStyle(
                            color: _textSub,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGlassIconButton(IconData icon, VoidCallback onTap) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.6),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: _textMain.withOpacity(0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: Icon(icon, color: _textMain, size: 20),
            ),
          ),
        ),
      ),
    );
  }
}