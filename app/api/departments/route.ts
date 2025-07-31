import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import { OkPacket } from "mysql2";
import * as jose from "jose";

// Use environment variable for JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

export async function GET(request: NextRequest) {
  const diagnosticMode = request.url.includes("diagnostic=true");
  const diagnosticInfo: Record<string, any> = {};

  // Get user info using custom JWT authentication
  let user: any = null;
  try {
    const sessionToken = request.cookies.get("session_token")?.value;
    if (sessionToken && JWT_SECRET) {
      const encoder = new TextEncoder();
      const secretKey = encoder.encode(JWT_SECRET);
      const { payload } = await jose.jwtVerify(sessionToken, secretKey);

      // Get user details from database
      const users = (await query(
        "SELECT id, username, email, role, name, department_id FROM users WHERE id = ?",
        [payload.userId as number]
      )) as any[];

      if (users && users.length > 0) {
        user = users[0];
      }
    }
  } catch (error) {
    console.log("[DEPT API] Session verification failed:", error);
  }

  console.log("[DEPT API] Session user:", user);

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    // Step 1: Verify department table exists
    try {
      const tableCheck = await query("SHOW TABLES LIKE 'department'");
      diagnosticInfo.tableCheck = {
        department: (tableCheck as any[]).length > 0,
      };

      if ((tableCheck as any[]).length === 0) {
        throw new Error("Department table does not exist");
      }
    } catch (error) {
      console.error("Department table check error:", error);
      return NextResponse.json(
        {
          success: false,
          message: "Department table not found or inaccessible",
          error: error instanceof Error ? error.message : "Unknown error",
          diagnostic: diagnosticInfo,
        },
        { status: 500 }
      );
    }

    // Step 2: Build the query with proper error handling for joins
    let sql = `
      SELECT 
        d.Department_ID,
        d.Department_Name
    `;

    // Check if department_details table exists before adding its columns
    let hasDetailsTable = false;
    try {
      const detailsCheck = await query("SHOW TABLES LIKE 'department_details'");
      hasDetailsTable = (detailsCheck as any[]).length > 0;

      diagnosticInfo.tableCheck = {
        ...diagnosticInfo.tableCheck,
        department_details: hasDetailsTable,
      };

      if (hasDetailsTable) {
        // Get the actual column names to avoid errors
        const detailsColumns = await query(
          "SHOW COLUMNS FROM department_details"
        );
        const columnNames = (detailsColumns as any[]).map((col) => col.Field);

        // Only include columns that actually exist
        const establishmentYearCol = columnNames.includes("Establishment_Year")
          ? "dd.Establishment_Year"
          : "NULL as Establishment_Year";
        const departmentCodeCol = columnNames.includes("Department_Code")
          ? "dd.Department_Code"
          : "NULL as Department_Code";
        const emailCol = columnNames.includes("Email_ID")
          ? "dd.Email_ID"
          : "NULL as Email_ID";
        const phoneCol = columnNames.includes("Department_Phone_Number")
          ? "dd.Department_Phone_Number"
          : "NULL as Department_Phone_Number";
        const hodIdCol = columnNames.includes("HOD_ID")
          ? "dd.HOD_ID"
          : "NULL as HOD_ID";
        const totalFacultyCol = columnNames.includes("Total_Faculty")
          ? "dd.Total_Faculty"
          : "NULL as Total_Faculty";
        const totalStudentsCol = columnNames.includes("Total_Students")
          ? "dd.Total_Students"
          : "NULL as Total_Students";
        const visionCol = columnNames.includes("Vision")
          ? "dd.Vision"
          : "NULL as Vision";
        const missionCol = columnNames.includes("Mission")
          ? "dd.Mission"
          : "NULL as Mission";
        const websiteUrlCol = columnNames.includes("Website_URL")
          ? "dd.Website_URL"
          : "NULL as Website_URL";
        const notableAchievementsCol = columnNames.includes(
          "Notable_Achievements"
        )
          ? "dd.Notable_Achievements"
          : "NULL as Notable_Achievements";
        const industryCollaborationCol = columnNames.includes(
          "Industry_Collaboration"
        )
          ? "dd.Industry_Collaboration"
          : "NULL as Industry_Collaboration";
        const researchFocusAreaCol = columnNames.includes("Research_Focus_Area")
          ? "dd.Research_Focus_Area"
          : "NULL as Research_Focus_Area";

        sql += `,
          ${establishmentYearCol},
          ${departmentCodeCol},
          ${emailCol},
          ${phoneCol},
          ${hodIdCol},
          ${totalFacultyCol},
          ${totalStudentsCol},
          ${visionCol},
          ${missionCol},
          ${websiteUrlCol},
          ${notableAchievementsCol},
          ${industryCollaborationCol},
          ${researchFocusAreaCol}`;
      } else {
        // Add placeholder columns if table doesn't exist
        sql += `,
          NULL as Establishment_Year,
          NULL as Department_Code,
          NULL as Email_ID,
          NULL as Department_Phone_Number,
          NULL as HOD_ID,
          NULL as Total_Faculty,
          NULL as Total_Students,
          NULL as Vision,
          NULL as Mission,
          NULL as Website_URL,
          NULL as Notable_Achievements,
          NULL as Industry_Collaboration,
          NULL as Research_Focus_Area`;
      }
    } catch (error) {
      console.error("Department details check error:", error);
      // Continue with placeholders for these columns
      sql += `,
        NULL as Establishment_Year,
        NULL as Department_Code,
        NULL as Email_ID,
        NULL as Department_Phone_Number,
        NULL as HOD_ID,
        NULL as Total_Faculty,
        NULL as Total_Students,
        NULL as Vision,
        NULL as Mission,
        NULL as Website_URL,
        NULL as Notable_Achievements,
        NULL as Industry_Collaboration,
        NULL as Research_Focus_Area`;
    }

    // Main table
    sql += ` FROM department d`;

    // Add LEFT JOINs conditionally
    let hasDetailsJoin = false;
    try {
      const detailsCheck = await query("SHOW TABLES LIKE 'department_details'");
      if ((detailsCheck as any[]).length > 0) {
        sql += ` LEFT JOIN department_details dd ON d.Department_ID = dd.Department_ID`;
        hasDetailsJoin = true;
      }
    } catch (error) {
      console.error("Error checking department_details for JOIN:", error);
      // Skip the join if there's an error
    }

    // Add faculty HOD join conditionally to get HOD name
    let hasHodJoin = false;
    sql += ` LEFT JOIN faculty f ON `;

    if (hasDetailsJoin) {
      sql += `dd.HOD_ID = f.F_id`;
      hasHodJoin = true;
    } else {
      sql += `1=0`; // This will never match but prevents SQL errors
    }

    const params: (string | number | boolean | null)[] = [];
    const conditions = [];

    if (search) {
      conditions.push("d.Department_Name LIKE ?");
      params.push(`%${search}%`);
    }

    // Restrict department users to only their own department
    if (user && user.role === "department" && user.departmentId) {
      conditions.push("d.Department_ID = ?");
      params.push(user.departmentId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    // Ensure the GROUP BY only includes columns that exist in the query
    sql += " GROUP BY d.Department_ID, d.Department_Name";

    // Add additional GROUP BY columns if we know they exist
    if (hasDetailsJoin) {
      sql +=
        ", dd.Establishment_Year, dd.Department_Code, dd.Email_ID, dd.Department_Phone_Number, dd.HOD_ID, dd.Total_Faculty, dd.Total_Students, dd.Vision, dd.Mission, dd.Website_URL, dd.Notable_Achievements, dd.Industry_Collaboration, dd.Research_Focus_Area";
    }

    // Execute the query
    diagnosticInfo.sql = sql;
    diagnosticInfo.params = params;

    const departments = await query(sql, params);
    diagnosticInfo.querySuccess = true;
    diagnosticInfo.resultCount = (departments as any[]).length;

    // Add HOD names to the result if available
    const result = await Promise.all(
      (departments as any[]).map(async (dept) => {
        // Try to get faculty information for HOD if it exists
        let hodInfo = null;
        if (dept.HOD_ID) {
          try {
            const facultyQuery = await query(
              "SELECT F_id, F_name FROM faculty WHERE F_id = ?",
              [dept.HOD_ID]
            );
            if ((facultyQuery as any[]).length > 0) {
              const faculty = (facultyQuery as any[])[0];
              hodInfo = {
                id: faculty.F_id,
                name: faculty.F_name,
              };
            } else {
              hodInfo = {
                id: dept.HOD_ID,
                name: "Unknown Faculty",
              };
            }
          } catch (error) {
            console.error("Error processing HOD information:", error);
            hodInfo = {
              id: dept.HOD_ID,
              name: "Unknown Faculty",
            };
          }
        }

        return {
          ...dept,
          HOD: hodInfo,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: result,
      diagnostic: diagnosticMode ? diagnosticInfo : undefined,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error fetching department data",
        error: error instanceof Error ? error.message : "Unknown error",
        diagnostic: diagnosticInfo,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { Department_Name } = body;

    if (!Department_Name) {
      return NextResponse.json(
        {
          success: false,
          message: "Department name is required",
        },
        { status: 400 }
      );
    }

    try {
      // Insert into department table
      const result = (await query(
        `
        INSERT INTO department (Department_Name)
        VALUES (?)
      `,
        [Department_Name]
      )) as OkPacket;

      return NextResponse.json({
        success: true,
        Department_ID: result.insertId,
        message: "Department added successfully",
      });
    } catch (insertError) {
      // If the error is related to auto_increment not set up, try to fix it
      if (
        insertError instanceof Error &&
        insertError.message.includes("ER_NO_DEFAULT_FOR_FIELD") &&
        insertError.message.includes("Department_ID")
      ) {
        // First alter the table to add AUTO_INCREMENT to Department_ID
        await query(
          "ALTER TABLE department MODIFY Department_ID INT NOT NULL AUTO_INCREMENT"
        );

        // Then retry the insert
        const result = (await query(
          `
          INSERT INTO department (Department_Name)
          VALUES (?)
        `,
          [Department_Name]
        )) as OkPacket;

        return NextResponse.json({
          success: true,
          Department_ID: result.insertId,
          message: "Department added successfully (with table auto-fix)",
        });
      } else {
        // If it's another kind of error, rethrow it
        throw insertError;
      }
    }
  } catch (error) {
    console.error("Error adding department:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error adding department",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
