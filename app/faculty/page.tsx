"use client";

import { useEffect, useState } from "react";
import MainLayout from "@/app/components/layout/MainLayout";
import { FacultyCard } from "@/app/components/FacultyCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import FacultyModules from "@/app/components/faculty/FacultyModules";

interface Faculty {
  F_id: number;
  F_name: string;
  F_dept: string;
  Email: string;
  Phone_Number: string;
  Current_Designation: string;
  Highest_Degree: string;
  Experience: number;
  total_contributions: number;
  professional_memberships: number;
}

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [filteredFaculty, setFilteredFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string>("");
  const [designation, setDesignation] = useState<string>("");
  const [experienceFilter, setExperienceFilter] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [facultyId, setFacultyId] = useState<number | null>(null);

  useEffect(() => {
    // First, check user's role from the authentication API
    const fetchUserRoleAndDepartment = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/auth/me");

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setUserRole(data.user.role);
            setUserDepartment(data.user.department);

            // For faculty members, we'll need their faculty ID for the modules view
            if (data.user.role === "faculty") {
              const facultyResponse = await fetch("/api/faculty/me");
              if (facultyResponse.ok) {
                const facultyData = await facultyResponse.json();
                if (facultyData.success && facultyData.data) {
                  setFacultyId(facultyData.data.F_id);
                }
              }
            } else {
              // For non-faculty roles, fetch the faculty directory data
              await fetchFacultyData();
            }

            // For HODs, automatically filter to their department
            if (data.user.role === "hod" && data.user.department) {
              setDepartment(data.user.department);
            }
            // For department users, automatically filter to their department
            if (data.user.role === "department" && data.user.department) {
              setDepartment(data.user.department);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setError("Error loading user information");
      } finally {
        setLoading(false);
      }
    };

    fetchUserRoleAndDepartment();
  }, []); // Empty dependency array to run only once on mount

  // Separate function to fetch faculty data with proper error handling
  const fetchFacultyData = async () => {
    try {
      setLoading(true);

      // Add a cache-busting parameter to prevent browser caching
      let url = `/api/faculty?t=${Date.now()}`;
      if (userRole === "department" && userDepartment) {
        url += `&department=${encodeURIComponent(userDepartment)}`;
      }
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch faculty data");
      }

      if (!Array.isArray(data.data)) {
        throw new Error("Invalid faculty data format");
      }

      setFaculty(data.data);
      setFilteredFaculty(data.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching faculty:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch faculty data"
      );
    } finally {
      setLoading(false);
    }
  };

  // Sorting and filtering logic
  const [sortOrder, setSortOrder] = useState("name");

  useEffect(() => {
    if (faculty.length === 0) return;

    let result = [...faculty];

    // Filter by department
    if (department && department !== "all") {
      result = result.filter((f) => f.F_dept === department);
    }
    // For department users, always filter to their department
    if (userRole === "department" && userDepartment) {
      result = result.filter((f) => f.F_dept === userDepartment);
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.F_name.toLowerCase().includes(searchLower) ||
          f.Email.toLowerCase().includes(searchLower) ||
          f.Current_Designation.toLowerCase().includes(searchLower)
      );
    }

    // Filter by designation
    if (designation && designation !== "all") {
      result = result.filter((f) => f.Current_Designation === designation);
    }

    // Filter by experience
    if (experienceFilter && experienceFilter !== "all") {
      if (experienceFilter === "0-5") {
        result = result.filter((f) => f.Experience >= 0 && f.Experience <= 5);
      } else if (experienceFilter === "6-10") {
        result = result.filter((f) => f.Experience >= 6 && f.Experience <= 10);
      } else if (experienceFilter === "11-15") {
        result = result.filter((f) => f.Experience >= 11 && f.Experience <= 15);
      } else if (experienceFilter === "15+") {
        result = result.filter((f) => f.Experience > 15);
      }
    }

    // Sorting
    if (sortOrder === "name") {
      result.sort((a, b) => a.F_name.localeCompare(b.F_name));
    } else if (sortOrder === "experience-desc") {
      result.sort((a, b) => (b.Experience || 0) - (a.Experience || 0));
    } else if (sortOrder === "experience-asc") {
      result.sort((a, b) => (a.Experience || 0) - (b.Experience || 0));
    }

    setFilteredFaculty(result);
  }, [faculty, search, department, designation, experienceFilter, sortOrder]);

  // Get unique departments from faculty data
  const departments = Array.from(new Set(faculty.map((f) => f.F_dept))).sort();

  // Get unique designations from faculty data
  const designations = Array.from(
    new Set(faculty.map((f) => f.Current_Designation))
  ).sort();

  // Check if any filters are active
  const hasActiveFilters =
    (department !== "" && department !== "all") ||
    search !== "" ||
    (designation !== "" && designation !== "all") ||
    (experienceFilter !== "" && experienceFilter !== "all");

  // Check if user has permission to add/edit faculty
  const canManageFaculty =
    userRole === "admin" || userRole === "hod" || userRole === "department";

  // If the user is a faculty member or HOD, show the faculty modules view
  if (userRole === "faculty" || userRole === "hod") {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Faculty Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your academic profile, publications, and contributions
            </p>
          </div>

          <FacultyModules />
        </div>
      </MainLayout>
    );
  }

  // For admin and HOD roles, show the faculty directory
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Faculty Directory
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Browse and search faculty members
              {userRole === "hod"
                ? " in your department"
                : " across all departments"}
            </p>
          </div>
          {canManageFaculty && (
            <Link href="/faculty/add">
              <Button className="flex items-center gap-2 shrink-0">
                <Plus className="w-4 h-4" />
                Add Faculty
              </Button>
            </Link>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by name, email, or designation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full"
            />
          </div>
        </div>

        {/* Active filters display */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
          <span className="text-sm text-gray-500 mt-1">Active filters:</span>

          {search && (
            <Badge variant="outline" className="flex items-center gap-1">
              Search:{" "}
              {search.length > 15 ? search.slice(0, 15) + "..." : search}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => setSearch("")}
              />
            </Badge>
          )}

          {department && department !== "all" && (
            <Badge variant="outline" className="flex items-center gap-1">
              Department: {department}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => setDepartment("")}
              />
            </Badge>
          )}

          {designation && designation !== "all" && (
            <Badge variant="outline" className="flex items-center gap-1">
              Designation: {designation}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => setDesignation("all")}
              />
            </Badge>
          )}

          {experienceFilter && experienceFilter !== "all" && (
            <Badge variant="outline" className="flex items-center gap-1">
              Experience:{" "}
              {experienceFilter === "15+"
                ? "15+ years"
                : `${experienceFilter} years`}
              <X
                className="h-3 w-3 ml-1 cursor-pointer"
                onClick={() => setExperienceFilter("all")}
              />
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-xs"
            onClick={() => {
              setSearch("");
              setDepartment("all");
              setDesignation("all");
              setExperienceFilter("all");
            }}
          >
            Clear All
          </Button>
        </div>

        {/* Faculty list with department color indicators */}
        <div className="min-h-[300px]">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="h-2 bg-gray-200" />
                  <div className="p-6 space-y-4">
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[200px]" />
                        <Skeleton className="h-4 w-[150px]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-500 p-6 rounded-md">
              <p className="font-medium">Error loading faculty data</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          ) : filteredFaculty.length === 0 ? (
            <div className="text-center py-12 border rounded-md">
              <p className="text-gray-500 font-medium">
                No faculty members found
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your filters
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setDepartment("");
                  setDesignation("");
                  setExperienceFilter("");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">
                  Showing {filteredFaculty.length} of {faculty.length} faculty
                  members
                </p>

                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort by Name</SelectItem>
                    {(userRole === "admin" || userRole === "hod") && (
                      <SelectItem value="department">
                        Sort by Department
                      </SelectItem>
                    )}
                    <SelectItem value="experience-desc">
                      Experience (High to Low)
                    </SelectItem>
                    <SelectItem value="experience-asc">
                      Experience (Low to High)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFaculty.map((member) => (
                  <FacultyCard
                    key={member.F_id}
                    faculty={member}
                    showEditButton={
                      canManageFaculty &&
                      (userRole === "admin" ||
                        (userRole === "hod" &&
                          userDepartment === member.F_dept) ||
                        (userRole === "department" &&
                          userDepartment === member.F_dept))
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
