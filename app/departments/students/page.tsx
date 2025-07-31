"use client";

import { useEffect } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useRouter } from "next/navigation";
import MainLayout from "@/app/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AcademicCapIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

export default function DepartmentStudentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect if not department role (allow both 'department' and 'hod' roles)
  useEffect(() => {
    if (!loading && user && user.role !== "department" && user.role !== "hod") {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || (user && user.role !== "department" && user.role !== "hod")) {
    return (
      <MainLayout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-semibold mb-2">Loading...</h1>
            <p className="text-gray-500">Preparing student management</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!user || (user.role !== "department" && user.role !== "hod")) {
    return (
      <MainLayout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-semibold mb-2 text-red-600">
              Access Denied
            </h1>
            <p className="text-gray-500">
              This page is only accessible to department administrators
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Student Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Student data and management features
            </p>
          </div>
        </div>

        {/* Under Development Card */}
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="p-12 max-w-md text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <AcademicCapIcon className="h-16 w-16 text-gray-400" />
                <div className="absolute -top-2 -right-2">
                  <WrenchScrewdriverIcon className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Under Development
            </h2>

            <p className="text-gray-600 mb-6 leading-relaxed">
              The student management module is currently being developed. This
              will include student records, academic performance tracking, and
              department-wise student analytics.
            </p>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
              <ClockIcon className="h-4 w-4" />
              <span>Coming Soon</span>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <strong>Planned Features:</strong>
              </div>
              <ul className="text-xs text-gray-500 space-y-1 text-left">
                <li>• Student directory and profiles</li>
                <li>• Academic performance tracking</li>
                <li>• Department-wise analytics</li>
                <li>• Student progress reports</li>
                <li>• Placement and internship data</li>
              </ul>
            </div>

            <div className="mt-8">
              <Button
                variant="outline"
                onClick={() => router.back()}
                className="w-full"
              >
                Go Back
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
