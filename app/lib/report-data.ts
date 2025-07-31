import { query } from "@/app/lib/db";

// Function to fetch faculty data in JSON format
export async function getFacultyReportData(
  departmentId?: string
): Promise<[any[], string[]]> {
  try {
    // Base query to get faculty details
    let sql = `
      SELECT 
        f.F_id,
        f.F_name as name,
        f.F_dept as department,
        fd.Current_Designation as designation,
        fd.Highest_Degree as highestDegree,
        fd.Experience as experience,
        fd.Date_of_Joining as dateOfJoining
      FROM 
        faculty f
      LEFT JOIN 
        faculty_details fd ON f.F_id = fd.F_ID
    `;

    // Add WHERE clause if departmentId is specified
    const params: any[] = [];
    if (departmentId && departmentId !== "all") {
      sql += " WHERE f.F_dept = ?";
      params.push(departmentId);
    }

    sql += " ORDER BY f.F_name";

    // Execute query
    const results = (await query(sql, params)) as any[];

    // Columns for the table
    const columns = [
      "name",
      "designation",
      "dateOfJoining",
      "department",
      "highestDegree",
      "experience",
    ];

    return [results, columns];
  } catch (error) {
    console.error("Error fetching faculty data:", error);
    return [[], []];
  }
}

// Function to fetch student data in JSON format
export async function getStudentsReportData(
  departmentId?: string
): Promise<[any[], string[]]> {
  try {
    // Using the student table structure provided in requirements
    let sql = `
      SELECT 
        s.id,
        s.username as name,
        s.branch as department,
        s.division,
        s.email
      FROM 
        student s
    `;

    // Add WHERE clause if departmentId is specified
    const params: any[] = [];
    if (departmentId && departmentId !== "all") {
      sql += " WHERE s.branch = ?";
      params.push(departmentId);
    }

    sql += " ORDER BY s.username";

    // Execute query - handle case where table might not exist
    let results: any[] = [];
    try {
      const queryResults = await query(sql, params);
      if (Array.isArray(queryResults)) {
        results = queryResults;
      }
    } catch (error) {
      console.error("Error fetching student data from student table:", error);

      // Fallback to alternative student table if exists
      try {
        const fallbackSql = `
          SELECT 
            s.id,
            s.name,
            s.department as branch,
            s.division,
            s.email
          FROM 
            student s
        `;

        const fallbackParams: any[] = [];
        if (departmentId && departmentId !== "all") {
          sql += " WHERE s.department = ?";
          fallbackParams.push(departmentId);
        }

        sql += " ORDER BY s.name";

        const fallbackResults = await query(fallbackSql, fallbackParams);
        if (Array.isArray(fallbackResults)) {
          results = fallbackResults;
        }
      } catch (fallbackError) {
        console.error(
          "Error fetching from fallback student table:",
          fallbackError
        );
      }
    }

    // Columns for the table
    const columns = ["id", "name", "department", "division", "email"];

    return [results, columns];
  } catch (error) {
    console.error("Error fetching student data:", error);
    return [[], []];
  }
}

