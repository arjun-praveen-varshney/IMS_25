import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(request: NextRequest) {
  try {
    // Get user info from auth system
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { success: false, message: "Authentication failed" },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();

    if (!authData.success || !authData.user) {
      return NextResponse.json(
        { success: false, message: "User not authenticated" },
        { status: 401 }
      );
    }

    // Get faculty ID from username if user is faculty
    const username = authData.user.username;
    let facultyId = null;

    if (authData.user.role === "faculty") {
      // Get faculty ID for the logged-in user
      const facultyResult = (await query(
        "SELECT F_id FROM faculty WHERE F_id = ?",
        [username]
      )) as RowDataPacket[];

      if (
        !facultyResult ||
        !Array.isArray(facultyResult) ||
        facultyResult.length === 0
      ) {
        return NextResponse.json(
          { success: false, message: "Faculty record not found" },
          { status: 404 }
        );
      }

      facultyId = facultyResult[0].F_id;
    }

    // For admin or HOD roles, allow querying for any faculty
    const queryFacultyId =
      request.nextUrl.searchParams.get("facultyId") || facultyId;

    if (!queryFacultyId) {
      return NextResponse.json(
        { success: false, message: "Faculty ID is required" },
        { status: 400 }
      );
    }

    // Check if table exists and fetch publications
    try {
      // First, try to create the faculty_publications table if it doesn't exist
      await query(`CREATE TABLE IF NOT EXISTS faculty_publications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        faculty_id BIGINT NOT NULL,
        title VARCHAR(500) NOT NULL,
        abstract TEXT,
        authors VARCHAR(500) NOT NULL,
        publication_date DATE NOT NULL,
        publication_type ENUM('journal', 'conference', 'book', 'book_chapter', 'other') NOT NULL,
        publication_venue VARCHAR(500) NOT NULL,
        doi VARCHAR(100),
        url VARCHAR(1000),
        citation_count INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (faculty_id),
        CONSTRAINT fk_faculty_publications_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(F_id)
      )`); // First try the faculty_publications table
      const publications = (await query(
        `SELECT 
          id,
          faculty_id,
          title,
          abstract,
          authors,
          publication_date,
          publication_type,
          publication_venue,
          doi,
          url,
          citation_count,
          citations_crossref,
          citations_semantic_scholar,
          citations_google_scholar,
          citations_web_of_science,
          citations_scopus,
          citations_last_updated
        FROM 
          faculty_publications
        WHERE 
          faculty_id = ?
        ORDER BY 
          publication_date DESC`,
        [queryFacultyId]
      )) as RowDataPacket[];

      console.log(
        `Found ${publications.length} publications in faculty_publications for faculty ID ${queryFacultyId}`
      );

      // Also check bookschapter table for additional publications
      let allPublications = [...publications];

      try {
        const bookChapters = (await query(
          `SELECT 
            id,
            ? as faculty_id,
            Title_Of_The_Book_Published as title,
            NULL as abstract,
            Name_Of_The_Teacher as authors,
            STR_TO_DATE(CONCAT(Year_Of_Publication, '-01-01'), '%Y-%m-%d') as publication_date,
            CASE 
              WHEN National_Or_International = 'international' THEN 'book_chapter'
              ELSE 'book'
            END as publication_type,
            Name_Of_The_Publisher as publication_venue,
            ISBN_Or_ISSN_Number as doi,
            paper_link as url,
            NULL as citation_count
          FROM 
            bookschapter
          WHERE 
            user_id = ? AND STATUS = 'approved'
          ORDER BY 
            Year_Of_Publication DESC`,
          [queryFacultyId, queryFacultyId]
        )) as RowDataPacket[];

        console.log(
          `Found ${bookChapters.length} publications in bookschapter for faculty ID ${queryFacultyId}`
        );

        allPublications = [...allPublications, ...bookChapters];
      } catch (error) {
        console.error("Error fetching from bookschapter table:", error);
        // Continue execution - don't fail if this table doesn't exist
      }

      // Also check faculty_contributions for publications
      try {
        const contributions = (await query(
          `SELECT 
            Contribution_ID as id,
            ? as faculty_id,
            Description as title,
            NULL as abstract,
            CONCAT('Faculty ID: ', F_ID) as authors,
            Contribution_Date as publication_date,
            CASE
              WHEN Contribution_Type LIKE '%journal%' THEN 'journal'
              WHEN Contribution_Type LIKE '%conference%' THEN 'conference'
              WHEN Contribution_Type LIKE '%book%' THEN 'book'
              ELSE 'other'
            END as publication_type,
            Recognized_By as publication_venue,
            Award_Received as doi,
            NULL as url,
            NULL as citation_count
          FROM 
            faculty_contributions
          WHERE 
            F_ID = ? AND 
            (Contribution_Type LIKE '%journal%' OR 
             Contribution_Type LIKE '%conference%' OR 
             Contribution_Type LIKE '%publication%' OR 
             Contribution_Type LIKE '%book%' OR
             Contribution_Type LIKE '%paper%')
          ORDER BY 
            Contribution_Date DESC`,
          [queryFacultyId, queryFacultyId]
        )) as RowDataPacket[];

        console.log(
          `Found ${contributions.length} publications in faculty_contributions for faculty ID ${queryFacultyId}`
        );

        allPublications = [...allPublications, ...contributions];
      } catch (error) {
        console.error(
          "Error fetching from faculty_contributions table:",
          error
        );
        // Continue execution - don't fail if this table doesn't exist
      }

      console.log(`Total publications found: ${allPublications.length}`);

      // Return the combined publications data
      return NextResponse.json({
        success: true,
        data: allPublications,
      });
    } catch (error) {
      console.error(
        "Error checking/querying faculty_publications table:",
        error
      );
      return NextResponse.json({
        success: true,
        data: [],
        error: "Database error when fetching publications",
      });
    }
  } catch (error) {
    console.error("Error fetching faculty publications:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch publications" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user info from auth system
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { success: false, message: "Authentication failed" },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();

    if (!authData.success || !authData.user) {
      return NextResponse.json(
        { success: false, message: "User not authenticated" },
        { status: 401 }
      );
    }

    // Only faculty, HOD, and admin can add publications
    if (!["faculty", "hod", "admin"].includes(authData.user.role)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to add publications" },
        { status: 403 }
      );
    }

    // Get faculty ID from username if user is faculty
    const username = authData.user.username;
    let facultyId = null;

    if (authData.user.role === "faculty") {
      // Get faculty ID for the logged-in user
      const facultyResult = (await query(
        "SELECT F_id FROM faculty WHERE F_id = ?",
        [username]
      )) as RowDataPacket[];

      if (
        !facultyResult ||
        !Array.isArray(facultyResult) ||
        facultyResult.length === 0
      ) {
        return NextResponse.json(
          { success: false, message: "Faculty record not found" },
          { status: 404 }
        );
      }

      facultyId = facultyResult[0].F_id;
    }

    // Parse request body
    const {
      title,
      abstract,
      authors,
      publication_date,
      publication_type,
      publication_venue,
      doi,
      url,
      citation_count,
      faculty_id: requestFacultyId,
      co_authors, // Array of co-author faculty IDs
      // New citation fields
      citations_crossref,
      citations_semantic_scholar,
      citations_google_scholar,
      citations_web_of_science,
      citations_scopus,
      citations_last_updated,
    } = await request.json();

    // For faculty role, ensure they can only add their own publications
    const publicationFacultyId =
      authData.user.role === "faculty" ? facultyId : requestFacultyId;

    if (!publicationFacultyId) {
      return NextResponse.json(
        { success: false, message: "Faculty ID is required" },
        { status: 400 }
      );
    }

    // Build authors string - get current user's name and add co-authors
    let finalAuthors = authors;
    if (co_authors && co_authors.length > 0) {
      // Get current user's name
      const currentUserResult = (await query(
        "SELECT F_name FROM faculty WHERE F_id = ?",
        [publicationFacultyId]
      )) as RowDataPacket[];

      // Get co-authors' names
      const coAuthorNames = [];
      for (const coAuthorId of co_authors) {
        const coAuthorResult = (await query(
          "SELECT F_name FROM faculty WHERE F_id = ?",
          [coAuthorId]
        )) as RowDataPacket[];

        if (coAuthorResult.length > 0) {
          coAuthorNames.push(coAuthorResult[0].F_name);
        }
      }

      // Build final authors string
      const currentUserName =
        currentUserResult.length > 0 ? currentUserResult[0].F_name : "Unknown";
      finalAuthors = [currentUserName, ...coAuthorNames].join(", ");
    }

    // Validate required fields
    if (
      !title ||
      !publication_date ||
      !publication_type ||
      !publication_venue
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Title, publication date, type, and venue are required",
        },
        { status: 400 }
      );
    }

    // Create the table if it doesn't exist
    await query(`CREATE TABLE IF NOT EXISTS faculty_publications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faculty_id BIGINT NOT NULL,
      title VARCHAR(500) NOT NULL,
      abstract TEXT,
      authors VARCHAR(500) NOT NULL,
      publication_date DATE NOT NULL,
      publication_type ENUM('journal', 'conference', 'book', 'book_chapter', 'other') NOT NULL,
      publication_venue VARCHAR(500) NOT NULL,
      doi VARCHAR(100),
      url VARCHAR(1000),
      citation_count INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (faculty_id),
      CONSTRAINT fk_faculty_publications_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(F_id)
    )`);

    // Insert the publication
    const result = await query(
      `INSERT INTO faculty_publications 
        (faculty_id, title, abstract, authors, publication_date, publication_type, publication_venue, doi, url, citation_count, 
         citations_crossref, citations_semantic_scholar, citations_google_scholar, citations_web_of_science, citations_scopus, citations_last_updated) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        publicationFacultyId,
        title,
        abstract || null,
        finalAuthors,
        publication_date,
        publication_type,
        publication_venue,
        doi || null,
        url || null,
        citation_count || null,
        citations_crossref || null,
        citations_semantic_scholar || null,
        citations_google_scholar || null,
        citations_web_of_science || null,
        citations_scopus || null,
        citations_last_updated
          ? new Date(citations_last_updated)
              .toISOString()
              .slice(0, 19)
              .replace("T", " ")
          : null,
      ]
    );

    const publicationId = (result as any).insertId;

    // Insert co-author relationships
    if (co_authors && co_authors.length > 0) {
      for (let i = 0; i < co_authors.length; i++) {
        await query(
          `INSERT INTO publication_co_authors (publication_id, faculty_id, author_order) 
           VALUES (?, ?, ?)`,
          [publicationId, co_authors[i], i + 2] // Start from 2 since primary author is 1
        );

        // Also create a duplicate publication record for each co-author
        await query(
          `INSERT INTO faculty_publications 
            (faculty_id, title, abstract, authors, publication_date, publication_type, publication_venue, doi, url, citation_count) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            co_authors[i],
            title,
            abstract || null,
            finalAuthors,
            publication_date,
            publication_type,
            publication_venue,
            doi || null,
            url || null,
            citation_count || null,
          ]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Publication added successfully",
      data: {
        id: publicationId,
        faculty_id: publicationFacultyId,
        title,
        abstract,
        authors: finalAuthors,
        publication_date,
        publication_type,
        publication_venue,
        doi,
        url,
        citation_count,
      },
    });
  } catch (error) {
    console.error("Error adding publication:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add publication" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get user info from auth system
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { success: false, message: "Authentication failed" },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();

    if (!authData.success || !authData.user) {
      return NextResponse.json(
        { success: false, message: "User not authenticated" },
        { status: 401 }
      );
    }

    // Only faculty, HOD, and admin can update publications
    if (!["faculty", "hod", "admin"].includes(authData.user.role)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to update publications" },
        { status: 403 }
      );
    }

    // Parse request body
    const {
      id,
      title,
      abstract,
      authors,
      publication_date,
      publication_type,
      publication_venue,
      doi,
      url,
      citation_count,
      faculty_id: requestFacultyId,
      // New citation fields
      citations_crossref,
      citations_semantic_scholar,
      citations_google_scholar,
      citations_web_of_science,
      citations_scopus,
      citations_last_updated,
    } = await request.json();

    // Check if ID is provided
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Publication ID is required" },
        { status: 400 }
      );
    }

    // Get faculty ID from username if user is faculty
    const username = authData.user.username;
    let facultyId = null;

    if (authData.user.role === "faculty") {
      // Get faculty ID for the logged-in user
      const facultyResult = (await query(
        "SELECT F_id FROM faculty WHERE F_id = ?",
        [username]
      )) as RowDataPacket[];

      if (
        !facultyResult ||
        !Array.isArray(facultyResult) ||
        facultyResult.length === 0
      ) {
        return NextResponse.json(
          { success: false, message: "Faculty record not found" },
          { status: 404 }
        );
      }

      facultyId = facultyResult[0].F_id;
    }

    // If the user is a faculty member, verify they can only update their own publications
    if (authData.user.role === "faculty") {
      const publicationCheck = (await query(
        "SELECT faculty_id FROM faculty_publications WHERE id = ?",
        [id]
      )) as RowDataPacket[];

      if (
        !publicationCheck ||
        !Array.isArray(publicationCheck) ||
        publicationCheck.length === 0
      ) {
        return NextResponse.json(
          { success: false, message: "Publication not found" },
          { status: 404 }
        );
      }

      if (publicationCheck[0].faculty_id !== facultyId) {
        return NextResponse.json(
          {
            success: false,
            message: "Unauthorized to update this publication",
          },
          { status: 403 }
        );
      }
    }

    // Validate required fields
    if (
      !title ||
      !authors ||
      !publication_date ||
      !publication_type ||
      !publication_venue
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Title, authors, publication date, type, and venue are required",
        },
        { status: 400 }
      );
    }

    // For admin/HOD, respect the provided faculty_id, for faculty, use their own ID
    const publicationFacultyId =
      authData.user.role === "faculty"
        ? facultyId
        : requestFacultyId || facultyId;

    // Update the publication
    await query(
      `UPDATE faculty_publications 
       SET 
        title = ?,
        abstract = ?,
        authors = ?,
        publication_date = ?,
        publication_type = ?,
        publication_venue = ?,
        doi = ?,
        url = ?,
        citation_count = ?,
        faculty_id = ?,
        citations_crossref = ?,
        citations_semantic_scholar = ?,
        citations_google_scholar = ?,
        citations_web_of_science = ?,
        citations_scopus = ?,
        citations_last_updated = ?
       WHERE id = ?`,
      [
        title,
        abstract || null,
        authors,
        publication_date,
        publication_type,
        publication_venue,
        doi || null,
        url || null,
        citation_count || null,
        publicationFacultyId,
        citations_crossref || null,
        citations_semantic_scholar || null,
        citations_google_scholar || null,
        citations_web_of_science || null,
        citations_scopus || null,
        citations_last_updated
          ? new Date(citations_last_updated)
              .toISOString()
              .slice(0, 19)
              .replace("T", " ")
          : null,
        id,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Publication updated successfully",
      data: {
        id,
        faculty_id: publicationFacultyId,
        title,
        abstract,
        authors,
        publication_date,
        publication_type,
        publication_venue,
        doi,
        url,
        citation_count,
      },
    });
  } catch (error) {
    console.error("Error updating publication:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update publication" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get user info from auth system
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { success: false, message: "Authentication failed" },
        { status: 401 }
      );
    }

    const authData = await authResponse.json();

    if (!authData.success || !authData.user) {
      return NextResponse.json(
        { success: false, message: "User not authenticated" },
        { status: 401 }
      );
    }

    // Only faculty, HOD, and admin can delete publications
    if (!["faculty", "hod", "admin"].includes(authData.user.role)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized to delete publications" },
        { status: 403 }
      );
    }

    // Get the ID from the query parameters
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Publication ID is required" },
        { status: 400 }
      );
    }

    // Get faculty ID from username if user is faculty
    const username = authData.user.username;
    let facultyId = null;

    if (authData.user.role === "faculty") {
      // Get faculty ID for the logged-in user
      const facultyResult = (await query(
        "SELECT F_id FROM faculty WHERE F_id = ?",
        [username]
      )) as RowDataPacket[];

      if (
        !facultyResult ||
        !Array.isArray(facultyResult) ||
        facultyResult.length === 0
      ) {
        return NextResponse.json(
          { success: false, message: "Faculty record not found" },
          { status: 404 }
        );
      }

      facultyId = facultyResult[0].F_id;

      // If the user is a faculty member, verify they can only delete their own publications
      const publicationCheck = (await query(
        "SELECT faculty_id FROM faculty_publications WHERE id = ?",
        [id]
      )) as RowDataPacket[];

      if (
        !publicationCheck ||
        !Array.isArray(publicationCheck) ||
        publicationCheck.length === 0
      ) {
        return NextResponse.json(
          { success: false, message: "Publication not found" },
          { status: 404 }
        );
      }

      if (publicationCheck[0].faculty_id !== facultyId) {
        return NextResponse.json(
          {
            success: false,
            message: "Unauthorized to delete this publication",
          },
          { status: 403 }
        );
      }
    }

    // Delete the publication
    await query("DELETE FROM faculty_publications WHERE id = ?", [id]);

    return NextResponse.json({
      success: true,
      message: "Publication deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting publication:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete publication" },
      { status: 500 }
    );
  }
}
