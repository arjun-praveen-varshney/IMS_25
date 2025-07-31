import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("reportType");
    const facultyId = searchParams.get("facultyId");
    const year = searchParams.get("year");
    const departmentId = searchParams.get("departmentId");

    if (!reportType || !departmentId) {
      return NextResponse.json(
        {
          success: false,
          message: "Report type and department ID are required",
        },
        { status: 400 }
      );
    }

    // Get department name
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

    // Generate report based on type
    let reportData: any[] = [];
    let reportTitle = "";
    let columns: string[] = [];

    switch (reportType) {
      case "publications":
        reportTitle = "Publications Report";
        columns = [
          "Faculty Name",
          "Title",
          "Journal/Conference",
          "Year",
          "Type",
        ];
        reportData = await getPublicationsData(departmentName, facultyId, year);
        break;

      case "research-projects":
        reportTitle = "Research Projects Report";
        columns = [
          "Faculty Name",
          "Project Title",
          "Funding Agency",
          "Year",
          "Amount",
        ];
        reportData = await getResearchProjectsData(
          departmentName,
          facultyId,
          year
        );
        break;

      case "awards":
        reportTitle = "Awards Report";
        columns = [
          "Faculty Name",
          "Award Name",
          "Organization",
          "Date",
          "Category",
        ];
        reportData = await getAwardsData(departmentName, facultyId, year);
        break;

      case "workshops":
        reportTitle = "Workshops Report";
        columns = [
          "Faculty Name",
          "Workshop Title",
          "Type",
          "Date",
          "Duration",
        ];
        reportData = await getWorkshopsData(departmentName, facultyId, year);
        break;

      case "memberships":
        reportTitle = "Professional Memberships Report";
        columns = [
          "Faculty Name",
          "Organization",
          "Type",
          "Start Date",
          "Status",
        ];
        reportData = await getMembershipsData(departmentName, facultyId, year);
        break;

      case "contributions":
        reportTitle = "Contributions Report";
        columns = [
          "Faculty Name",
          "Type",
          "Description",
          "Date",
          "Recognition",
        ];
        reportData = await getContributionsData(
          departmentName,
          facultyId,
          year
        );
        break;

      default:
        return NextResponse.json(
          { success: false, message: "Invalid report type" },
          { status: 400 }
        );
    }

    // Generate PDF
    const pdf = generatePDF(reportTitle, departmentName, columns, reportData, {
      facultyId,
      year,
    });

    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));

    // Return PDF response
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportType}-report-${departmentName}-${
          year || "all"
        }.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating department report:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate report" },
      { status: 500 }
    );
  }
}

// Data fetching functions
async function getPublicationsData(
  departmentName: string,
  facultyId?: string | null,
  year?: string | null
) {
  let whereClause = "WHERE f.F_dept = ?";
  const params: any[] = [departmentName];

  if (facultyId && facultyId !== "all") {
    whereClause += " AND f.F_id = ?";
    params.push(facultyId);
  }

  if (year && year !== "all") {
    whereClause += " AND YEAR(fp.publication_date) = ?";
    params.push(year);
  }

  const data = (await query(
    `
    SELECT 
      f.F_name as faculty_name,
      fp.title,
      fp.publication_venue as journal_conference,
      YEAR(fp.publication_date) as year,
      fp.publication_type as type
    FROM faculty_publications fp
    JOIN faculty f ON fp.faculty_id = f.F_id
    ${whereClause}
    ORDER BY fp.publication_date DESC, f.F_name
  `,
    params
  )) as any[];

  return data.map((row: any) => [
    row.faculty_name,
    row.title,
    row.journal_conference,
    row.year,
    row.type,
  ]);
}

async function getResearchProjectsData(
  departmentName: string,
  facultyId?: string | null,
  year?: string | null
) {
  let whereClause = "WHERE rpc.Branch = ?";
  const params: any[] = [departmentName];

  if (year && year !== "all") {
    whereClause += " AND rpc.Year_Of_Award = ?";
    params.push(year);
  }

  const data = (await query(
    `
    SELECT 
      rpc.Name_Of_Principal_Investigator_CoInvestigator as faculty_name,
      rpc.Name_Of_Project_Endownment as project_title,
      rpc.Name_Of_The_Funding_Agency as funding_agency,
      rpc.Year_Of_Award as year,
      rpc.Amount_Sanctioned as amount
    FROM research_project_consultancies rpc
    ${whereClause}
    ORDER BY rpc.Year_Of_Award DESC
  `,
    params
  )) as any[];

  return data.map((row: any) => [
    row.faculty_name,
    row.project_title,
    row.funding_agency,
    row.year,
    row.amount,
  ]);
}

async function getAwardsData(
  departmentName: string,
  facultyId?: string | null,
  year?: string | null
) {
  let whereClause = "WHERE f.F_dept = ?";
  const params: any[] = [departmentName];

  if (facultyId && facultyId !== "all") {
    whereClause += " AND f.F_id = ?";
    params.push(facultyId);
  }

  if (year && year !== "all") {
    whereClause += " AND YEAR(fa.award_date) = ?";
    params.push(year);
  }

  const data = (await query(
    `
    SELECT 
      f.F_name as faculty_name,
      fa.award_name,
      fa.awarding_organization,
      fa.award_date,
      fa.category
    FROM faculty_awards fa
    JOIN faculty f ON fa.faculty_id = f.F_id
    ${whereClause}
    ORDER BY fa.award_date DESC, f.F_name
  `,
    params
  )) as any[];

  return data.map((row: any) => [
    row.faculty_name,
    row.award_name,
    row.awarding_organization,
    row.award_date,
    row.category,
  ]);
}