// Function to fetch research data in JSON format
export async function getResearchReportData(
  departmentId?: string
): Promise<[any[], string[]]> {
  try {
    // Combine data from multiple sources for a comprehensive research report
    let results: any[] = [];

    // 1. First, fetch research publications from faculty_publications
    let publicationsSql = `
      SELECT 
        f.F_name as faculty_name,
        f.F_dept as department,
        p.title,
        p.publication_type as type,
        YEAR(p.publication_date) as year,
        p.publication_venue as venue,
        '' as funding_amount,
        'faculty_publication' as source
      FROM 
        faculty_publications p
      JOIN 
        faculty f ON p.faculty_id = f.F_id
    `;

    // Add departmentId filter if specified
    const params1: any[] = [];
    if (departmentId && departmentId !== "all") {
      publicationsSql += " WHERE f.F_dept = ?";
      params1.push(departmentId);
    }

    publicationsSql += " ORDER BY p.publication_date DESC, f.F_name";

    // 2. Also fetch from research_project_consultancies table
    let projectsSql = `
      SELECT 
        Name_Of_Principal_Investigator_CoInvestigator as faculty_name,
        Department_Of_Principal_Investigator as department,
        Name_Of_Project_Endownment as title,
        'research project' as type,
        YEAR(Year_Of_Award) as year,
        Name_Of_The_Funding_Agency as venue,
        Amount_Sanctioned as funding_amount,
        'research_project' as source
      FROM 
        research_project_consultancies
    `;

    // Add departmentId filter if specified
    const params2: any[] = [];
    if (departmentId && departmentId !== "all") {
      projectsSql += " WHERE Department_Of_Principal_Investigator = ?";
      params2.push(departmentId);
    }

    projectsSql +=
      " ORDER BY Year_Of_Award DESC, Name_Of_Principal_Investigator_CoInvestigator";

    // 3. Fetch research contributions from faculty_contributions
    let contributionsSql = `
      SELECT 
        f.F_name as faculty_name,
        f.F_dept as department,
        fc.Description as title,
        fc.Contribution_Type as type,
        YEAR(fc.Contribution_Date) as year,
        fc.Recognized_By as venue,
        '' as funding_amount,
        'contribution' as source
      FROM 
        faculty_contributions fc
      JOIN 
        faculty f ON fc.F_ID = f.F_id
      WHERE 
        (
          fc.Contribution_Type LIKE '%journal%' OR 
          fc.Contribution_Type LIKE '%conference%' OR 
          fc.Contribution_Type LIKE '%publication%' OR 
          fc.Contribution_Type LIKE '%research%' OR
          fc.Contribution_Type LIKE '%paper%'
        )
    `;

    // Add departmentId filter if specified
    const params3: any[] = [];
    if (departmentId && departmentId !== "all") {
      contributionsSql += " AND f.F_dept = ?";
      params3.push(departmentId);
    }

    contributionsSql += " ORDER BY fc.Contribution_Date DESC, f.F_name";

    // Execute all queries and combine results
    try {
      const publicationsResults = await query(publicationsSql, params1);
      if (
        Array.isArray(publicationsResults) &&
        publicationsResults.length > 0
      ) {
        results = [...results, ...publicationsResults];
      }
    } catch (error) {
      console.error("Error fetching research publications:", error);
    }

    try {
      const projectsResults = await query(projectsSql, params2);
      if (Array.isArray(projectsResults) && projectsResults.length > 0) {
        results = [...results, ...projectsResults];
      }
    } catch (error) {
      console.error("Error fetching research projects:", error);
    }

    try {
      const contributionsResults = await query(contributionsSql, params3);
      if (
        Array.isArray(contributionsResults) &&
        contributionsResults.length > 0
      ) {
        results = [...results, ...contributionsResults];
      }
    } catch (error) {
      console.error("Error fetching research contributions:", error);
    }

    // Columns for the table
    const columns = [
      "faculty_name",
      "department",
      "title",
      "type",
      "year",
      "venue",
      "funding_amount",
      "source",
    ];

    return [results, columns];
  } catch (error) {
    console.error("Error fetching research data:", error);
    return [[], []];
  }
}

