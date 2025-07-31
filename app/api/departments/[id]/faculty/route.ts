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

    // Get department name first
    const departmentData = (await query(
      "SELECT Department_Name FROM department WHERE Department_ID = ?",
      [departmentId]
    )) as any[];

    if (!departmentData || departmentData.length === 0) {
      return NextResponse.json(
        { success: false, message: "Department not found" },
        { status: 404 }
      );
    }

    const departmentName = departmentData[0].Department_Name;

    // Get faculty with detailed information
    const facultyData = (await query(
      `
      SELECT 
        f.F_id,
        f.F_name,
        f.F_dept,
        fd.Email,
        fd.Current_Designation,
        fd.Experience,
        fd.Highest_Degree,
        fd.Date_of_Joining,
        (SELECT COUNT(*) FROM faculty_publications fp WHERE fp.faculty_id = f.F_id) as publicationCount,
        (SELECT COUNT(*) FROM faculty_awards fa WHERE fa.faculty_id = f.F_id) as awardCount,
        (SELECT COUNT(*) FROM faculty_workshops fw WHERE fw.faculty_id = f.F_id) as workshopCount,
        (SELECT COUNT(*) FROM faculty_memberships fm WHERE fm.faculty_id = f.F_id) as membershipCount,
        (SELECT COUNT(*) FROM faculty_contributions fc WHERE fc.F_ID = f.F_id) as contributionCount
      FROM faculty f
      LEFT JOIN faculty_details fd ON f.F_id = fd.F_ID
      WHERE f.F_dept = ?
      ORDER BY f.F_name
    `,
      [departmentName]
    )) as any[];

    // Transform the data to include research project count
    const facultyWithResearch = await Promise.all(
      facultyData.map(async (faculty) => {
        try {
          // Get research project count (this might need adjustment based on your schema)
          const researchProjects = (await query(
            `
            SELECT COUNT(*) as count
            FROM research_project_consultancies rpc
            WHERE rpc.Name_Of_Principal_Investigator_CoInvestigator LIKE ?
          `,
            [`%${faculty.F_name}%`]
          )) as any[];

          return {
            ...faculty,
            researchProjectCount: researchProjects[0]?.count || 0,
          };
        } catch (error) {
          console.error(
            `Error fetching research projects for ${faculty.F_name}:`,
            error
          );
          return {
            ...faculty,
            researchProjectCount: 0,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: facultyWithResearch,
      departmentName,
    });
  } catch (error) {
    console.error("Error fetching department faculty:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch faculty data" },
      { status: 500 }
    );
  }
}
