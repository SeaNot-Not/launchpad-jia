import moment from "moment";
import DOMPurify from "isomorphic-dompurify";
import validator from "validator";

export function checkFile(file) {
  if (file.length > 1) {
    alert("Only one file is allowed.");
    return false;
  }

  if (file[0].size > 10 * 1024 * 1024) {
    alert("File size must be less than 10MB.");
    return false;
  }

  if (
    ![
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ].includes(file[0].type)
  ) {
    alert("Only PDF, DOC, DOCX, or TXT files are allowed.");
    return false;
  }

  return file[0];
}

export function formatFileSize(size) {
  return (size / 1024 / 1024).toFixed(2);
}

export function processDate(date) {
  const inputDate = moment(date).utcOffset(8).startOf("day");
  const now = moment().utcOffset(8).startOf("day");
  const diffDays = now.diff(inputDate, "days");

  if (diffDays < 1) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`;
  }

  const diffMonths = now.diff(inputDate, "months");

  if (diffMonths < 1) {
    return `${diffDays} days ago`;
  }

  return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
}

export function processDisplayDate(date) {
  return moment(date).format("MMM D, YYYY");
}

/**
 * Sanitization & Validation Helpers
 */

// Sanitize plain text (escapes HTML special characters).
export function sanitizeString(value: string): string {
  if (typeof value !== "string") return "";
  return validator.escape(value.trim());
}

// Sanitize rich text (like descriptions) but allow safe HTML tags.
export function sanitizeRichText(html: string): string {
  if (typeof html !== "string") return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "b",
      "i",
      "em",
      "strong",
      "p",
      "ul",
      "ol",
      "li",
      "br",
      "span",
      "div",
    ],
    ALLOWED_ATTR: ["style"],
  });
}

// Validate and sanitize questions array.
export function validateAndSanitizeQuestions(questions: any): any[] {
  if (!Array.isArray(questions)) {
    throw new Error("Questions must be an array");
  }

  return questions.map((cat) => {
    if (!cat || typeof cat !== "object") {
      throw new Error("Each question category must be an object");
    }

    return {
      ...cat,
      category: sanitizeString(cat.category),
      questions: Array.isArray(cat.questions)
        ? cat.questions.map((q) => ({
            ...q,
            question: sanitizeString(q.question),
            type: sanitizeString(q.type),
            required: !!q.required,
          }))
        : [],
    };
  });
}

// Validate MongoDB ObjectId format.
export function isValidObjectId(id: string): boolean {
  return validator.isMongoId(id);
}
