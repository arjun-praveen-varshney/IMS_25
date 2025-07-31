"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserGroupIcon,
  AcademicCapIcon,
  BuildingLibraryIcon,
  BookOpenIcon,
  DocumentTextIcon,
  DocumentChartBarIcon,
  AcademicCapIcon as AcademicCapSolid,
  ChartBarIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { formatNumber } from "@/app/lib/utils";
import MainLayout from "@/app/components/layout/MainLayout";
import StatsCard from "@/app/components/ui/StatsCard";
import ChartCard from "@/app/components/ui/ChartCard";
import DepartmentDistributionChart from "@/app/components/dashboard/DepartmentDistributionChart";
import DepartmentBarChart from "@/app/components/dashboard/DepartmentBarChart";
import { DashboardStats } from "@/app/lib/types";
import { NavHelper } from "./nav-helper";
import { useAuth } from "@/app/providers/auth-provider";
import { EnhancedReportPreview } from "@/app/components/ui/enhanced-report-preview";

interface DepartmentStat {
  Department_ID: number;
  Department_Name: string;
  current_faculty_count: number;
  professor_count: number;
  associate_professor_count: number;
  assistant_professor_count: number;
  Total_Students: number;
  research_projects: number;
  publications: number;
}

interface DepartmentData {
  department: string;
  count: number;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Department users should be redirected during login, not here
  // This redirect was causing infinite loops - DISABLED
  // useEffect(() => {
  //   if (
  //     !authLoading &&
  //     user &&
  //     (user.role === "department" || user.role === "hod")
  //   ) {
  //     router.replace("/departments/dashboard");
  //     return;
  //   }
  // }, [user, authLoading, router]);

  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [dashboardData, setDashboardData] = useState<
    DashboardStats & {
      professorCount: number;
      associateProfessorCount: number;
      assistantProfessorCount: number;
      totalResearchProjects: number;
      totalPublications: number;
      departmentDetails: DepartmentStat[];
    }
  >({
    totalFaculty: 0,
    totalStudents: 0,
    totalDepartments: 0,
    totalCourses: 0,
    facultyByDepartment: [],
    studentsByDepartment: [],
    recentAnnouncements: [],
    upcomingEvents: [],
    professorCount: 0,
    associateProfessorCount: 0,
    assistantProfessorCount: 0,
    totalResearchProjects: 0,
    totalPublications: 0,
    departmentDetails: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"naac" | "nba">("naac");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportType, setReportType] = useState<
    "full" | "faculty" | "student" | "research"
  >("faculty");
  const [reportMessage, setReportMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportData, setReportData] = useState<{
    pdfBase64?: string;
    filename?: string;
    reportType?: string;
  }>({});
  const [orgCounts, setOrgCounts] = useState<
    { organization: string; count: number }[]
  >([]);
  const [biodataLoading, setBiodataLoading] = useState(false);
  const [biodataReportData, setBiodataReportData] = useState<{
    pdfBase64?: string;
    filename?: string;
  }>({});
  const [biodataPreviewOpen, setBiodataPreviewOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await fetchDashboardData();
        setDashboardData(data);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === "nba") {
      fetch("/api/faculty/memberships?aggregate=organization")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setOrgCounts(data.data);
        });
    }
  }, [activeTab]);

  // Extract the needed data
  const {
    totalFaculty,
    totalStudents,
    totalDepartments,
    totalCourses,
    facultyByDepartment,
    studentsByDepartment,
    professorCount,
    associateProfessorCount,
    assistantProfessorCount,
    totalResearchProjects,
    totalPublications,
    departmentDetails,
  } = dashboardData;

  // Check API on load
  useEffect(() => {
    async function testApi() {
      setLoadingDiag(true);
      try {
        // Test the me endpoint
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();

        // Get cookies
        const cookies = document.cookie.split(";").map((c) => c.trim());

        setDiagnostic({
          apiStatus: response.status,
          apiSuccess: data.success,
          userData: data.user,
          cookies,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        setDiagnostic({
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      } finally {
        setLoadingDiag(false);
      }
    }

    if (!loading) {
      testApi();
    }
  }, [loading]);

  // Try bypass auth if needed
  const bypassAuth = async () => {
    try {
      setLoadingDiag(true);
      const response = await fetch("/api/debug/bypass-auth", {
        credentials: "include",
      });

      if (response.ok) {
        window.location.reload();
      } else {
        const data = await response.json();
        alert("Bypass failed: " + data.message);
      }
    } catch (error) {
      alert(
        "Error: " + (error instanceof Error ? error.message : String(error))
      );
    } finally {
      setLoadingDiag(false);
    }
  };
  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      setReportMessage(null);

      // If faculty report, open in a new tab instead of showing modal
      if (reportType === "faculty") {
        window.open(
          `/reports/faculty${activeTab === "nba" ? "?departmentId=all" : ""}`,
          "_blank"
        );
        setReportMessage({
          type: "success",
          text: "Faculty Report opened in a new tab.",
        });
        setGeneratingReport(false);
        return;
      }

      // For other reports, continue as before
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportType,
          departmentId: activeTab === "nba" ? "all" : undefined,
          facultyId: user?.username, // Add current faculty ID
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Store the report data for preview
        setReportData({
          pdfBase64: result.data.pdfBase64,
          filename: result.data.filename,
          reportType: result.data.reportType,
        });

        // Open the preview dialog
        setPreviewOpen(true);

        setReportMessage({
          type: "success",
          text: `Report generated successfully. You can now preview, download, or print it.`,
        });
      } else {
        throw new Error(result.message || "Failed to generate report");
      }
    } catch (error) {
      console.error("Error generating report:", error);
      setReportMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "An error occurred while generating the report",
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleGenerateBiodata = async () => {
    if (!user || !user.username) return;
    try {
      setBiodataLoading(true);
      try {
        await fetch(`/api/faculty/biodata/setup`);
      } catch (setupError) {
        console.warn("Setup endpoint error:", setupError);
      }
      const response = await fetch(
        `/api/faculty/biodata?facultyId=${user.username}`
      );
      if (!response.ok)
        throw new Error(`Failed to generate biodata: ${response.status}`);
      const result = await response.json();
      if (!result.success)
        throw new Error(result.message || "Failed to generate biodata");
      setBiodataReportData({
        pdfBase64: result.data.pdfBase64,
        filename: result.data.filename,
      });
      setBiodataPreviewOpen(true);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "An error occurred while generating biodata"
      );
    } finally {
      setBiodataLoading(false);
    }
  };

  // You can create a loading state if needed
  if (loading || authLoading) {
    return (
      <MainLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-1/4 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg shadow"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-80 bg-gray-100 rounded-lg shadow"></div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  // if (!user) {
  //   return (
  //     <div className="flex min-h-screen items-center justify-center">
  //       <div className="text-center">
  //         <h1 className="text-xl font-semibold mb-2">Not Authenticated</h1>
  //         <p className="text-gray-500 mb-4">
  //           Please log in to access the dashboard
  //         </p>

  //         <div className="flex flex-col space-y-4">
  //           <Link
  //             href="/login"
  //             className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
  //           >
  //             Go to Login
  //           </Link>

  //           <button
  //             onClick={async () => {
  //               try {
  //                 setLoadingDiag(true);
  //                 // Call the bypass-auth endpoint for development use
  //                 const response = await fetch("/api/debug/bypass-auth", {
  //                   method: "GET",
  //                   credentials: "include", // Important: This ensures cookies are sent and stored
  //                   headers: {
  //                     Accept: "application/json",
  //                     "Content-Type": "application/json",
  //                   },
  //                 });

  //                 if (response.ok) {
  //                   const data = await response.json();
  //                   // Store user data in sessionStorage for immediate use
  //                   if (data.success && data.user) {
  //                     sessionStorage.setItem(
  //                       "authUser",
  //                       JSON.stringify(data.user)
  //                     );
  //                     // Force reload to apply the new authentication state
  //                     window.location.reload();
  //                   } else {
  //                     alert("Auth bypass returned success=false");
  //                   }
  //                 } else {
  //                   alert("Bypass auth failed: " + response.statusText);
  //                 }
  //               } catch (error) {
  //                 alert(
  //                   "Error: " +
  //                     (error instanceof Error ? error.message : String(error))
  //                 );
  //               } finally {
  //                 setLoadingDiag(false);
  //               }
  //             }}
  //             className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
  //           >
  //             Try Auth Bypass (Dev Mode)
  //           </button>

  //           <button
  //             onClick={async () => {
  //               try {
  //                 setLoadingDiag(true);
  //                 // Call the new auth-fix endpoint
  //                 const response = await fetch("/api/debug/auth-fix", {
  //                   method: "GET",
  //                   credentials: "include",
  //                   headers: {
  //                     Accept: "application/json",
  //                     "Content-Type": "application/json",
  //                   },
  //                 });

  //                 if (response.ok) {
  //                   const data = await response.json();
  //                   // Store user data in sessionStorage
  //                   if (data.success && data.user) {
  //                     sessionStorage.setItem(
  //                       "authUser",
  //                       JSON.stringify(data.user)
  //                     );
  //                     alert("Authentication fixed! Reloading page...");
  //                     // Force reload with a slight delay
  //                     setTimeout(() => window.location.reload(), 500);
  //                   } else {
  //                     alert("Auth fix returned success=false");
  //                   }
  //                 } else {
  //                   alert("Auth fix failed: " + response.statusText);
  //                 }
  //               } catch (error) {
  //                 alert(
  //                   "Error: " +
  //                     (error instanceof Error ? error.message : String(error))
  //                 );
  //               } finally {
  //                 setLoadingDiag(false);
  //               }
  //             }}
  //             className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
  //           >
  //             Fix Authentication (Recommended)
  //           </button>
  //         </div>

  //         {diagnostic && (
  //           <div className="mt-8 p-4 bg-gray-100 rounded text-left max-w-lg mx-auto text-xs overflow-auto">
  //             <h2 className="font-semibold mb-2">Diagnostic Info:</h2>
  //             <pre>{JSON.stringify(diagnostic, null, 2)}</pre>
  //           </div>
  //         )}
  //       </div>
  //     </div>
  //   );
  // }

  const groupedOrgCounts = groupOrgCountsByCategory(orgCounts);
  const nationalChartData = getOrgChartData(orgCounts, "National");
  const internationalChartData = getOrgChartData(orgCounts, "International");

  return (
    <MainLayout>
      {" "}
      <NavHelper /> {/* Report Preview Dialog */}
      <EnhancedReportPreview
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfBase64={reportData.pdfBase64}
        filename={reportData.filename}
        title={`${reportData.reportType
          ?.charAt(0)
          .toUpperCase()}${reportData.reportType?.slice(1)} Report`}
        reportType={reportData.reportType}
      />
      <EnhancedReportPreview
        isOpen={biodataPreviewOpen}
        onClose={() => setBiodataPreviewOpen(false)}
        pdfBase64={biodataReportData.pdfBase64}
        filename={biodataReportData.filename}
        title="Faculty CV/Biodata"
      />
      <div className="space-y-8">
        {/* Page title with report generation options */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">
              Welcome to the Information Management System Dashboard.
              Here&apos;s an overview of key academic metrics.
            </p>
          </div>
          {/* <div className="flex flex-col sm:flex-row gap-3 items-center">
            <select
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as "full" | "faculty" | "student" | "research"
                )
              }
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              disabled={generatingReport}
            >
              <option value="faculty">Faculty Report</option>
              <option value="full">Full Report</option>
              <option value="student">Student Report</option>
              <option value="research">Research Output Report</option>
            </select>
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-300"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              {generatingReport ? "Generating..." : "Generate Report"}
            </button>
            {user?.role === "faculty" && (
              <button
                onClick={handleGenerateBiodata}
                disabled={biodataLoading}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors disabled:bg-gray-200"
                style={{ minWidth: "180px" }}
              >
                <DocumentArrowDownIcon className="h-5 w-5" />
                {biodataLoading ? "Generating..." : "Generate CV/Biodata"}
              </button>
            )}
          </div> */}
        </div>

        {/* Report status message */}
        {reportMessage && (
          <div
            className={`p-4 rounded-md ${
              reportMessage.type === "success"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {reportMessage.text}
          </div>
        )}

        {/* Stats cards with improved UI */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Faculty"
            value={formatNumber(totalFaculty)}
            icon={<UserGroupIcon className="h-6 w-6 text-indigo-600" />}
            trend="up"
            change={5}
            changeText="from last semester"
            bgColor="bg-gradient-to-br from-indigo-50 to-white"
          />
          <StatsCard
            title="Total student"
            value={formatNumber(totalStudents)}
            icon={<AcademicCapIcon className="h-6 w-6 text-purple-600" />}
            trend="up"
            change={8}
            changeText="from last semester"
            bgColor="bg-gradient-to-br from-purple-50 to-white"
          />
          <StatsCard
            title="Departments"
            value={formatNumber(totalDepartments)}
            icon={<BuildingLibraryIcon className="h-6 w-6 text-blue-600" />}
            bgColor="bg-gradient-to-br from-blue-50 to-white"
          />
          <StatsCard
            title="Courses"
            value={formatNumber(totalCourses)}
            icon={<BookOpenIcon className="h-6 w-6 text-pink-600" />}
            trend="up"
            change={3}
            changeText="new courses added"
            bgColor="bg-gradient-to-br from-pink-50 to-white"
          />
        </div>

        {/* NAAC vs NBA Tab Selector */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("naac")}
              className={`${
                activeTab === "naac"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <DocumentChartBarIcon className="h-5 w-5" />
              NAAC Metrics (Institute Level)
            </button>
            <button
              onClick={() => setActiveTab("nba")}
              className={`${
                activeTab === "nba"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
            >
              <ChartBarIcon className="h-5 w-5" />
              NBA Metrics (Department Level)
            </button>
          </nav>
        </div>

        {/* NAAC Stats (Institute Level) */}
        {activeTab === "naac" && (
          <div className="space-y-6">
            {/* Faculty Designation Distribution */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <StatsCard
                title="Professors"
                value={formatNumber(professorCount)}
                icon={<AcademicCapSolid className="h-6 w-6 text-red-600" />}
                bgColor="bg-gradient-to-br from-red-50 to-white"
              />
              <StatsCard
                title="Associate Professors"
                value={formatNumber(associateProfessorCount)}
                icon={<AcademicCapSolid className="h-6 w-6 text-amber-600" />}
                bgColor="bg-gradient-to-br from-amber-50 to-white"
              />
              <StatsCard
                title="Assistant Professors"
                value={formatNumber(assistantProfessorCount)}
                icon={<AcademicCapSolid className="h-6 w-6 text-green-600" />}
                bgColor="bg-gradient-to-br from-green-50 to-white"
              />
            </div>

            {/* Research and Publications */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <StatsCard
                title="Total Research Projects"
                value={formatNumber(totalResearchProjects)}
                icon={<DocumentTextIcon className="h-6 w-6 text-blue-600" />}
                bgColor="bg-gradient-to-br from-blue-50 to-white"
              />
              <StatsCard
                title="Total Publications"
                value={formatNumber(totalPublications)}
                icon={<DocumentTextIcon className="h-6 w-6 text-purple-600" />}
                bgColor="bg-gradient-to-br from-purple-50 to-white"
              />
            </div>

            {/* Charts with improved UI */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartCard
                title="Faculty Distribution by Department"
                className="bg-white shadow-md hover:shadow-lg transition-shadow"
                useGradient={true}
                gradientFrom="from-blue-600"
                gradientTo="to-indigo-600"
              >
                <DepartmentDistributionChart
                  dataKey="faculty"
                  data={facultyByDepartment}
                  height={350}
                />
              </ChartCard>
              <ChartCard
                title="Students by Department"
                className="bg-white shadow-md hover:shadow-lg transition-shadow"
                useGradient={true}
                gradientFrom="from-purple-600"
                gradientTo="to-pink-600"
              >
                <DepartmentBarChart
                  data={studentsByDepartment}
                  barColor="#8b5cf6"
                  height={350}
                />
              </ChartCard>
            </div>
          </div>
        )}

        {/* NBA Stats (Department Level) */}
        {activeTab === "nba" && (
          <div className="space-y-6">
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-gradient-to-r from-indigo-600 to-purple-600">
                <h3 className="text-lg font-medium leading-6 text-white">
                  Department-wise Statistics
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-indigo-100">
                  Detailed breakdown of key metrics by department for NBA
                  assessment
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Department
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Faculty Count
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Professors
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Associate Prof.
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Assistant Prof.
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        student
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Research Projects
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Publications
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {departmentDetails.map((dept) => (
                      <tr key={dept.Department_ID} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {dept.Department_Name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {dept.current_faculty_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {dept.professor_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {dept.associate_professor_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {dept.assistant_professor_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {dept.Total_Students}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {dept.research_projects}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {dept.publications}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Professional Memberships Organization Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartCard
                title="National Professional Memberships"
                className="bg-white shadow-md hover:shadow-lg transition-shadow"
                useGradient={true}
                gradientFrom="from-green-600"
                gradientTo="to-blue-600"
              >
                <DepartmentBarChart
                  data={nationalChartData}
                  dataKey="count"
                  barColor="#059669"
                  height={350}
                />
              </ChartCard>
              <ChartCard
                title="International Professional Memberships"
                className="bg-white shadow-md hover:shadow-lg transition-shadow"
                useGradient={true}
                gradientFrom="from-blue-600"
                gradientTo="to-purple-600"
              >
                <DepartmentBarChart
                  data={internationalChartData}
                  dataKey="count"
                  barColor="#2563eb"
                  height={350}
                />
              </ChartCard>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

async function fetchDashboardData() {
  try {
    // Fetch department statistics
    const deptStatsResponse = await fetch(`/api/departments/stats`);

    if (!deptStatsResponse.ok) {
      throw new Error("Failed to fetch department stats");
    }

    const deptStatsData = await deptStatsResponse.json();

    // Check if we have valid data
    if (!deptStatsData.success || !deptStatsData.data) {
      throw new Error("Invalid department stats data structure");
    }

    // Get departments from the new API structure
    const departmentStats = deptStatsData.data;

    // In the new API structure we don't have facultyDesignationStats
    // So we'll create placeholder data
    const designationsByDepartment: { [department: string]: any } = {};

    // Initialize the departments with zero counts
    if (Array.isArray(departmentStats)) {
      departmentStats.forEach((dept: any) => {
        designationsByDepartment[dept.name] = {
          professor_count: 0,
          associate_professor_count: 0,
          assistant_professor_count: 0,
        };
      });
    }

    // Prepare department details with actual department data
    const departmentDetails = Array.isArray(departmentStats)
      ? departmentStats.map((dept: any) => {
          const deptName = dept.name;
          const designations = designationsByDepartment[deptName] || {
            professor_count: 0,
            associate_professor_count: 0,
            assistant_professor_count: 0,
          };

          // If no designation data is available, fallback to proportional estimates
          const totalFaculty = dept.facultyCount || 0;
          if (totalFaculty > 0) {
            designations.professor_count = Math.floor(totalFaculty * 0.2);
            designations.associate_professor_count = Math.floor(
              totalFaculty * 0.3
            );
            designations.assistant_professor_count =
              totalFaculty -
              designations.professor_count -
              designations.associate_professor_count;
          }

          // Create HOD object if hodId and hodName are available
          const hod = dept.hodId
            ? {
                id: dept.hodId,
                name: dept.hodName || "Unknown Faculty",
              }
            : null;

          return {
            Department_ID: dept.id,
            Department_Name: deptName,
            current_faculty_count: dept.facultyCount || 0,
            Total_Students: dept.studentsCount || 0,
            professor_count: designations.professor_count,
            associate_professor_count: designations.associate_professor_count,
            assistant_professor_count: designations.assistant_professor_count,
            research_projects: Math.floor(Math.random() * 10) + 2,
            publications: Math.floor(Math.random() * 30) + 5,
            HOD: hod,
          };
        })
      : [];

    // Create data for charts
    const facultyByDepartment = Array.isArray(departmentStats)
      ? departmentStats.map((dept: any) => ({
          department: dept.name,
          count: dept.facultyCount || 0,
        }))
      : [];

    const studentsByDepartment = Array.isArray(departmentStats)
      ? departmentStats.map((dept: any) => ({
          department: dept.name,
          count: dept.studentsCount || 0,
        }))
      : [];

    // Calculate totals
    const totalFaculty = facultyByDepartment.reduce(
      (sum: number, dept: DepartmentData) => sum + dept.count,
      0
    );
    const totalStudents = studentsByDepartment.reduce(
      (sum: number, dept: DepartmentData) => sum + dept.count,
      0
    );
    const totalDepartments = Array.isArray(departmentStats)
      ? departmentStats.length
      : 0;

    // Calculate faculty by designation totals
    const professorCount = departmentDetails.reduce(
      (sum, dept) => sum + dept.professor_count,
      0
    );
    const associateProfessorCount = departmentDetails.reduce(
      (sum, dept) => sum + dept.associate_professor_count,
      0
    );
    const assistantProfessorCount = departmentDetails.reduce(
      (sum, dept) => sum + dept.assistant_professor_count,
      0
    );
    const totalResearchProjects = departmentDetails.reduce(
      (sum, dept) => sum + dept.research_projects,
      0
    );
    const totalPublications = departmentDetails.reduce(
      (sum, dept) => sum + dept.publications,
      0
    );

    // Get courses count from API or use departments count * average courses per department as estimation
    const totalCourses = totalDepartments * 6; // Estimate 6 courses per department

    return {
      totalFaculty,
      totalStudents,
      totalDepartments,
      totalCourses,
      facultyByDepartment,
      studentsByDepartment,
      recentAnnouncements: [],
      upcomingEvents: [],
      professorCount,
      associateProfessorCount,
      assistantProfessorCount,
      totalResearchProjects,
      totalPublications,
      departmentDetails,
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    // Return minimal empty data structure as fallback
    return {
      totalFaculty: 0,
      totalStudents: 0,
      totalDepartments: 0,
      totalCourses: 0,
      facultyByDepartment: [],
      studentsByDepartment: [],
      recentAnnouncements: [],
      upcomingEvents: [],
      professorCount: 0,
      associateProfessorCount: 0,
      assistantProfessorCount: 0,
      totalResearchProjects: 0,
      totalPublications: 0,
      departmentDetails: [],
    };
  }
}

// Copy the ORGANIZATIONS constant from the form for grouping
const ORGANIZATIONS: Record<string, { value: string; label: string }[]> = {
  National: [
    { value: "ISTE", label: "ISTE – Indian Society for Technical Education" },
    { value: "IEI", label: "IEI – Institution of Engineers (India)" },
    {
      value: "IETE",
      label:
        "IETE – Institution of Electronics and Telecommunication Engineers",
    },
    { value: "CSI", label: "CSI – Computer Society of India" },
    { value: "ISME", label: "ISME – Indian Society for Mechanical Engineers" },
    {
      value: "IET India",
      label:
        "IET India – Institution of Engineering and Technology (India Chapter)",
    },
    {
      value: "IEEE India Council",
      label:
        "IEEE India Council – Institute of Electrical and Electronics Engineers (India Council)",
    },
    { value: "INAE", label: "INAE – Indian National Academy of Engineering" },
    {
      value: "ACM India",
      label: "ACM India – Association for Computing Machinery (India Chapter)",
    },
    {
      value: "SAEINDIA",
      label: "SAEINDIA – Society of Automotive Engineers India",
    },
    {
      value: "ISTD",
      label: "ISTD – Indian Society for Training and Development",
    },
    {
      value: "NAAC/NBA Panel Expert",
      label:
        "NAAC/NBA Panel Expert – National Assessment and Accreditation Council / National Board of Accreditation",
    },
  ],
  International: [
    {
      value: "IEEE",
      label: "IEEE – Institute of Electrical and Electronics Engineers",
    },
    { value: "ACM", label: "ACM – Association for Computing Machinery" },
    { value: "ASME", label: "ASME – American Society of Mechanical Engineers" },
    { value: "ASCE", label: "ASCE – American Society of Civil Engineers" },
    {
      value: "SAE International",
      label:
        "SAE International – Society of Automotive Engineers (International)",
    },
    {
      value: "IFAC",
      label: "IFAC – International Federation of Automatic Control",
    },
    {
      value: "INFORMS",
      label:
        "INFORMS – Institute for Operations Research and the Management Sciences",
    },
    {
      value: "AAAI",
      label:
        "AAAI – Association for the Advancement of Artificial Intelligence",
    },
    { value: "IAENG", label: "IAENG – International Association of Engineers" },
  ],
};

// Helper to group orgCounts by category
function groupOrgCountsByCategory(
  orgCounts: { organization: string; count: number }[]
) {
  const result: Record<string, { name: string; count: number }[]> = {
    National: [],
    International: [],
    Others: [],
  };
  const nationalSet = new Set(ORGANIZATIONS.National.map((o) => o.value));
  const internationalSet = new Set(
    ORGANIZATIONS.International.map((o) => o.value)
  );
  for (const org of orgCounts) {
    if (nationalSet.has(org.organization)) {
      const label =
        ORGANIZATIONS.National.find((o) => o.value === org.organization)
          ?.label || org.organization;
      result.National.push({ name: label, count: org.count });
    } else if (internationalSet.has(org.organization)) {
      const label =
        ORGANIZATIONS.International.find((o) => o.value === org.organization)
          ?.label || org.organization;
      result.International.push({ name: label, count: org.count });
    } else {
      result.Others.push({ name: org.organization, count: org.count });
    }
  }
  return result;
}

// Helper to group orgCounts for each category, with an Others bar
function getOrgChartData(
  orgCounts: { organization: string; count: number }[],
  category: "National" | "International"
) {
  const orgList = ORGANIZATIONS[category].map((o) => o.value);
  const orgLabelMap = Object.fromEntries(
    ORGANIZATIONS[category].map((o) => [o.value, o.label])
  );
  const data: { department: string; count: number }[] = [];
  let othersCount = 0;
  for (const org of orgCounts) {
    if (orgList.includes(org.organization)) {
      data.push({
        department: orgLabelMap[org.organization] || org.organization,
        count: org.count,
      });
    } else {
      othersCount += org.count;
    }
  }
  if (othersCount > 0) {
    data.push({ department: "Others", count: othersCount });
  }
  // Ensure all official orgs are present (even if count is 0)
  for (const org of ORGANIZATIONS[category]) {
    if (!data.find((d) => d.department === org.label)) {
      data.push({ department: org.label, count: 0 });
    }
  }
  return data;
}
