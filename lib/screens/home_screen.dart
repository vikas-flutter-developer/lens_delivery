import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
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

  @override
  void initState() {
    super.initState();
    _loadData();
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
    final qrData = await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ScannerScreen()),
    );
    
    if (qrData != null && qrData is String && qrData.isNotEmpty) {
      _navigateToDeliveryDetail(qrData);
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // Slate 50 background
      body: RefreshIndicator(
        onRefresh: _handleRefresh,
        edgeOffset: 100,
        color: theme.colorScheme.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // HERO SECTION
            SliverToBoxAdapter(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  _buildHeroHeader(theme),
                  Positioned(
                    bottom: -50,
                    left: 24,
                    right: 24,
                    child: _buildGlassStats(theme),
                  ),
                ],
              ),
            ),
            
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
            
            // MAIN ACTIONS
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Workflow',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF1E293B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildMainActionCard(theme),
                  ],
                ),
              ),
            ),
            
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
            
            // ACTIVE SHIPMENTS LIST
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              sliver: SliverToBoxAdapter(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'My Active Tasks',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFF1E293B),
                        letterSpacing: 0.5,
                      ),
                    ),
                    Text(
                      '${_assignedOrders.length} Left',
                      style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.primary, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
            ),
            
            if (_assignedOrders.isEmpty)
              SliverPadding(
                padding: const EdgeInsets.all(24),
                sliver: SliverToBoxAdapter(
                  child: Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0xFFF1F5F9)),
                    ),
                    child: Column(
                      children: [
                        Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey[300]),
                        const SizedBox(height: 16),
                        Text(
                          'No orders on hand',
                          style: TextStyle(color: Colors.grey[400], fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildOrderListItem(_assignedOrders[index], theme),
                    childCount: _assignedOrders.length,
                  ),
                ),
              ),
              
            const SliverToBoxAdapter(child: SizedBox(height: 40)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroHeader(ThemeData theme) {
    return Container(
      width: double.infinity,
      height: 280,
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 40),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [theme.colorScheme.primary, const Color(0xFF1E1B4B)], // Deep Indigo transition
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(40),
          bottomRight: Radius.circular(40),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Active Shift',
                    style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white60, fontWeight: FontWeight.w500),
                  ),
                  Text(
                    _userName,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              Container(
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: IconButton(
                  icon: const Icon(Icons.logout_rounded, color: Colors.white),
                  onPressed: _logout,
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            'Keep it moving!',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: Colors.white.withOpacity(0.8),
              fontStyle: FontStyle.italic,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGlassStats(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white, // In production we'd use BackdropFilter for true glass
          borderRadius: BorderRadius.circular(26),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.08),
              blurRadius: 30,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildSmallStat('Assigned', _stats['todayOrders'].toString(), theme),
            _buildStatDivider(),
            _buildSmallStat('Finished', _stats['completed'].toString(), theme),
            _buildStatDivider(),
            _buildSmallStat('Pending', _stats['onHand'].toString(), theme),
          ],
        ),
      ),
    );
  }

  Widget _buildSmallStat(String label, String value, ThemeData theme) {
    return Column(
      children: [
        Text(
          value,
          style: theme.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
            color: const Color(0xFF1E293B),
            fontSize: 22,
          ),
        ),
        Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(
            color: const Color(0xFF64748B),
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
          ),
        ),
      ],
    );
  }

  Widget _buildStatDivider() {
    return Container(height: 24, width: 1, color: const Color(0xFFF1F5F9));
  }

  Widget _buildMainActionCard(ThemeData theme) {
    return InkWell(
      onTap: _onScanQR,
      borderRadius: BorderRadius.circular(32),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: theme.colorScheme.primary.withOpacity(0.05),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.qr_code_scanner_rounded, size: 32, color: theme.colorScheme.primary),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Begin Delivery Track',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                  ),
                  Text(
                    'Scan or select shipment',
                    style: TextStyle(color: Colors.grey[500], fontSize: 13),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Color(0xFFCBD5E1)),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderListItem(dynamic order, ThemeData theme) {
    final String billNo = order['billData']?['billNo'] ?? 'No Bill #';
    final String party = order['partyData']?['partyAccount'] ?? 'Unnamed Party';
    
    // Dynamic Status Badge
    String deliveryStatus = (order['deliveryStatus'] ?? 'Pending').toUpperCase();
    Color badgeColor;
    Color textColor;
    String label;

    switch (deliveryStatus) {
      case 'DELIVERED':
        badgeColor = const Color(0xFFDCFCE7); // Light Green
        textColor = const Color(0xFF166534); // Deep Green
        label = 'DELIVERED';
        break;
      case 'OUT FOR DELIVERY':
        badgeColor = const Color(0xFFFEF3C7); // Light Amber
        textColor = const Color(0xFFD97706); // Deep Amber
        label = 'ON HAND';
        break;
      default:
        badgeColor = const Color(0xFFE0F2FE); // Light Sky
        textColor = const Color(0xFF075985); // Deep Sky
        label = 'READY';
    }

    bool isDelivered = deliveryStatus == 'DELIVERED';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: isDelivered ? null : () => _navigateToDeliveryDetail(order['_id']),
        splashColor: isDelivered ? Colors.transparent : null,
        highlightColor: isDelivered ? Colors.transparent : null,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFF1F5F9)),
          ),
          child: Row(
            children: [
              Container(
                height: 48,
                width: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  deliveryStatus == 'DELIVERED' ? Icons.check_circle_outline_rounded : Icons.local_shipping_outlined, 
                  color: deliveryStatus == 'DELIVERED' ? const Color(0xFF10B981) : const Color(0xFF64748B)
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      billNo,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
                    ),
                    Text(
                      party,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.grey[500], fontSize: 14),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: badgeColor,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(label, style: TextStyle(color: textColor, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
