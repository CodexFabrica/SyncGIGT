const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Summarizes a GitHub issue using Gemini with strict JSON enforcement.
 * @param {object} issue - The GitHub issue object
 * @returns {Promise<object>} { title, description, dueDate }
 */
async function summarizeIssue(issue) {
  // Define the schema strictly so the model knows exactly what to return
  const schema = {
    description: "Schema for Google Task creation",
    type: SchemaType.OBJECT,
    properties: {
      title: {
        type: SchemaType.STRING,
        description: "A short, action-oriented title for the task",
        nullable: false,
      },
      description: {
        type: SchemaType.STRING,
        description: "A concise summary of the issue context",
        nullable: false,
      },
      dueDate: {
        type: SchemaType.STRING,
        description: "ISO 8601 date format YYYY-MM-DD if found, otherwise null",
        nullable: true,
      },
    },
    required: ["title", "description"],
  };

  // Use 'gemini-2.5-flash' as requested by the user.
  // We inject the schema into the generation config.
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  const prompt = `
    You are an assistant helping to create Google Tasks from GitHub Issues.
    
    Here is the GitHub issue data:
    Title: ${issue.title}
    Body: ${issue.body || "No description provided."}
    Created At: ${issue.created_at}
    
    Extract a due date if explicitly mentioned (e.g., 'deadline: 2025-10-27').
    Generate the JSON response following the schema provided.
    Output ONLY valid JSON. Do not include any markdown formatting or explanation.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();



    // Clean up the response if it contains markdown code blocks
    if (text.includes("```json")) {
      text = text.split("```json")[1].split("```")[0];
    } else if (text.includes("```")) {
      text = text.split("```")[1].split("```")[0];
    }

    // Trim whitespace
    text = text.trim();

    return JSON.parse(text);

  } catch (error) {
    console.error("Error summarizing issue with Gemini:", error.message);
    if (error.response) {
      console.error("Error details:", JSON.stringify(error.response, null, 2));
    }

    // Return fallback structure on error
    return {
      title: issue.title,
      description: issue.body ? issue.body.substring(0, 200) + "..." : "No description",
      dueDate: null
    };
  }
}

module.exports = { summarizeIssue };