async function getWorkshopsData(
  departmentName: string,
  facultyId?: string | null,
  year?: string | null
) {
  let whereClause = "WHERE f.F_dept = ?";
  const params: any[] = [departmentName];

  if (facultyId && facultyId !== "all") {
    whereClause += " AND f.F_id = ?";
    params.push(facultyId);
  }

  if (year && year !== "all") {
    whereClause += " AND YEAR(fw.start_date) = ?";
    params.push(year);
  }

  const data = (await query(
    `
    SELECT 
      f.F_name as faculty_name,
      fw.title,
      fw.type,
      fw.start_date,
      DATEDIFF(fw.end_date, fw.start_date) as duration
    FROM faculty_workshops fw
    JOIN faculty f ON fw.faculty_id = f.F_id
    ${whereClause}
    ORDER BY fw.start_date DESC, f.F_name
  `,
    params
  )) as any[];

  return data.map((row: any) => [
    row.faculty_name,
    row.title,
    row.type,
    row.start_date,
    `${row.duration || 1} days`,
  ]);
}

async function getMembershipsData(
  departmentName: string,
  facultyId?: string | null,
  year?: string | null
) {
  let whereClause = "WHERE f.F_dept = ?";
  const params: any[] = [departmentName];

  if (facultyId && facultyId !== "all") {
    whereClause += " AND f.F_id = ?";
    params.push(facultyId);
  }

  if (year && year !== "all") {
    whereClause += " AND YEAR(fm.start_date) = ?";
    params.push(year);
  }

  const data = (await query(
    `
    SELECT 
      f.F_name as faculty_name,
      fm.organization,
      fm.membership_type,
      fm.start_date,
      CASE 
        WHEN fm.end_date IS NULL OR fm.end_date > CURDATE() THEN 'Active'
        ELSE 'Expired'
      END as status
    FROM faculty_memberships fm
    JOIN faculty f ON fm.faculty_id = f.F_id
    ${whereClause}
    ORDER BY fm.start_date DESC, f.F_name
  `,
    params
  )) as any[];

  return data.map((row: any) => [
    row.faculty_name,
    row.organization,
    row.membership_type,
    row.start_date,
    row.status,
  ]);
}

async function getContributionsData(
  departmentName: string,
  facultyId?: string | null,
  year?: string | null
) {
  let whereClause = "WHERE f.F_dept = ?";
  const params: any[] = [departmentName];

  if (facultyId && facultyId !== "all") {
    whereClause += " AND f.F_id = ?";
    params.push(facultyId);
  }

  if (year && year !== "all") {
    whereClause += " AND YEAR(fc.Contribution_Date) = ?";
    params.push(year);
  }

  const data = (await query(
    `
    SELECT 
      f.F_name as faculty_name,
      fc.Contribution_Type,
      fc.Description,
      fc.Contribution_Date,
      fc.Recognized_By
    FROM faculty_contributions fc
    JOIN faculty f ON fc.F_ID = f.F_id
    ${whereClause}
    ORDER BY fc.Contribution_Date DESC, f.F_name
  `,
    params
  )) as any[];

  return data.map((row: any) => [
    row.faculty_name,
    row.Contribution_Type,
    row.Description,
    row.Contribution_Date,
    row.Recognized_By,
  ]);
}

function generatePDF(
  title: string,
  departmentName: string,
  columns: string[],
  data: any[][],
  filters: { facultyId?: string | null; year?: string | null }
) {
  const pdf = new jsPDF("landscape");

  // Add header
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("Fr. Conceicao Rodrigues Institute of Technology", 148, 20, {
    align: "center",
  });

  pdf.setFontSize(16);
  pdf.text(`${departmentName} Department`, 148, 30, { align: "center" });

  pdf.setFontSize(14);
  pdf.text(title, 148, 40, { align: "center" });

  // Add filters info
  let filterText = "";
  if (filters.facultyId && filters.facultyId !== "all") {
    filterText += `Faculty ID: ${filters.facultyId}  `;
  }
  if (filters.year && filters.year !== "all") {
    filterText += `Academic Year: ${filters.year}-${
      parseInt(filters.year) + 1
    }`;
  }
  if (filterText) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(filterText, 148, 50, { align: "center" });
  }

  // Add table
  autoTable(pdf, {
    head: [columns],
    body: data,
    startY: 60,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    tableWidth: "auto",
    margin: { left: 10, right: 10 },
  });

  // Add footer
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `Generated on: ${new Date().toLocaleDateString()}`,
      10,
      pdf.internal.pageSize.height - 10
    );
    pdf.text(
      `Page ${i} of ${pageCount}`,
      pdf.internal.pageSize.width - 30,
      pdf.internal.pageSize.height - 10
    );
  }

  return pdf;
}
