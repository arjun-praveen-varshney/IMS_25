// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcrypt";
import { query } from "@/app/lib/db";
import * as jose from "jose"; // Using jose instead of jsonwebtoken for Edge compatibility
import { cookies } from "next/headers";

// Define types for query results
type User = {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  name?: string;
  is_active?: number;
  department_id?: number; // Added department_id to User type
};

type Permission = {
  name: string;
};

// Use env variable for JWT secret, with fallback to ensure consistency
const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: NextRequest) {
  try {
    const { username, password, rememberMe } = await request.json();

    // Log login attempt (but not the password)
    console.log(`Login attempt: ${username}`);

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Username and password are required" },
        { status: 400 }
      );
    }

    // Get user from database using username instead of email
    const users = (await query(
      `
      SELECT 
        u.id, u.username, u.email, u.password, u.role, u.name, u.is_active, u.department_id
      FROM users u
      WHERE u.username = ?
      LIMIT 1
      `,
      [username]
    )) as User[];

    // Check user query result
    console.log(`User query results: ${users ? users.length : 0} users found`);

    if (!users || !Array.isArray(users) || users.length === 0) {
      console.log(`No user found with username: ${username}`);
      return NextResponse.json(
        { success: false, message: "Invalid credentials" },
        { status: 401 }
      );
    }

    const user = users[0];
    console.log(`Found user: ${user.username}, is_active: ${user.is_active}`);

    // Check if user is active
    if (user.is_active !== 1) {
      console.log(`User account is not active: ${user.username}`);
      return NextResponse.json(
        { success: false, message: "Account is inactive or suspended" },
        { status: 401 }
      );
    }

    // Check password
    try {
      console.log(`Comparing passwords for user: ${user.username}`);
      console.log(
        `Stored password hash length: ${
          user.password ? user.password.length : 0
        }`
      );

      // Make sure the password is a valid bcrypt hash
      if (!user.password || !user.password.startsWith("$2")) {
        console.error(
          `Invalid password hash format for user: ${user.username}`
        );
        return NextResponse.json(
          {
            success: false,
            message:
              "Account password format is invalid. Please reset your password.",
          },
          { status: 401 }
        );
      }

      const passwordMatch = await compare(password, user.password);
      console.log(`Password match result: ${passwordMatch}`);

      if (!passwordMatch) {
        return NextResponse.json(
          { success: false, message: "Invalid credentials" },
          { status: 401 }
        );
      }
    } catch (pwError) {
      console.error(`Password comparison error:`, pwError);
      return NextResponse.json(
        { success: false, message: "Authentication error. Please try again." },
        { status: 500 }
      );
    }

    // Get user permissions from role_permissions table
    let permissionNames: string[] = [];
    try {
      const permissions = (await query(
        `
        SELECT p.name
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role = ?
        `,
        [user.role]
      )) as Permission[];

      permissionNames = permissions.map((p) => p.name);
    } catch (permError) {
      console.error(`Error fetching permissions:`, permError);
      // Continue login process even if permissions fetch fails
      permissionNames = [];
    }

    // Set session duration based on rememberMe flag
    const expiresIn = rememberMe ? "30d" : "24h";
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days or 1 day    // Create session token using jose instead of jsonwebtoken
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(JWT_SECRET);

    // Calculate expiration time based on expiresIn
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24); // 30 days or 1 day

    const sessionToken = await new jose.SignJWT({
      userId: user.id,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(secretKey);

    // Remove password from user object before sending response
    const { password: _, is_active, ...userWithoutPassword } = user;

    // Determine redirect URL based on user role
    let redirectUrl = "/dashboard"; // Default for regular users
    if (user.role === "hod" || user.role === "department") {
      redirectUrl = "/departments/dashboard";
    }

    // Create the response
    const response = NextResponse.json({
      success: true,
      user: {
        ...userWithoutPassword,
        departmentId: userWithoutPassword.department_id || null,
        permissions: permissionNames,
      },
      redirectUrl, // Include redirect URL in response
    }); // Set cookie in the response with more explicit settings - IMPORTANT: domain must not be set for Vercel deployment
    console.log(
      `Setting session cookie for ${user.username}, maxAge: ${maxAge}`
    );
    response.cookies.set({
      name: "session_token",
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge,
      path: "/",
      sameSite: "lax", // Less restrictive to allow redirects
    });

    // Also set a non-httpOnly cookie for client-side detection
    response.cookies.set({
      name: "auth_status",
      value: "logged_in",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge,
      path: "/",
      sameSite: "lax", // Less restrictive to allow redirects
    });

    // Set additional headers to help the client
    response.headers.set("X-Auth-Status", "success");
    response.headers.set("X-Session-Set", "true");
    response.headers.set("Cache-Control", "no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");

    // Log login time in database
    try {
      await query(`UPDATE users SET last_login = NOW() WHERE id = ?`, [
        user.id,
      ]);
    } catch (updateError) {
      console.error(`Error updating last_login:`, updateError);
      // Continue login process even if update fails
    }

    console.log(`Login successful for user: ${user.username}`);
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Authentication failed" },
      { status: 500 }
    );
  }
}