// Function to fetch publications data for a specific department
export async function getPublicationsReportData(
  departmentId?: string,
  facultyId?: string
): Promise<[any[], string[]]> {
  try {
    console.log("getPublicationsReportData called with:", {
      departmentId,
      facultyId,
    });

    let sql = `
      SELECT 
        f.F_name as faculty_name,
        f.F_dept as department,
        p.title as Title,
        p.publication_venue as Journal_Name,
        p.publication_type as Publication_Type,
        p.publication_date as Publication_Date,
        '' as Impact_Factor,
        p.doi as DOI
      FROM 
        faculty_publications p
      JOIN 
        faculty f ON p.faculty_id = f.F_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // Priority: facultyId over departmentId
    if (facultyId) {
      conditions.push("f.F_id = ?");
      params.push(parseInt(facultyId));
    } else if (departmentId && departmentId !== "all") {
      conditions.push("f.F_dept = ?");
      params.push(departmentId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY p.publication_date DESC, f.F_name";

    console.log("Final SQL query:", sql);
    console.log("Query parameters:", params);

    const results = (await query(sql, params)) as any[];

    console.log("Publications query results:", {
      resultCount: results.length,
      firstResult: results[0] || "No results",
      facultyNames: results.map((r) => r.faculty_name).slice(0, 3),
    });

    const columns = [
      "faculty_name",
      "Title",
      "Journal_Name",
      "Publication_Type",
      "Publication_Date",
      "Impact_Factor",
      "DOI",
    ];

    return [results, columns];
  } catch (error) {
    console.error("Error fetching publications data:", error);
    return [[], []];
  }
}

// Function to fetch research projects data for a specific department
export async function getResearchProjectsReportData(
  departmentId?: string,
  facultyId?: string
): Promise<[any[], string[]]> {
  try {
    let sql = `
      SELECT 
        f.F_name as faculty_name,
        f.F_dept as department,
        rp.Name_Of_Project_Endownment as Title,
        rp.Name_Of_The_Funding_Agency as Funding_Agency,
        rp.Amount_Sanctioned as Amount,
        rp.Year_Of_Award as Start_Date,
        '' as End_Date,
        rp.STATUS as Status
      FROM 
        research_project_consultancies rp
      JOIN 
        faculty f ON rp.user_id = f.F_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // Priority: facultyId over departmentId
    if (facultyId) {
      conditions.push("f.F_id = ?");
      params.push(parseInt(facultyId));
    } else if (departmentId && departmentId !== "all") {
      conditions.push("f.F_dept = ?");
      params.push(departmentId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY rp.Year_Of_Award DESC, f.F_name";

    const results = (await query(sql, params)) as any[];

    const columns = [
      "faculty_name",
      "Title",
      "Funding_Agency",
      "Amount",
      "Start_Date",
      "End_Date",
      "Status",
    ];

    return [results, columns];
  } catch (error) {
    console.error("Error fetching research projects data:", error);
    return [[], []];
  }
}

// Function to fetch contributions data for a specific department
export async function getContributionsReportData(
  departmentId?: string,
  facultyId?: string
): Promise<[any[], string[]]> {
  try {
    let sql = `
      SELECT 
        f.F_name as faculty_name,
        f.F_dept as department,
        c.Contribution_Type,
        c.Description,
        c.Contribution_Date as Date,
        c.Recognized_By,
        c.Award_Received,
        c.Remarks
      FROM 
        faculty_contributions c
      JOIN 
        faculty f ON c.F_ID = f.F_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // Priority: facultyId over departmentId
    if (facultyId) {
      conditions.push("f.F_id = ?");
      params.push(parseInt(facultyId));
    } else if (departmentId && departmentId !== "all") {
      conditions.push("f.F_dept = ?");
      params.push(departmentId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY c.Contribution_Date DESC, f.F_name";

    const results = (await query(sql, params)) as any[];

    const columns = [
      "faculty_name",
      "Contribution_Type",
      "Description",
      "Date",
      "Recognized_By",
      "Award_Received",
      "Remarks",
    ];

    return [results, columns];
  } catch (error) {
    console.error("Error fetching contributions data:", error);
    return [[], []];
  }
}

// Function to fetch workshops data for a specific department
export async function getWorkshopsReportData(
  departmentId?: string,
  facultyId?: string
): Promise<[any[], string[]]> {
  try {
    let sql = `
      SELECT 
        f.F_name as faculty_name,
        f.F_dept as department,
        w.title as Workshop_Name,
        w.venue as Organization,
        w.start_date as Start_Date,
        w.end_date as End_Date,
        w.role as Role,
        '' as Certificate_URL
      FROM 
        faculty_workshops w
      JOIN 
        faculty f ON w.faculty_id = f.F_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // Priority: facultyId over departmentId
    if (facultyId) {
      conditions.push("f.F_id = ?");
      params.push(parseInt(facultyId));
    } else if (departmentId && departmentId !== "all") {
      conditions.push("f.F_dept = ?");
      params.push(departmentId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY w.start_date DESC, f.F_name";

    const results = (await query(sql, params)) as any[];

    const columns = [
      "faculty_name",
      "Workshop_Name",
      "Organization",
      "Start_Date",
      "End_Date",
      "Role",
    ];

    return [results, columns];
  } catch (error) {
    console.error("Error fetching workshops data:", error);
    return [[], []];
  }
}

// Function to fetch memberships data for a specific department
export async function getMembershipsReportData(
  departmentId?: string,
  facultyId?: string
): Promise<[any[], string[]]> {
  try {
    let sql = `
      SELECT 
        f.F_name as faculty_name,
        f.F_dept as department,
        m.organization as Organization_Name,
        m.membership_type as Membership_Type,
        m.start_date as Start_Date,
        m.end_date as End_Date,
        '' as Position_Held,
        m.organization_category as Status
      FROM 
        faculty_memberships m
      JOIN 
        faculty f ON m.faculty_id = f.F_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // Priority: facultyId over departmentId
    if (facultyId) {
      conditions.push("f.F_id = ?");
      params.push(parseInt(facultyId));
    } else if (departmentId && departmentId !== "all") {
      conditions.push("f.F_dept = ?");
      params.push(departmentId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY m.start_date DESC, f.F_name";

    const results = (await query(sql, params)) as any[];

    const columns = [
      "faculty_name",
      "Organization_Name",
      "Membership_Type",
      "Start_Date",
      "End_Date",
      "Position_Held",
      "Status",
    ];

    return [results, columns];
  } catch (error) {
    console.error("Error fetching memberships data:", error);
    return [[], []];
  }
}

// Function to fetch awards data for a specific department
export async function getAwardsReportData(
  departmentId?: string,
  facultyId?: string
): Promise<[any[], string[]]> {
  try {
    let sql = `
      SELECT 
        f.F_name as faculty_name,
        f.F_dept as department,
        a.award_name as Award_Name,
        a.awarding_organization as Awarding_Organization,
        a.award_date as Date_Received,
        a.category as Category,
        a.award_description as Description
      FROM 
        faculty_awards a
      JOIN 
        faculty f ON a.faculty_id = f.F_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    // Priority: facultyId over departmentId
    if (facultyId) {
      conditions.push("f.F_id = ?");
      params.push(parseInt(facultyId));
    } else if (departmentId && departmentId !== "all") {
      conditions.push("f.F_dept = ?");
      params.push(departmentId);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY a.award_date DESC, f.F_name";

    const results = (await query(sql, params)) as any[];

    const columns = [
      "faculty_name",
      "Award_Name",
      "Awarding_Organization",
      "Date_Received",
      "Category",
      "Description",
    ];

    return [results, columns];
  } catch (error) {
    console.error("Error fetching awards data:", error);
    return [[], []];
  }
}
