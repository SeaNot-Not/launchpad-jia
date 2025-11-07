import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { guid } from "@/lib/Utils";
import { ObjectId } from "mongodb";

// Import Sanization Helper Functions
import {
  sanitizeString,
  sanitizeRichText,
  validateAndSanitizeQuestions,
  isValidObjectId,
} from "@/lib/utils/helpersV2";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    let {
      jobTitle,
      description,
      questions,
      lastEditedBy,
      createdBy,
      screeningSetting,
      orgID,
      requireVideo,
      location,
      workSetup,
      workSetupRemarks,
      status,
      salaryNegotiable,
      minimumSalary,
      maximumSalary,
      country,
      province,
      employmentType,
    } = body;

    // Validate required fields
    if (!jobTitle || !description || !questions || !location || !workSetup) {
      return NextResponse.json(
        {
          error:
            "Job title, description, questions, location and work setup are required",
        },
        { status: 400 }
      );
    }

    // Validate ObjectId
    if (!isValidObjectId(orgID)) {
      return NextResponse.json(
        { error: "Invalid organization id." },
        { status: 400 }
      );
    }

    // Sanitize and validate fields
    jobTitle = sanitizeString(jobTitle);
    description = sanitizeRichText(description);
    questions = validateAndSanitizeQuestions(questions);
    location = sanitizeString(location);
    workSetup = sanitizeString(workSetup);
    workSetupRemarks = sanitizeString(workSetupRemarks || "");
    country = sanitizeString(country || "");
    province = sanitizeString(province || "");
    employmentType = sanitizeString(employmentType || "");
    lastEditedBy = sanitizeString(lastEditedBy || "");
    createdBy = sanitizeString(createdBy || "");

    // Validate minimum and maximum salary
    if (minimumSalary && maximumSalary && minimumSalary > maximumSalary) {
      return NextResponse.json(
        { error: "Minimum salary cannot be greater than maximum salary." },
        { status: 400 }
      );
    }

    // Connect to DB
    const { db } = await connectMongoDB();

    // Validate organization and plan
    const orgDetails = await db
      .collection("organizations")
      .aggregate([
        {
          $match: {
            _id: new ObjectId(orgID),
          },
        },
        {
          $lookup: {
            from: "organization-plans",
            let: { planId: "$planId" },
            pipeline: [
              {
                $addFields: {
                  _id: { $toString: "$_id" },
                },
              },
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$planId"] },
                },
              },
            ],
            as: "plan",
          },
        },
        {
          $unwind: "$plan",
        },
      ])
      .toArray();

    if (!orgDetails || orgDetails.length === 0) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const totalActiveCareers = await db
      .collection("careers")
      .countDocuments({ orgID, status: "active" });

    if (
      totalActiveCareers >=
      orgDetails[0].plan.jobLimit + (orgDetails[0].extraJobSlots || 0)
    ) {
      return NextResponse.json(
        { error: "You have reached the maximum number of jobs for your plan" },
        { status: 400 }
      );
    }

    // Create career document
    const career = {
      id: guid(),
      jobTitle,
      description,
      questions,
      location,
      workSetup,
      workSetupRemarks,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedBy,
      createdBy,
      status: status || "active",
      screeningSetting,
      orgID,
      requireVideo,
      lastActivityAt: new Date(),
      salaryNegotiable,
      minimumSalary,
      maximumSalary,
      country,
      province,
      employmentType,
    };

    await db.collection("careers").insertOne(career);

    return NextResponse.json({
      message: "Career added successfully",
      career,
    });
  } catch (error) {
    console.error("Error adding career:", error);
    return NextResponse.json(
      { error: "Failed to add career" },
      { status: 500 }
    );
  }
}
