"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HomeIcon,
  UsersIcon,
  AcademicCapIcon,
  BookOpenIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/app/providers/auth-provider";
import { useState } from "react";

interface SidebarItem {
  title: string;
  href: string;
  icon: any;
  roles?: string[];
  children?: SidebarItem[];
}

// Define sidebar items based on roles
const getSidebarItems = (userRole: string | undefined): SidebarItem[] => {
  // HOD users should have department interface (acting as department users)
  if (userRole === "department" || userRole === "hod") {
    return [
      { title: "Dashboard", href: "/departments/dashboard", icon: HomeIcon },
      { title: "Faculty", href: "/departments/faculty", icon: UsersIcon },
      {
        title: "Students",
        href: "/departments/students",
        icon: AcademicCapIcon,
      },
    ];
  }

  // For all other roles (admin, faculty, etc.)
  const commonItems: SidebarItem[] = [
    { title: "Dashboard", href: "/dashboard", icon: HomeIcon },
  ];

  return [
    ...commonItems,
    { title: "Faculty", href: "/faculty", icon: UsersIcon },
    { title: "Departments", href: "/departments", icon: BuildingLibraryIcon },
  ];
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const sidebarItems = getSidebarItems(user?.role);

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href]
    );
  };

  const renderSidebarItem = (item: SidebarItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.href);
    const isActive = pathname.startsWith(item.href);

    if (hasChildren) {
      return (
        <div key={item.href}>
          <Button
            variant="ghost"
            className={cn(
              "flex h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100",
              isActive && "bg-gray-100 font-semibold text-gray-900",
              level > 0 && "ml-4"
            )}
            onClick={() => toggleExpanded(item.href)}
          >
            <div className="flex items-center gap-2">
              <item.icon className="h-5 w-5" />
              {item.title}
            </div>
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </Button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children?.map((child) =>
                renderSidebarItem(child, level + 1)
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <Button
        key={item.href}
        variant="ghost"
        className={cn(
          "flex h-10 w-full items-center justify-start gap-2 rounded-md px-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100",
          pathname.startsWith(item.href) &&
            "bg-gray-100 font-semibold text-gray-900",
          level > 0 && "ml-4"
        )}
        asChild
      >
        <Link href={item.href}>
          <item.icon className="h-5 w-5" />
          {item.title}
        </Link>
      </Button>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r bg-white lg:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link
          href={
            user?.role === "hod" || user?.role === "department"
              ? "/departments/dashboard"
              : "/dashboard"
          }
          className="flex items-center gap-2 font-semibold"
        >
          <span>IMS Portal</span>
        </Link>
      </div>
      <ScrollArea className="flex-1 overflow-auto py-2">
        <nav className="flex flex-col gap-1 px-2">
          {sidebarItems.map((item) => renderSidebarItem(item))}
        </nav>
      </ScrollArea>
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.name || "User"}</span>
            <span className="text-xs text-gray-500 capitalize">
              {user?.role || "guest"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
