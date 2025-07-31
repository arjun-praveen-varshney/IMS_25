"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
import MainLayout from "@/app/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  UserGroupIcon,
  DocumentTextIcon,
  BeakerIcon,
  TrophyIcon,
  CalendarIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

interface Faculty {
  F_id: number;
  F_name: string;
  F_dept: string;
  Email?: string;
  Current_Designation?: string;
  Experience?: number;
  publicationCount?: number;
  researchProjectCount?: number;
  awardCount?: number;
  workshopCount?: number;
}

interface ReportModule {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
}

const reportModules: ReportModule[] = [
  {
    id: "publications",
    title: "Publications",
    description: "Journal articles, conference papers, and book chapters",
    icon: DocumentTextIcon,
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  {
    id: "research-projects",
    title: "Research Projects",
    description: "Ongoing and completed research projects",
    icon: BeakerIcon,
    color: "bg-green-50 text-green-600 border-green-200",
  },
  {
    id: "awards",
    title: "Awards",
    description: "Recognition and achievements",
    icon: TrophyIcon,
    color: "bg-yellow-50 text-yellow-600 border-yellow-200",
  },
  {
    id: "workshops",
    title: "Workshops",
    description: "Training and professional development",
    icon: CalendarIcon,
    color: "bg-purple-50 text-purple-600 border-purple-200",
  },
  {
    id: "memberships",
    title: "Memberships",
    description: "Professional body memberships",
    icon: UserGroupIcon,
    color: "bg-indigo-50 text-indigo-600 border-indigo-200",
  },
  {
    id: "contributions",
    title: "Contributions",
    description: "Academic and administrative contributions",
    icon: ChartBarIcon,
    color: "bg-red-50 text-red-600 border-red-200",
  },
];

export default function DepartmentFacultyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "faculty";

  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(true);
  const [selectedFaculty, setSelectedFaculty] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  // Redirect if not department role (allow both 'department' and 'hod' roles)
  useEffect(() => {
    if (!loading && user && user.role !== "department" && user.role !== "hod") {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  // Fetch department faculty
  useEffect(() => {
    if (
      user &&
      (user.role === "department" || user.role === "hod") &&
      user.departmentId
    ) {
      fetchDepartmentFaculty(user.departmentId);
    }
  }, [user]);

  const fetchDepartmentFaculty = async (departmentId: number) => {
    try {
      setLoadingFaculty(true);
      const response = await fetch(`/api/departments/${departmentId}/faculty`);

      if (!response.ok) {
        throw new Error("Failed to fetch faculty");
      }

      const data = await response.json();
      if (data.success) {
        setFaculty(data.data);
      }
    } catch (error) {
      console.error("Error fetching faculty:", error);
    } finally {
      setLoadingFaculty(false);
    }
  };

  const handleGenerateReport = async (moduleId: string) => {
    try {
      setGeneratingReport(moduleId);

      const params = new URLSearchParams({
        reportType: moduleId,
        facultyId: selectedFaculty,
        year: selectedYear,
        departmentId: user?.departmentId?.toString() || "",
      });

      const response = await fetch(`/api/reports/department?${params}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${moduleId}-report-${selectedYear}-${selectedFaculty}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setGeneratingReport(null);
    }
  };

  if (loading || (user && user.role !== "department" && user.role !== "hod")) {
    return (
      <MainLayout>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-semibold mb-2">Loading...</h1>
            <p className="text-gray-500">Preparing faculty management</p>
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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Faculty Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage faculty data and generate comprehensive reports
            </p>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const params = new URLSearchParams(searchParams);
            params.set("tab", value);
            router.push(`/departments/faculty?${params.toString()}`);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="faculty">Faculty Directory</TabsTrigger>
            <TabsTrigger value="reports">Report Generation</TabsTrigger>
          </TabsList>

          <TabsContent value="faculty" className="space-y-6">
            {loadingFaculty ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4"></div>
                    <div className="space-y-2">
                      <div className="h-2 bg-gray-200 rounded"></div>
                      <div className="h-2 bg-gray-200 rounded"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {faculty.map((member) => (
                  <Card key={member.F_id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {member.F_name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {member.Current_Designation || "Faculty"}
                        </p>
                      </div>
                      <Badge variant="secondary">ID: {member.F_id}</Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Experience:</span>
                        <span>{member.Experience || 0} years</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Publications:</span>
                        <span>{member.publicationCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">
                          Research Projects:
                        </span>
                        <span>{member.researchProjectCount || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Awards:</span>
                        <span>{member.awardCount || 0}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <Link href={`/faculty/${member.F_id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            {/* Report Controls */}
            <Card className="p-6">
              <h3 className="text-lg font-medium mb-4">
                Report Generation Controls
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Faculty Selection
                  </label>
                  <select
                    value={selectedFaculty}
                    onChange={(e) => setSelectedFaculty(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="all">All Faculty</option>
                    {faculty.map((member) => (
                      <option key={member.F_id} value={member.F_id.toString()}>
                        {member.F_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Academic Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="all">All Years</option>
                    {years.map((year) => (
                      <option key={year} value={year.toString()}>
                        {year}-{year + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            {/* Report Modules */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reportModules.map((module) => (
                <Card
                  key={module.id}
                  className={`p-6 border-2 ${module.color}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <module.icon className="h-8 w-8" />
                    <Button
                      onClick={() => handleGenerateReport(module.id)}
                      disabled={generatingReport === module.id}
                      size="sm"
                      className="ml-2"
                    >
                      {generatingReport === module.id ? (
                        "Generating..."
                      ) : (
                        <>
                          <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-2">
                    {module.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {module.description}
                  </p>

                  <div className="text-xs text-gray-500">
                    Faculty:{" "}
                    {selectedFaculty === "all"
                      ? "All"
                      : faculty.find(
                          (f) => f.F_id.toString() === selectedFaculty
                        )?.F_name}
                    <br />
                    Year:{" "}
                    {selectedYear === "all"
                      ? "All Years"
                      : `${selectedYear}-${parseInt(selectedYear) + 1}`}
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
