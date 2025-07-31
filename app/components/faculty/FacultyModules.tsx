"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/app/providers/auth-provider";
import {
  BookOpen,
  Award,
  FileText,
  Users,
  Briefcase,
  GraduationCap,
  ArrowRight,
  BookMarked,
  Globe,
  Target,
  FileBarChart,
  Download,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDepartmentStyle } from "@/app/lib/theme";
import { Skeleton } from "@/components/ui/skeleton";

interface FacultyInfo {
  F_id: number;
  F_name: string;
  F_dept: string;
  Email: string;
  Current_Designation: string;
  total_contributions: number;
  professional_memberships: number;
  publications?: number;
  research_projects?: number;
  workshops_attended?: number;
  awards?: number;
}

interface FacultyModulesProps {
  facultyId?: number;
}

export default function FacultyModules({ facultyId }: FacultyModulesProps) {
  const [facultyInfo, setFacultyInfo] = useState<FacultyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const { user } = useAuth();
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const fetchFacultyInfo = async () => {
      try {
        setLoading(true);

        // If facultyId is provided, fetch that specific faculty member's information
        // Otherwise fetch the current logged-in faculty member's information
        const endpoint = facultyId
          ? `/api/faculty/${facultyId}`
          : "/api/faculty/me";

        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error("Failed to fetch faculty information");
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(
            data.message || "Failed to fetch faculty information"
          );
        }

        // Use actual data from the database, set defaults for missing values
        const facultyData = {
          ...data.data,
          publications: data.data.publications || 0,
          research_projects: data.data.research_projects || 0,
          workshops_attended: data.data.workshops_attended || 0,
          awards: data.data.awards || 0,
          total_contributions: data.data.total_contributions || 0,
          professional_memberships: data.data.professional_memberships || 0,
        };

        setFacultyInfo(facultyData);
        setError(null);
      } catch (err) {
        console.error("Error fetching faculty info:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchFacultyInfo();
  }, [facultyId]);

  // Function to generate reports for specific module types
  const generateModuleReport = async (moduleType: string) => {
    if (
      !user ||
      (user.role !== "department" &&
        user.role !== "hod" &&
        user.role !== "faculty")
    ) {
      return;
    }

    // Ensure we have faculty info before generating report
    if (!facultyInfo?.F_id) {
      alert("Faculty information not available. Please try again.");
      return;
    }

    try {
      setGeneratingReport(moduleType);

      const reportConfig = {
        reportType: moduleType,
        departmentId: "", // Empty for individual faculty reports
        format: "pdf",
        facultyId: facultyInfo?.F_id?.toString(), // Use the actual faculty ID from the fetched info
        isIndividualReport: true, // Flag to indicate this is for individual faculty
      };

      console.log("Generating report for:", {
        facultyName: facultyInfo?.F_name,
        facultyId: facultyInfo?.F_id,
        moduleType,
        reportConfig,
      });

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate ${moduleType} report`);
      }

      // Get the JSON response with base64 PDF data (same as dashboard reports)
      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.message || `Failed to generate ${moduleType} report`
        );
      }

      // Convert base64 to blob and download (same as dashboard approach)
      const byteCharacters = atob(result.data.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        result.data.filename ||
        `${facultyInfo?.F_name?.replace(/\s+/g, "_")}_${moduleType}_report_${
          new Date().toISOString().split("T")[0]
        }.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(`Error generating ${moduleType} report:`, error);
      alert(`Failed to generate ${moduleType} report. Please try again.`);
    } finally {
      setGeneratingReport(null);
    }
  };

  // Helper function to check if user can generate reports
  const canGenerateReports = () => {
    return (
      user &&
      (user.role === "department" ||
        user.role === "hod" ||
        user.role === "faculty")
    );
  };

  const handleDownloadReport = async () => {
    try {
      setReportLoading(true);
      const response = await fetch("/api/faculty/comprehensive-report");

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to generate report");
      }

      // Convert base64 to blob
      const pdfBlob = base64ToBlob(data.data.pdfBase64, "application/pdf");

      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.data.filename || "faculty-report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading report:", err);
      alert(err instanceof Error ? err.message : "Failed to download report");
    } finally {
      setReportLoading(false);
    }
  };

  // Helper function to convert base64 to blob
  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);

      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mimeType });
  };

  if (loading) {
    return <FacultyModulesSkeleton />;
  }

  if (error || !facultyInfo) {
    return (
      <div className="bg-red-50 text-red-500 p-6 rounded-md">
        <p className="font-medium">Error loading faculty information</p>
        <p className="text-sm mt-1">
          {error || "Faculty information not available"}
        </p>
      </div>
    );
  }

  const departmentStyle = getDepartmentStyle(facultyInfo.F_dept);

  return (
    <div className="space-y-6">
      {/* Faculty info header */}
      <Card className="overflow-hidden">
        <div
          className="h-2"
          style={{ backgroundColor: departmentStyle.primary }}
        />
        <CardHeader>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-semibold"
              style={{ backgroundColor: departmentStyle.primary }}
            >
              {facultyInfo.F_name.charAt(0)}
            </div>
            <div>
              <CardTitle className="text-2xl">{facultyInfo.F_name}</CardTitle>
              <CardDescription>
                {facultyInfo.Current_Designation} | {facultyInfo.F_dept}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Welcome to your faculty dashboard. Here you can manage all your
            academic records including publications, research projects, and
            more.
          </p>
        </CardContent>
      </Card>

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Publications Module */}
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <div
            className="h-1"
            style={{ backgroundColor: departmentStyle.primary }}
          />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Publications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{facultyInfo.publications}</p>
            <p className="text-sm text-gray-500 mt-1">
              Research papers and articles published
            </p>
          </CardContent>
          <CardFooter className={canGenerateReports() ? "space-y-2" : ""}>
            <Link href={`/faculty/publications`} className="w-full">
              <Button
                variant="outline"
                className="w-full flex justify-between items-center"
              >
                Manage Publications
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {canGenerateReports() && (
              <Button
                variant="default"
                className="w-full flex justify-between items-center"
                onClick={() => generateModuleReport("publications")}
                disabled={generatingReport === "publications"}
              >
                {generatingReport === "publications" ? (
                  <>
                    Generating...
                    <Download className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Generate Report
                    <Download className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Research Projects */}
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1" style={{ backgroundColor: "#16a34a" }} />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Research Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {facultyInfo.research_projects}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Ongoing and completed research projects
            </p>
          </CardContent>
          <CardFooter className={canGenerateReports() ? "space-y-2" : ""}>
            <Link href={`/faculty/research-projects`} className="w-full">
              <Button
                variant="outline"
                className="w-full flex justify-between items-center"
              >
                Manage Projects
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {canGenerateReports() && (
              <Button
                variant="default"
                className="w-full flex justify-between items-center"
                onClick={() => generateModuleReport("research-projects")}
                disabled={generatingReport === "research-projects"}
              >
                {generatingReport === "research-projects" ? (
                  <>
                    Generating...
                    <Download className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Generate Report
                    <Download className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Contributions */}
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1" style={{ backgroundColor: "#7c3aed" }} />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Contributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {facultyInfo.total_contributions}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Academic contributions across categories
            </p>
          </CardContent>
          <CardFooter className={canGenerateReports() ? "space-y-2" : ""}>
            <Link href={`/faculty/contributions`} className="w-full">
              <Button
                variant="outline"
                className="w-full flex justify-between items-center"
              >
                Manage Contributions
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {canGenerateReports() && (
              <Button
                variant="default"
                className="w-full flex justify-between items-center"
                onClick={() => generateModuleReport("contributions")}
                disabled={generatingReport === "contributions"}
              >
                {generatingReport === "contributions" ? (
                  <>
                    Generating...
                    <Download className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Generate Report
                    <Download className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Workshops & Conferences */}
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1" style={{ backgroundColor: "#f59e0b" }} />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              Workshops & Conferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {facultyInfo.workshops_attended}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Events attended or organized
            </p>
          </CardContent>
          <CardFooter className={canGenerateReports() ? "space-y-2" : ""}>
            <Link href={`/faculty/workshops`} className="w-full">
              <Button
                variant="outline"
                className="w-full flex justify-between items-center"
              >
                Manage Events
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {canGenerateReports() && (
              <Button
                variant="default"
                className="w-full flex justify-between items-center"
                onClick={() => generateModuleReport("workshops")}
                disabled={generatingReport === "workshops"}
              >
                {generatingReport === "workshops" ? (
                  <>
                    Generating...
                    <Download className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Generate Report
                    <Download className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Professional Memberships */}
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1" style={{ backgroundColor: "#dc2626" }} />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-red-600" />
              Professional Memberships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {facultyInfo.professional_memberships}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Organizations and society memberships
            </p>
          </CardContent>
          <CardFooter className={canGenerateReports() ? "space-y-2" : ""}>
            <Link href={`/faculty/memberships`} className="w-full">
              <Button
                variant="outline"
                className="w-full flex justify-between items-center"
              >
                Manage Memberships
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {canGenerateReports() && (
              <Button
                variant="default"
                className="w-full flex justify-between items-center"
                onClick={() => generateModuleReport("memberships")}
                disabled={generatingReport === "memberships"}
              >
                {generatingReport === "memberships" ? (
                  <>
                    Generating...
                    <Download className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Generate Report
                    <Download className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Awards & Recognitions */}
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-1" style={{ backgroundColor: "#0ea5e9" }} />
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-sky-600" />
              Awards & Recognitions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{facultyInfo.awards}</p>
            <p className="text-sm text-gray-500 mt-1">
              Honors and recognitions received
            </p>
          </CardContent>
          <CardFooter className={canGenerateReports() ? "space-y-2" : ""}>
            <Link href={`/faculty/awards`} className="w-full">
              <Button
                variant="outline"
                className="w-full flex justify-between items-center"
              >
                Manage Awards
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {canGenerateReports() && (
              <Button
                variant="default"
                className="w-full flex justify-between items-center"
                onClick={() => generateModuleReport("awards")}
                disabled={generatingReport === "awards"}
              >
                {generatingReport === "awards" ? (
                  <>
                    Generating...
                    <Download className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Generate Report
                    <Download className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Information Management System Footer */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Information Management System | Faculty Portal
        </p>
      </div>
    </div>
  );
}

function FacultyModulesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Faculty info header skeleton */}
      <Card className="overflow-hidden">
        <div className="h-2 bg-gray-200" />
        <CardHeader>
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-2" />
        </CardContent>
      </Card>

      {/* Module Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-1 bg-gray-200" />
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Footer Skeleton */}
      <div className="mt-8 text-center">
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
    </div>
  );
}
