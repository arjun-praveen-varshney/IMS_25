"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useRouter } from "next/navigation";
import MainLayout from "@/app/components/layout/MainLayout";
import StatsCard from "@/app/components/ui/StatsCard";
import ChartCard from "@/app/components/ui/ChartCard";
import DepartmentBarChart from "@/app/components/dashboard/DepartmentBarChart";
import { formatNumber } from "@/app/lib/utils";
import {
  UserGroupIcon,
  AcademicCapIcon,
  DocumentTextIcon,
  ChartBarIcon,
  TrophyIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";

interface DepartmentStats {
  totalFaculty: number;
  totalStudents: number;
  totalPublications: number;
  totalResearchProjects: number;
  totalAwards: number;
  totalWorkshops: number;
  facultyByDesignation: { designation: string; count: number }[];
  publicationsByYear: { year: string; count: number }[];
  departmentName: string;
}

export default function DepartmentDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DepartmentStats>({
    totalFaculty: 0,
    totalStudents: 0,
    totalPublications: 0,
    totalResearchProjects: 0,
    totalAwards: 0,
    totalWorkshops: 0,
    facultyByDesignation: [],
    publicationsByYear: [],
    departmentName: "",
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Redirect if not department role (allow both 'department' and 'hod' roles)
  useEffect(() => {
    if (!loading && user && user.role !== "department" && user.role !== "hod") {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  // Fetch department statistics
  useEffect(() => {
    if (
      user &&
      (user.role === "department" || user.role === "hod") &&
      user.departmentId
    ) {
      fetchDepartmentStats(user.departmentId);
    }
  }, [user]);

  const fetchDepartmentStats = async (departmentId: number) => {
    try {
      setLoadingStats(true);
      const response = await fetch(`/api/departments/${departmentId}/stats`);

      if (!response.ok) {
        throw new Error("Failed to fetch department statistics");
      }

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching department stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading || (user && user.role !== "department" && user.role !== "hod")) {
    return (
      <MainLayout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-semibold mb-2">Loading...</h1>
            <p className="text-gray-500">Preparing department dashboard</p>
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
              This dashboard is only accessible to department administrators
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Department Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {stats.departmentName
                ? `${stats.departmentName} Department`
                : "Department"}{" "}
              Overview and Analytics
            </p>
          </div>
        </div>

        {loadingStats ? (
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-gray-100 rounded-lg shadow"
                ></div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <StatsCard
                title="Total Faculty"
                value={formatNumber(stats.totalFaculty)}
                icon={<UserGroupIcon className="h-6 w-6 text-indigo-600" />}
                bgColor="bg-gradient-to-br from-indigo-50 to-white"
              />
              <StatsCard
                title="Total Students"
                value={formatNumber(stats.totalStudents)}
                icon={<AcademicCapIcon className="h-6 w-6 text-purple-600" />}
                bgColor="bg-gradient-to-br from-purple-50 to-white"
              />
              <StatsCard
                title="Publications"
                value={formatNumber(stats.totalPublications)}
                icon={<DocumentTextIcon className="h-6 w-6 text-green-600" />}
                bgColor="bg-gradient-to-br from-green-50 to-white"
              />
              <StatsCard
                title="Research Projects"
                value={formatNumber(stats.totalResearchProjects)}
                icon={<BeakerIcon className="h-6 w-6 text-blue-600" />}
                bgColor="bg-gradient-to-br from-blue-50 to-white"
              />
              <StatsCard
                title="Awards"
                value={formatNumber(stats.totalAwards)}
                icon={<TrophyIcon className="h-6 w-6 text-yellow-600" />}
                bgColor="bg-gradient-to-br from-yellow-50 to-white"
              />
              <StatsCard
                title="Workshops"
                value={formatNumber(stats.totalWorkshops)}
                icon={<ChartBarIcon className="h-6 w-6 text-red-600" />}
                bgColor="bg-gradient-to-br from-red-50 to-white"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartCard
                title="Faculty by Designation"
                className="bg-white shadow-md hover:shadow-lg transition-shadow"
                useGradient={true}
                gradientFrom="from-blue-600"
                gradientTo="to-indigo-600"
              >
                <DepartmentBarChart
                  data={stats.facultyByDesignation.map((item) => ({
                    department: item.designation,
                    count: item.count,
                  }))}
                  dataKey="count"
                  barColor="#3b82f6"
                  height={350}
                />
              </ChartCard>

              <ChartCard
                title="Publications by Year"
                className="bg-white shadow-md hover:shadow-lg transition-shadow"
                useGradient={true}
                gradientFrom="from-green-600"
                gradientTo="to-emerald-600"
              >
                <DepartmentBarChart
                  data={stats.publicationsByYear.map((item) => ({
                    department: item.year,
                    count: item.count,
                  }))}
                  dataKey="count"
                  barColor="#10b981"
                  height={350}
                />
              </ChartCard>
            </div>

            {/* Quick Actions */}
            <div className="bg-white shadow-md rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => router.push("/departments/faculty")}
                  className="flex items-center justify-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <UserGroupIcon className="h-5 w-5 text-indigo-600" />
                  <span className="text-sm font-medium">View Faculty</span>
                </button>

                <button
                  onClick={() => router.push("/departments/students")}
                  className="flex items-center justify-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <AcademicCapIcon className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium">View Students</span>
                </button>

                <button
                  onClick={() =>
                    router.push("/departments/faculty?tab=reports")
                  }
                  className="flex items-center justify-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <DocumentTextIcon className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Generate Reports</span>
                </button>

                <button
                  onClick={() => router.push("/departments")}
                  className="flex items-center justify-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ChartBarIcon className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium">Department Info</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
