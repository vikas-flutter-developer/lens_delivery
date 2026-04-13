import React, { useState, useEffect, useRef, useContext } from "react";
import { createPortal } from "react-dom";
import {
  Menu,
  Home,
  Building2,
  Settings,
  PlusCircle,
  Users,
  Package,
  FileText,
  CreditCard,
  Eye,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  BarChart3,
  FileBarChart,
  Printer,
  Mail,
  MessageSquare,
  Database,
  RefreshCw,
  Upload,
  Download,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Boxes,
  Receipt,
  Clock,
  PieChart,
  Calculator,
  Search,
  Wrench,
  Archive,
  LogOut,
  Zap,
  Activity,
  Keyboard,
  ShieldCheck,
  Target,
  Wallet,
  icons,
} from "lucide-react";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState("");
  const [openMenus, setOpenMenus] = useState({});
  const [activeParents, setActiveParents] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  // Create a ref to reference the sidebar DOM element
  const sidebarRef = useRef(null);
  const searchInputRef = useRef(null);

  const handleSearchIconClick = () => {
    setIsCollapsed(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // UX Improvement: Flyout related states and logic
  const [hoveredItem, setHoveredItem] = useState(null); // { key, rect, items }
  const [flyoutPosition, setFlyoutPosition] = useState({ top: 0, left: 0 });
  const flyoutTimeoutRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // Sample menu items structure - you can replace this with your actual menu structure
  // Main menu items definition
  const menuItems = React.useMemo(() => {
    const items = [
    // paste your entire menuItems array here (kept same as your large array)
    {
      key: "dashboard",
      label: "Dashboard",
      icon: Home,
      link: "/dashboard",
      onClick: () => handleItemClick("dashboard"),
    },
    {
      key: "company",
      label: "Company",
      icon: Building2,
      submenu: [
        {
          key: "modify-company",
          label: "Modify Company",
          icon: Settings,
          link: "/company/modifycompany",
        },
        {
          key: "close-company",
          label: "Close Company",
          icon: Archive,
          link: "/company/closecompany",
        },
      ],
    },
    {
      key: "Active",
      label: "Active",
      icon: TrendingUp,
      link: "/active"
    },
    {
      key: "masters",
      label: "Masters",
      icon: Settings,
      submenu: [
        {
          key: "account-master",
          label: "Account Master",
          icon: Users,
          submenu: [
            {
              key: "account-group-master",
              label: "Account Group Master",
              icon: Users,
              link: "/masters/accountmaster/accountgroupmaster",
            },
            {
              key: "account-master-sub",
              label: "Account Master",
              icon: UserCheck,
              link: "/masters/accountmaster/accountmaster",
            },
            {
              key: "transporter",
              label: "Transporter",
              icon: Users,
              link: "/masters/accountmaster/transporter",
            },
          ],
        },
        {
          key: "inventory-master",
          label: "Inventory Master",
          icon: Package,
          submenu: [
            {
              key: "inventory-creation",
              label: "Group, Item & Lens Creation",
              icon: PlusCircle,
              link: "/masters/inventorymaster/creation",
            },

            {
              key: "lens-price",
              label: "Lens Price",
              icon: DollarSign,
              link: "/masters/inventorymaster/lensprice",
            },
            {
              key: "product-price-account",
              label: "Product Price Account Category Wise",
              icon: DollarSign,
              link: "/masters/inventorymaster/productpriceaccountcategorywise",
            },

          ],
        },
        {
          key: "tax-category",
          label: "Tax Category",
          icon: Calculator,
          link: "/masters/billandothermaster/taxcategory",
        },

      ],
    },
    {
      key: "add-voucher",
      label: "Add Voucher",
      icon: FileText,
      link: "/transaction/payrecptumicntr/addvoucher",
    },

    {
      key: "lens-transaction",
      label: "Lens Transaction",
      icon: Eye,
      submenu: [
        {
          key: "sale",
          label: "Sale",
          icon: TrendingUp,
          submenu: [
            {
              key: "sale-invoice",
              label: "Sale Invoice",
              icon: Receipt,
              link: "/lenstransaction/sale/saleinvoice",
            },
            {
              key: "sale-order",
              label: "Sale Order",
              icon: ShoppingCart,
              link: "/lenstransaction/sale/saleorder",
            },
            {
              key: "sale-challan",
              label: "Sale Challan",
              icon: FileText,
              link: "/lenstransaction/sale/salechallan",
            },
          ],
        },
        {
          key: "sale-return",
          label: "Sale Return",
          icon: RefreshCw,
          link: "/lenstransaction/salereturn",
        },
        {
          key: "purchase",
          label: "Purchase",
          icon: ShoppingCart,
          submenu: [
            {
              key: "purchase-invoice",
              label: "Purchase Invoice",
              icon: Receipt,
              link: "/lenstransaction/purchase/purchaseinvoice",
            },
            {
              key: "purchase-order",
              label: "Purchase Order",
              icon: ShoppingCart,
              link: "/lenstransaction/purchase/purchaseorder",
            },
            {
              key: "purchase-challan",
              label: "Purchase Challan",
              icon: FileText,
              link: "/lenstransaction/purchase/purchasechallan",
            },
          ],
        },
        {
          key: "purchase-return",
          label: "Purchase Return",
          icon: RefreshCw,
          link: "/lenstransaction/purchasereturn",
        },

        {
          key: "lens-stock-report",
          label: "Lens Stock Report",
          icon: BarChart3,
          submenu: [
            {
              key: "lens-stock-report-combined",
              label: "Lens Stock Report",
              icon: BarChart3,
              link: "/lenstransaction/lensstockreport/lensstockwithoutbarcode",
            },
            {
              key: "party-wise-item-report",
              label: "Party Wise Item Report",
              icon: FileBarChart,
              link: "/lenstransaction/lensstockreport/partywiseitemreport",
            },
            {
              key: "verify-billing",
              label: "Verify Billing",
              icon: FileText,
              link: "/lenstransaction/lensstockreport/verifybilling",
            },
            {
              key: "lens-movement",
              label: "Lens Movement",
              icon: TrendingUp,
              link: "/lenstransaction/lensstockreport/lensmovement",
            },
            {
              key: "lens-price-summary",
              label: "Lens Price Summary",
              icon: PieChart,
              link: "/lenstransaction/lensstockreport/lenspricesummary",
            },
            {
              key: "verify-lens-stock",
              label: "Verify Lens Stock",
              icon: UserCheck,
              link: "/lenstransaction/lensstockreport/verifylensstock",
            },
            {
              key: "lens-location",
              label: "Lens Location",
              icon: PlusCircle,
              link: "/lenstransaction/lensstockreport/lenslocation",
            },
            {
              key: "customer-item-sales-report",
              label: "Customer Item Sales Report",
              icon: Users,
              link: "/lenstransaction/lensstockreport/customeritemsalesreport",
            },
            {
              key: "item-stock-summary-report",
              label: "Item Stock Summary Report",
              icon: Boxes,
              link: "/lenstransaction/lensstockreport/itemstocksummaryreport",
            },
          ],
        },
        {
          key: "lens-sph-cyl-stock",
          label: "Lens SPH/CYL Wise Stock",
          icon: BarChart3,
          link: "/lenstransaction/lenssphcylwisestock",
        },
        {
          key: "damage-shrinkage",
          label: "Damage and Shrinkage",
          icon: Archive,
          link: "/lenstransaction/damageandshrinkage",
        },
        {
          key: "product-exchange",
          label: "Product Exchange",
          icon: RefreshCw,
          link: "/lenstransaction/productexchange",
        },
      ],
    },
    {
      key: "reports",
      label: "Reports",
      icon: FileBarChart,
      submenu: [
        {
          key: "transaction-details",
          label: "Transaction Details",
          icon: FileText,
          submenu: [
            {
              key: "transaction-summary",
              label: "Transaction Summary",
              icon: PieChart,
              link: "/reports/transactiondetails/transactionsummary",
            },
            {
              key: "transaction-detail",
              label: "Transaction Detail",
              icon: FileText,
              link: "/reports/transactiondetails/transactiondetail",
            },
            {
              key: "sale-summary-formats",
              label: "Sale Summary Formats",
              icon: FileBarChart,
              link: "/reports/transactiondetails/salesummaryformats",
            },
          ],
        },
        {
          key: "books",
          label: "Books",
          icon: FileText,
          submenu: [
            {
              key: "day-book",
              label: "Day Book",
              icon: FileText,
              link: "/reports/books/daybook",
            },
            {
              key: "cash-bank-book",
              label: "Cash/Bank Book",
              icon: FileText,
              link: "/reports/books/cashbankbook",
            },
            {
              key: "profit-loss-item",
              label: "Profit and Loss (Item)",
              icon: TrendingUp,
              link: "/reports/books/profitandlossitem",
            },
            {
              key: "profit-loss-account",
              label: "Profit and Loss (Account)",
              icon: TrendingUp,
              link: "/reports/books/profitandlossaccount",
            },
            {
              key: "balance-sheet",
              label: "Balance Sheet",
              icon: FileBarChart,
              link: "/reports/books/balancesheet",
            },
            {
              key: "collection-report",
              label: "Collection Report",
              icon: FileBarChart,
              link: "/reports/books/collectionreport",
            },
          ],
        },
        {
          key: "ledger",
          label: "Ledger",
          icon: FileText,
          submenu: [
            {
              key: "account-ledger",
              label: "Account Ledger",
              icon: FileText,
              link: "/reports/ledger/accountledger",
            },
            {
              key: "account-ledger-details",
              label: "Account Ledger Details",
              icon: FileText,
              link: "/reports/ledger/accountledgerdetails",
            },
            {
              key: "outstanding",
              label: "Outstanding",
              icon: Clock,
              link: "/reports/ledger/outstanding",
            },
          ],
        },
        {
              key: "item-stock-reorder",
              label: "Item Stock Reorder",
              icon: FileText,
              link: "/reports/stockandinventory/itemstockreorder",    
        },
        {
          key: "gst-reports",
          label: "GST Reports",
          icon: Calculator,
          submenu: [
            {
              key: "gst-summary",
              label: "GST Summary",
              icon: PieChart,
              link: "/reports/gstreports/gstsummary",
            },
            {
              key: "gst-r1",
              label: "GST R1",
              icon: FileText,
              link: "/reports/gstreports/gstr1",
            },
            {
              key: "gst-r2",
              label: "GST R2",
              icon: FileText,
              link: "/reports/gstreports/gstr2",
            },
            {
              key: "gst-r38",
              label: "GST R38",
              icon: FileText,
              link: "/reports/gstreports/gstr38",
            },
            {
              key: "gst-sundry-charge",
              label: "GST Sundry Charge",
              icon: Calculator,
              link: "/reports/gstreports/gstsundrycharge",
            },
          ],
        },
        {
              key: "sale-item-group-wise",
              label: "Sale Item Group Wise Report",
              icon: BarChart3,
              link: "/reports/othersaleorderreports/saleitemgroupwisereport",
        },
        {
          key: "other-reports",
          label: "Other Reports",
          icon: FileBarChart,
          submenu: [

            {
              key: "booked-by-report",
              label: "Booked By Report",
              icon: Users,
              link: "/reports/otherreports/bookedbyreport",
            },
            {
              key: "customer-analysis",
              label: "Customer Analysis",
              icon: Users,
              link: "/reports/otherreports/customeranalysis",
            },
            {
              key: "deleted-data-report",
              label: "Deleted Data Report",
              icon: Archive,
              link: "/reports/otherreports/deleteddatareport",
            },
            {
              key: "user-activity-report",
              label: "Delivery Person Activity Report",
              icon: Clock,
              link: "/reports/otherreports/useractivityreport",
            },
            {
              key: "power-movement-report",
              label: "Power Movement Report",
              icon: Zap,
              link: "/reports/otherreports/powermovementreport",
            },
            {
              key: "sale-return-ratio-report",
              label: "Sale Return Ratio Report",
              icon: TrendingUp,
              link: "/reports/otherreports/salereturnratioreport",
            },
            {
              key: "sale-target-report",
              label: "Sale Target Report",
              icon: Target,
              link: "/reports/otherreports/saletargetreport",
            },
            {
              key: "collection-target-report",
              label: "Customer/Vendor Collection Report",
              icon: Wallet,
              link: "/reports/otherreports/collectiontargetreport",
            },
            {
              key: "cancelled-order-ratio-report",
              label: "Cancelled Order Ratio Report",
              icon: Activity,
              link: "/reports/otherreports/cancelledorderratioreport",
            },
            {
              key: "order-to-challan-time-report",
              label: "Order to Challan Time Report",
              icon: Clock,
              link: "/reports/otherreports/ordertochallantimereport",
            },
            {
              key: "sales-growth-comparison-report",
              label: "Sales Growth Comparison Report",
              icon: TrendingUp,
              link: "/reports/otherreports/salesgrowthcomparisonreport",
            },


          ],
        },

      ],
    },
    {
      key: "utilities",
      label: "Utilities",
      icon: Wrench,
      submenu: [

        {
              key: "backup-restore",
              label: "BackUp And Restore",
              icon: Database,
              link: "/utilities/databasebackuprestore/backupandrestore",
        },
        {
              key: "product-list-update",
              label: "Product List for Update",
              icon: Package,
              link: "/utilities/bulkupdation/productlistforupdate"
        },
        {
          key: "offers",
          label: "Offers",
          icon: DollarSign,
          link: "/utilities/offers",
        },
        {
          key: "shortcut-keys",
          label: "Shortcut Keys",
          icon: Keyboard,
          link: "/utilities/shortcutkeys",
        },
        {
          key: "software-update",
          label: "Software Update",
          icon: Download,
          link: "/utilities/softwareupdate",
        },
      ],
    },
    ...(user?.role === 'super_admin' ? [{
      key: "super-admin",
      label: "Super Admin",
      icon: ShieldCheck,
      submenu: [
        {
          key: "sa-dashboard",
          label: "SA Dashboard",
          icon: BarChart3,
          link: "/super-admin/dashboard",
        },
        {
          key: "sa-companies",
          label: "Manage Companies",
          icon: Building2,
          link: "/super-admin/companies",
        },
        {
          key: "sa-users",
          label: "Global Users",
          icon: Users,
          link: "/super-admin/users",
        },
        {
            key: "sa-plans",
            label: "SaaS Plans",
            icon: Zap,
            link: "/super-admin/plans",
        },
        {
            key: "sa-subscriptions",
            label: "Subscription Manager",
            icon: Activity,
            link: "/super-admin/subscriptions",
        },
        {
            key: "sa-payments",
            label: "Payment History",
            icon: CreditCard,
            link: "/super-admin/payments",
        },
        {
            key: "sa-settings",
            label: "System Settings",
            icon: Settings,
            link: "/super-admin/settings",
        }
      ],
    }] : []),
  ];

  if (user?.role === 'super_admin') {
    return items.filter(item => item.key === 'super-admin');
  }
  return items.filter(item => item.key !== 'super-admin');
}, [user?.role]);

  // Function to find all parent keys for a given item
  const findParentKeys = (items, targetKey, parents = []) => {
    for (const item of items) {
      const currentPath = [...parents, item.key];

      if (item.key === targetKey) {
        return parents; // Return all parents, not including the target itself
      }

      if (item.submenu) {
        const result = findParentKeys(item.submenu, targetKey, currentPath);
        if (result) {
          return result;
        }
      }
    }
    return null;
  };

  // Function to flatten all menu items for searching
  const flattenMenuItems = (items, parentLabel = "") => {
    let flattened = [];
    for (const item of items) {
      flattened.push({
        key: item.key,
        label: item.label,
        link: item.link,
        icon: item.icon,
        parentLabel: parentLabel,
      });
      if (item.submenu) {
        flattened = flattened.concat(
          flattenMenuItems(item.submenu, item.label)
        );
      }
    }
    return flattened;
  };

  // Function to search menu items
  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const allItems = flattenMenuItems(menuItems);
    const filtered = allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.parentLabel.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered);
    setShowSearchResults(true);
  };

  // Function to navigate to a page from search results
  const navigateToPage = (link) => {
    if (link) {
      navigate(link);
      setSearchQuery("");
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Function to find parent keys for a given item
  const findActiveItemByRoute = (items, currentPath) => {
    for (const item of items) {
      if (item.link && (currentPath === item.link || currentPath.startsWith(item.link + "/"))) {
        return item.key;
      }
      if (item.submenu) {
        const result = findActiveItemByRoute(item.submenu, currentPath);
        if (result) {
          return result;
        }
      }
    }
    return null;
  };

  // Update active states based on current route
  useEffect(() => {
    const currentActiveItem = findActiveItemByRoute(menuItems, location.pathname);
    if (currentActiveItem) {
      setActiveItem(currentActiveItem);
      const parents = findParentKeys(menuItems, currentActiveItem);
      if (parents) {
        setActiveParents(new Set(parents));
        // Auto-open parent menus
        const newOpenMenus = {};
        parents.forEach(parent => {
          newOpenMenus[parent] = true;
        });
        setOpenMenus(prev => ({ ...prev, ...newOpenMenus }));
      }
    }
  }, [location.pathname]);

  // Use this new useEffect hook to handle outside clicks
  useEffect(() => {
    // This function will be called on every click event in the document
    const handleOutsideClick = (event) => {
      // Check if the sidebar is expanded and if the click happened outside of it
      if (!isCollapsed && sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setIsCollapsed(true);
      }
    };

    // Add the event listener when the component mounts
    document.addEventListener("mousedown", handleOutsideClick);

    // Clean up the event listener when the component unmounts
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isCollapsed, sidebarRef]); // Re-run the effect if isCollapsed or sidebarRef changes

  const toggleMenu = (menuKey) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  const openMenu = (menuKey) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuKey]: true,
    }));
  };

  const handleItemClick = (itemKey) => {
    setActiveItem(itemKey);

    // Find and set active parents
    const parents = findParentKeys(menuItems, itemKey);
    if (parents) {
      setActiveParents(new Set(parents));
    } else {
      setActiveParents(new Set());
    }
  };

  // expand then navigate helper (used when collapsed and clicking a leaf Link)
  const expandThenNavigate = (link, itemKey) => {
    setIsCollapsed(false);

    // Find parents and open their menus
    const parents = findParentKeys(menuItems, itemKey);
    if (parents) {
      const newOpenMenus = {};
      parents.forEach(parent => {
        newOpenMenus[parent] = true;
      });
      setOpenMenus(prev => ({ ...prev, ...newOpenMenus }));
      setActiveParents(new Set(parents));
    }

    setTimeout(() => {
      navigate(link);
    }, 150); // small delay so expansion animation is visible
  };

  // Close flyout on sidebar scroll to prevent detachment
  useEffect(() => {
    const handleScroll = () => {
      if (hoveredItem) setHoveredItem(null);
    };

    const sidebarEl = sidebarRef.current;
    // The scrollable element is actually the nav inside, or the sidebar-main div?
    // Line 1359: <div ref={sidebarRef} className="sidebar-main ... overflow-y-auto ...">
    // So sidebarRef points to the scrollable container. Correct.

    if (sidebarEl) {
      sidebarEl.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (sidebarEl) {
        sidebarEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, [hoveredItem]);

  const handleItemMouseEnter = (item, event) => {
    if (isMobile) return;

    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    let newPos = { left: rect.right };

    // Intelligent Positioning: Flip to bottom alignment if close to screen bottom
    const spaceBelow = viewportHeight - rect.top;

    if (spaceBelow < 300) { // Threshold for flipping
      newPos.bottom = viewportHeight - rect.bottom;
      newPos.maxHeight = rect.bottom - 20; // Constrain height to available space above
    } else {
      newPos.top = rect.top;
      newPos.maxHeight = viewportHeight - rect.top - 20; // Constrain height to available space below
    }

    setHoveredItem(item.key);
    setFlyoutPosition(newPos);
  };

  const handleItemMouseLeave = () => {
    if (isMobile) return;
    flyoutTimeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
    }, 250);
  };

  const renderMenuItem = (item, level = 0, isInFlyout = false) => {
    const Icon = item.icon;
    const hasSubmenu = Array.isArray(item.submenu) && item.submenu.length > 0;

    // Determine behavior: 
    // Level 0: Always vertical accordion
    // Level > 0 (Submodules): Flyout on Desktop, Accordion on Mobile
    const useFlyout = !isMobile && level > 0;

    const isOpen = useFlyout ? (hoveredItem === item.key) : !!openMenus[item.key];

    // Style adjustments
    // If in flyout, padding should be standard (not indented deeply)
    const paddingLeftValue = isInFlyout ? 16 : 16 + level * 20;
    const paddingStyle = { paddingLeft: `${paddingLeftValue}px` };

    const isLinkActive =
      item.link &&
      (location.pathname === item.link ||
        location.pathname.startsWith(item.link + "/"));

    const isParentActive = activeParents.has(item.key);
    const isCurrentActive = activeItem === item.key;
    const isActive = isLinkActive || isCurrentActive || isParentActive;

    // Common classes
    const itemClasses = `flex items-center justify-between w-full px-4 py-3 text-left transition-all duration-200 cursor-pointer group
      ${!isInFlyout && level === 0 ? "hover:bg-gray-800" : !isInFlyout && level === 1 ? "hover:bg-gray-700" : "hover:bg-gray-600"}
      ${isInFlyout ? "hover:bg-[#b56965] hover:text-white text-gray-300" : ""}
      ${!isInFlyout && isActive ? "bg-[#b56965] text-white" : !isInFlyout && level === 2 ? "text-black" : "text-gray-300"}
      ${!isInFlyout && isParentActive && !isCurrentActive ? "bg-[#8b4d49] text-white" : ""}
      ${useFlyout && isOpen ? "bg-gray-700 text-white" : ""}
    `;

    // Event Handlers for Flyout Trigger
    const eventHandlers = useFlyout && hasSubmenu ? {
      onMouseEnter: (e) => handleItemMouseEnter(item, e),
      onMouseLeave: handleItemMouseLeave
    } : {
      onClick: (e) => {
        if (hasSubmenu) {
          if (isCollapsed) {
            setIsCollapsed(false);
            openMenu(item.key);
            handleItemClick(item.key);
          } else {
            toggleMenu(item.key);
          }
        } else if (item.link) {
          // Link Click Logic
          if (isCollapsed) {
            e.preventDefault();
            expandThenNavigate(item.link, item.key);
            handleItemClick(item.key);
            return;
          }
          handleItemClick(item.key);
          if (isInFlyout) {
            setHoveredItem(null); // Close flyout on click
          }
        } else {
          // Leaf without link (rare)
          handleItemClick(item.key);
        }
      }
    };

    return (
      <div key={item.key} className="w-full relative">
        {item.link && !hasSubmenu ? (
          <Link
            to={item.link}
            {...eventHandlers}
            className={itemClasses}
            style={paddingStyle}
            title={isCollapsed ? item.label : undefined}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {Icon && (
                <Icon
                  size={18}
                  className={`flex-shrink-0 ${!isInFlyout && level === 2 ? "text-black" : "text-white"}`}
                />
              )}
              {(!isCollapsed || level > 0 || isInFlyout) && (
                <span className="text-sm font-medium leading-snug block max-w-[16rem] whitespace-normal break-words">
                  {item.label}
                </span>
              )}
            </div>
          </Link>
        ) : (
          <div
            {...eventHandlers}
            className={itemClasses}
            style={paddingStyle}
            title={isCollapsed ? item.label : undefined}
          >
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {Icon && (
                <Icon
                  size={18}
                  className={`flex-shrink-0 ${!isInFlyout && level === 2 ? "text-black" : "text-white"}`}
                />
              )}
              {(!isCollapsed || level > 0 || isInFlyout) && (
                <span className="text-sm font-medium leading-snug block max-w-[16rem] whitespace-normal break-words">
                  {item.label}
                </span>
              )}
            </div>
            {/* Arrow for Submenu */}
            {!isCollapsed && hasSubmenu && !isInFlyout && (
              <div className="flex-shrink-0">
                {(!useFlyout && isOpen) ? (
                  <ChevronDown size={16} className="transition-transform duration-300 ease-out" />
                ) : (
                  <ChevronRight size={16} className="transition-transform duration-300 ease-out" />
                )}
              </div>
            )}
            {/* Arrow for Flyout parent indicates expansion to right */}
            {isInFlyout && hasSubmenu && (
              <ChevronRight size={16} />
            )}
          </div>
        )}

        {/* Submenu Rendering */}
        {hasSubmenu && (
          useFlyout ? (
            // Flyout Render
            isOpen && createPortal(
              <div
                className="fixed z-[9999] bg-gray-900 border border-gray-700 shadow-2xl rounded-md py-1 overflow-y-auto custom-scrollbar"
                style={{
                  left: flyoutPosition.left,
                  top: flyoutPosition.top,
                  bottom: flyoutPosition.bottom,
                  maxHeight: flyoutPosition.maxHeight || '80vh',
                  minWidth: '220px',
                  width: 'max-content'
                }}
                onMouseEnter={() => { if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current); }}
                onMouseLeave={handleItemMouseLeave}
              >
                {item.submenu.map((subItem) => renderMenuItem(subItem, level + 1, true))}
              </div>,
              document.body
            )
          ) : (
            // Standard Vertical Render (Accordion)
            <div
              className={`overflow-hidden transition-all duration-300 ease-out ${isOpen && (!isCollapsed || level > 0 || isInFlyout)
                ? "max-h-[1000px] opacity-100" // Increased max-h for safety
                : "max-h-0 opacity-0"
                }`}
            >
              <div
                className={`transition-all duration-300 ease-out transform ${isOpen && (!isCollapsed || level > 0) ? "translate-y-0" : "-translate-y-2"
                  } ${level === 1 ? "bg-white border-r border-black" : "bg-gray-900"}`}
              >
                {item.submenu.map((subItem) => renderMenuItem(subItem, level + 1, isInFlyout))}
              </div>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div ref={sidebarRef} className={`sidebar-main bg-black text-white transition-all duration-300 flex flex-col h-screen sticky top-0 ${isCollapsed ? "w-16" : "w-80"}`}>
      <div className="flex flex-col border-b border-gray-800">
        {/* Header with toggle button */}
        <div className="flex items-center justify-between p-4">
          {!isCollapsed && <h2 className="text-lg font-semibold text-white">Optical Store</h2>}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-lg hover:bg-gray-800 transition-colors duration-200">
            <Menu size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className={`transition-all duration-300 ${!isCollapsed ? "px-4 pb-4 relative" : "flex justify-center pb-4"}`}>
          {!isCollapsed ? (
            <div className="flex items-center bg-gray-800 rounded-lg px-3 py-2 w-full transition-all duration-300 ease-in-out">
              <Search size={16} className="text-gray-400 mr-2 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="bg-transparent text-white text-sm outline-none w-full placeholder-gray-500 transition-opacity duration-300"
              />
            </div>
          ) : (
            <button
              onClick={handleSearchIconClick}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors duration-200"
              title="Search"
            >
              <Search size={20} />
            </button>
          )}

          {/* Search Results Dropdown */}
          {!isCollapsed && showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-4 right-4 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => navigateToPage(result.link)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 border-b border-gray-700 last:border-b-0 transition-colors duration-150"
                >
                  <div className="flex items-center gap-2">
                    {result.icon && <result.icon size={16} />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {result.label}
                      </div>
                      {result.parentLabel && (
                        <div className="text-xs text-gray-400 truncate">
                          {result.parentLabel}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {!isCollapsed && showSearchResults && searchResults.length === 0 && (
            <div className="absolute top-full left-4 right-4 mt-2 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-400 z-50">
              No pages found matching "{searchQuery}"
            </div>
          )}

        </div>
      </div>
      <nav className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden py-4">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>
      <div className="border-t border-gray-700 py-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 text-sm text-white hover:bg-gray-800 transition-colors duration-200"
        >
          <LogOut size={18} className="mr-2" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
