import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const departmentId = parseInt(id);

    if (isNaN(departmentId)) {
      return NextResponse.json(
        { success: false, message: "Invalid department ID" },
        { status: 400 }
      );
    }

    // Get department name
    const departmentData = await query(
      "SELECT Department_Name FROM department WHERE Department_ID = ?",
      [departmentId]
    );

    if (!departmentData || (departmentData as any[]).length === 0) {
      return NextResponse.json(
        { success: false, message: "Department not found" },
        { status: 404 }
      );
    }

    const departmentName = (departmentData as any[])[0].Department_Name;

    // Get faculty count and designation breakdown
    const facultyStats = (await query(
      `
      SELECT 
        fd.Current_Designation as designation,
        COUNT(*) as count
      FROM faculty f
      JOIN faculty_details fd ON f.F_id = fd.F_ID
      WHERE f.F_dept = ?
      GROUP BY fd.Current_Designation
      ORDER BY count DESC
    `,
      [departmentName]
    )) as any[];

    const totalFaculty = facultyStats.reduce(
      (sum, stat) => sum + stat.count,
      0
    );

    // Get publications count and yearly breakdown
    const publicationsStats = (await query(
      `
      SELECT 
        YEAR(fp.publication_date) as year,
        COUNT(*) as count
      FROM faculty_publications fp
      JOIN faculty f ON fp.faculty_id = f.F_id
      WHERE f.F_dept = ?
      AND fp.publication_date >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)
      GROUP BY YEAR(fp.publication_date)
      ORDER BY year DESC
    `,
      [departmentName]
    )) as any[];

    const totalPublications = publicationsStats.reduce(
      (sum, stat) => sum + stat.count,
      0
    );

    // Get research projects count
    const researchProjectsResult = (await query(
      `
      SELECT COUNT(*) as count
      FROM research_project_consultancies rpc
      WHERE rpc.Branch = ?
    `,
      [departmentName]
    )) as any[];

    const totalResearchProjects = researchProjectsResult[0]?.count || 0;

    // Get awards count
    const awardsResult = (await query(
      `
      SELECT COUNT(*) as count
      FROM faculty_awards fa
      JOIN faculty f ON fa.faculty_id = f.F_id
      WHERE f.F_dept = ?
    `,
      [departmentName]
    )) as any[];

    const totalAwards = awardsResult[0]?.count || 0;

    // Get workshops count
    const workshopsResult = (await query(
      `
      SELECT COUNT(*) as count
      FROM faculty_workshops fw
      JOIN faculty f ON fw.faculty_id = f.F_id
      WHERE f.F_dept = ?
    `,
      [departmentName]
    )) as any[];

    const totalWorkshops = workshopsResult[0]?.count || 0;

    // Estimate student count (you may need to adjust this based on your student table structure)
    const totalStudents = totalFaculty * 30; // Rough estimate: 30 students per faculty

    // Prepare response data
    const stats = {
      departmentName,
      totalFaculty,
      totalStudents,
      totalPublications,
      totalResearchProjects,
      totalAwards,
      totalWorkshops,
      facultyByDesignation: facultyStats.map((stat: any) => ({
        designation: stat.designation || "Not Specified",
        count: stat.count,
      })),
      publicationsByYear: publicationsStats.map((stat: any) => ({
        year: stat.year?.toString() || "Unknown",
        count: stat.count,
      })),
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching department statistics:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch department statistics" },
      { status: 500 }
    );
  }
}
