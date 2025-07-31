import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";

export async function POST(request: NextRequest) {
  try {
    console.log("POST request to update user role...");

    // First, let's see what the current role length limit is and current roles
    const users = (await query(
      "SELECT username, role, LENGTH(role) as role_length FROM users WHERE username IN ('itdept', 'admin') ORDER BY username"
    )) as any[];

    console.log("Current users and role lengths:", users);

    // Try updating with a shorter role first
    await query("UPDATE users SET role = ? WHERE username = ?", [
      "dept",
      "itdept",
    ]);

    console.log("Updated itdept user role to 'dept'");

    return NextResponse.json({
      success: true,
      message: "Updated itdept user role to 'dept'",
      currentUsers: users,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to update user role";
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log("Fetching all users and their roles...");
    // Get all users with their current roles
    const users = (await query(
      "SELECT id, username, name, email, role, department_id FROM users ORDER BY username"
    )) as any[];

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
